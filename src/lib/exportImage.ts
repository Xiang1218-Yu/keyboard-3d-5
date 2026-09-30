import * as THREE from 'three';
import type { ExportSettings } from '@/store/useExportStore';

export const RESOLUTION_DIMENSIONS: Record<
  ExportSettings['resolution'],
  { width: number; height: number; label: string }
> = {
  '1080p': { width: 1920, height: 1080, label: '1920 × 1080' },
  '2K': { width: 2560, height: 1440, label: '2560 × 1440' },
  '4K': { width: 3840, height: 2160, label: '3840 × 2160' },
};

const WATERMARK_TEXT = 'Keyboard Studio';
const WATERMARK_SUB = '3D 键盘定制器';

/**
 * Render the current Three.js scene to a high-resolution PNG blob.
 *
 * The render is performed entirely off the main canvas via a WebGLRenderTarget,
 * so the running render loop and OrbitControls are never disturbed. The camera
 * aspect, scene background/fog, and environment visibility are saved up-front and
 * restored in a `finally` block — even if rendering throws.
 */
export async function renderExport(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  settings: ExportSettings
): Promise<Blob> {
  const { width, height } = RESOLUTION_DIMENSIONS[settings.resolution];

  // Supersampling: render larger than the output and downscale for smooth edges.
  // Clamp to the GPU's max renderbuffer size to avoid framebuffer errors.
  const context = gl.getContext() as WebGL2RenderingContext;
  const maxRenderbuffer = context.getParameter(
    context.MAX_RENDERBUFFER_SIZE
  ) as number;
  let pixelRatio = settings.pixelRatio;
  let rtWidth = width * pixelRatio;
  let rtHeight = height * pixelRatio;
  if (rtWidth > maxRenderbuffer || rtHeight > maxRenderbuffer) {
    pixelRatio = 1;
    rtWidth = width;
    rtHeight = height;
  }

  // --- Save restorable state ----------------------------------------------
  const saved = {
    background: scene.background,
    fog: scene.fog,
    clearColor: new THREE.Color(),
    clearAlpha: gl.getClearAlpha(),
    aspect: camera.aspect,
  };
  gl.getClearColor(saved.clearColor);

  const environmentObjects: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (obj.userData.isEnvironment) environmentObjects.push(obj);
  });

  let gradientTexture: THREE.CanvasTexture | null = null;

  try {
    // --- Apply export background ------------------------------------------
    if (settings.background === 'transparent') {
      scene.background = null;
      scene.fog = null;
      environmentObjects.forEach((obj) => (obj.visible = false));
      gl.setClearColor(0x000000, 0);
    } else if (settings.background === 'dark') {
      scene.background = new THREE.Color('#0a0a0f');
      gl.setClearColor(0x0a0a0f, 1);
    } else if (settings.background === 'gradient') {
      gradientTexture = createGradientTexture();
      scene.background = gradientTexture;
      scene.fog = null;
      gl.setClearColor(0x0a0a0f, 1);
    }

    // Match the camera aspect to the export frame (restore afterwards).
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // --- Render off-screen ------------------------------------------------
    const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
      samples: 0,
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
    });

    gl.setRenderTarget(renderTarget);
    gl.clear(true, true, false);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // --- Read pixels (WebGL origin is bottom-left) ------------------------
    const pixels = new Uint8Array(rtWidth * rtHeight * 4);
    gl.readRenderTargetPixels(renderTarget, 0, 0, rtWidth, rtHeight, pixels);
    renderTarget.dispose();

    // --- Flip vertically into a full-res 2D canvas -------------------------
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = rtWidth;
    fullCanvas.height = rtHeight;
    const fullCtx = fullCanvas.getContext('2d', { alpha: true })!;
    const imageData = fullCtx.createImageData(rtWidth, rtHeight);
    const rowBytes = rtWidth * 4;
    for (let y = 0; y < rtHeight; y++) {
      const src = (rtHeight - 1 - y) * rowBytes;
      const dst = y * rowBytes;
      imageData.data.set(pixels.subarray(src, src + rowBytes), dst);
    }
    fullCtx.putImageData(imageData, 0, 0);

    // --- Downscale to the target output size ------------------------------
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fullCanvas, 0, 0, width, height);

    if (settings.watermark) {
      drawWatermark(ctx, width, height);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('导出失败：无法生成 PNG 图片'));
        },
        'image/png'
      );
    });

    return blob;
  } finally {
    // --- Restore everything ------------------------------------------------
    scene.background = saved.background;
    scene.fog = saved.fog;
    environmentObjects.forEach((obj) => (obj.visible = true));
    gl.setClearColor(saved.clearColor, saved.clearAlpha);
    camera.aspect = saved.aspect;
    camera.updateProjectionMatrix();
    if (gradientTexture) gradientTexture.dispose();
    // Re-render the on-screen canvas so it reflects the restored state.
    gl.render(scene, camera);
  }
}

/** Diagonal indigo→purple→near-black gradient used as the export backdrop. */
function createGradientTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#312e81');
  gradient.addColorStop(0.45, '#4c1d95');
  gradient.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Draw a small branded watermark in the bottom-right corner. */
function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pad = Math.round(width * 0.022);
  const fontSize = Math.max(18, Math.round(width * 0.014));
  const subFontSize = Math.max(12, Math.round(width * 0.0095));

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';

  ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  const mainWidth = ctx.measureText(WATERMARK_TEXT).width;
  ctx.font = `400 ${subFontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  const subWidth = ctx.measureText(WATERMARK_SUB).width;

  const pillWidth = Math.max(mainWidth, subWidth) + pad * 1.6;
  const pillHeight = fontSize + subFontSize + pad * 1.4;
  const x = width - pad;
  const y = height - pad;
  const pillX = x - pillWidth + pad * 0.3;
  const pillY = y - pillHeight + pad * 0.3;

  ctx.fillStyle = 'rgba(10, 10, 15, 0.42)';
  roundRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(WATERMARK_TEXT, x, y - subFontSize - pad * 0.2);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `400 ${subFontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(WATERMARK_SUB, x, y - pad * 0.1);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Trigger a browser download for the given blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copy a PNG blob to the clipboard. Returns `{ ok: false }` when the Clipboard
 * API is unavailable or permission is denied — callers should fall back to
 * `downloadBlob` in that case.
 */
export async function copyBlobToClipboard(
  blob: Blob
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.write !== 'function' ||
      typeof ClipboardItem === 'undefined'
    ) {
      return { ok: false, reason: '当前浏览器不支持剪贴板 API' };
    }
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ]);
    return { ok: true };
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : '剪贴板权限被拒绝';
    return { ok: false, reason };
  }
}

/** Build a descriptive filename for the exported PNG. */
export function buildFilename(resolution: string, layout: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  return `keyboard-studio_${layout}_${resolution}_${stamp}.png`;
}
