import * as THREE from 'three';

export type ExportResolution = '1080p' | '2k' | '4k';
export type ExportBackground = 'transparent' | 'dark' | 'gradient';

export interface ResolutionOption {
  id: ExportResolution;
  label: string;
  width: number;
  height: number;
}

export const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { id: '1080p', label: '1080p', width: 1920, height: 1080 },
  { id: '2k', label: '2K', width: 2560, height: 1440 },
  { id: '4k', label: '4K', width: 3840, height: 2160 },
];

export interface ExportOptions {
  resolution: ExportResolution;
  background: ExportBackground;
  watermark: boolean;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  /** true 表示因 GPU 限制被缩小 */
  clamped: boolean;
}

/** 场景引用(由 Canvas 内的 ExportBridge 注册) */
interface SceneRefs {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

/** postprocessing 的 EffectComposer 最小结构类型,避免直接依赖其类型 */
interface ComposerLike {
  render: (deltaTime?: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
}

let sceneRefs: SceneRefs | null = null;
let composerRef: ComposerLike | null = null;

export function registerScene(refs: SceneRefs | null) {
  sceneRefs = refs;
}

/** 作为 <EffectComposer ref={registerComposer}> 的回调 ref 使用 */
export function registerComposer(instance: ComposerLike | null) {
  composerRef = instance;
}

export function isExporterReady() {
  return sceneRefs !== null;
}

/** KeyboardCase 中地面阴影平面的对象名,透明背景导出时临时隐藏 */
export const GROUND_PLANE_NAME = 'keyboard-ground';

const DARK_BACKGROUND = '#0a0a0f';

/**
 * 以目标分辨率同步渲染一帧并合成到 2D 画布。
 * 全过程在同一任务内完成并恢复现场,RAF 循环与 OrbitControls 无感知。
 */
function renderSceneToCanvas(options: ExportOptions): {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  clamped: boolean;
} {
  if (!sceneRefs) {
    throw new Error('3D 场景尚未就绪,请稍后重试');
  }
  const { gl, scene, camera } = sceneRefs;
  const target = RESOLUTION_OPTIONS.find((r) => r.id === options.resolution)!;

  // 按 GPU 能力钳制输出尺寸(多重采样缓冲受 MAX_RENDERBUFFER_SIZE 约束)
  const context = gl.getContext();
  const maxBufferSize = context.getParameter(context.MAX_RENDERBUFFER_SIZE) as number;
  const maxSize = Math.min(gl.capabilities.maxTextureSize, maxBufferSize);
  const fit = Math.min(1, maxSize / target.width, maxSize / target.height);
  const width = Math.floor(target.width * fit);
  const height = Math.floor(target.height * fit);
  const clamped = fit < 1;

  // ---- 快照所有将被修改的状态 ----
  const prevSize = gl.getSize(new THREE.Vector2());
  const prevPixelRatio = gl.getPixelRatio();
  const prevClearColor = gl.getClearColor(new THREE.Color()).clone();
  const prevClearAlpha = gl.getClearAlpha();
  const prevBackground = scene.background;
  const prevAspect = camera.aspect;
  const prevPosition = camera.position.clone();
  const prevQuaternion = camera.quaternion.clone();
  const ground = scene.getObjectByName(GROUND_PLANE_NAME);
  const prevGroundVisible = ground ? ground.visible : true;

  try {
    // 像素比设为 1,使绘制缓冲恰好等于目标像素尺寸
    gl.setPixelRatio(1);
    if (composerRef) {
      // 走 EffectComposer 管线(含 Bloom),与屏幕预览一致;同时会同步 renderer 尺寸
      composerRef.setSize(width, height, false);
    } else {
      gl.setSize(width, height, false);
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // 统一以透明底渲染,背景在 2D 画布上合成
    scene.background = null;
    gl.setClearColor('#000000', 0);
    if (options.background === 'transparent' && ground) {
      ground.visible = false;
    }

    if (composerRef) {
      composerRef.render();
    } else {
      gl.render(scene, camera);
    }

    // 合成到 2D 画布(同一任务内读取,绘制缓冲仍有效)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建导出画布');
    }
    paintBackground(ctx, width, height, options.background);
    ctx.drawImage(gl.domElement, 0, 0, width, height);
    if (options.watermark) {
      drawWatermark(ctx, width, height);
    }
    return { canvas, width, height, clamped };
  } finally {
    // ---- 恢复现场:相机、布局(renderer 尺寸/像素比)、背景与透明度 ----
    scene.background = prevBackground;
    gl.setClearColor(prevClearColor, prevClearAlpha);
    if (ground) {
      ground.visible = prevGroundVisible;
    }
    camera.aspect = prevAspect;
    camera.position.copy(prevPosition);
    camera.quaternion.copy(prevQuaternion);
    camera.updateProjectionMatrix();

    gl.setPixelRatio(prevPixelRatio);
    if (composerRef) {
      composerRef.setSize(prevSize.x, prevSize.y, false);
    } else {
      gl.setSize(prevSize.x, prevSize.y, false);
    }

    // 立即按恢复后的状态重绘一帧,保证屏幕缓冲有效、画面无闪烁
    try {
      if (composerRef) {
        composerRef.render();
      } else {
        gl.render(scene, camera);
      }
    } catch {
      // 忽略:下一帧 RAF 会正常渲染
    }
  }
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: ExportBackground
) {
  if (background === 'transparent') return;

  ctx.fillStyle = DARK_BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  if (background === 'gradient') {
    // 与页面氛围一致的对角渐变:靛蓝 → 透明 → 紫
    const diagonal = ctx.createLinearGradient(0, 0, width, height);
    diagonal.addColorStop(0, 'rgba(49, 46, 129, 0.5)');
    diagonal.addColorStop(0.5, 'rgba(49, 46, 129, 0)');
    diagonal.addColorStop(1, 'rgba(88, 28, 135, 0.5)');
    ctx.fillStyle = diagonal;
    ctx.fillRect(0, 0, width, height);

    const glowTopLeft = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(width, height) * 0.7);
    glowTopLeft.addColorStop(0, 'rgba(99, 102, 241, 0.18)');
    glowTopLeft.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = glowTopLeft;
    ctx.fillRect(0, 0, width, height);

    const glowBottomRight = ctx.createRadialGradient(
      width, height, 0, width, height, Math.max(width, height) * 0.7
    );
    glowBottomRight.addColorStop(0, 'rgba(168, 85, 247, 0.16)');
    glowBottomRight.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = glowBottomRight;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const fontSize = Math.round(height * 0.024);
  const paddingX = fontSize * 0.9;
  const paddingY = fontSize * 0.55;
  const margin = Math.round(height * 0.035);
  const text = '⌨ Keyboard Studio';

  ctx.save();
  ctx.font = `600 ${fontSize}px 'Space Grotesk', 'Inter', system-ui, sans-serif`;
  ctx.textBaseline = 'middle';

  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontSize + paddingY * 2;
  const x = width - margin - boxWidth;
  const y = height - margin - boxHeight;
  const radius = boxHeight / 2;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, boxWidth, boxHeight, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + boxWidth, y, x + boxWidth, y + boxHeight, radius);
    ctx.arcTo(x + boxWidth, y + boxHeight, x, y + boxHeight, radius);
    ctx.arcTo(x, y + boxHeight, x, y, radius);
    ctx.arcTo(x, y, x + boxWidth, y, radius);
    ctx.closePath();
  }
  ctx.fillStyle = 'rgba(10, 10, 15, 0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = Math.max(1, fontSize * 0.04);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.fillText(text, x + paddingX, y + boxHeight / 2 + fontSize * 0.06);
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG 编码失败'))),
      'image/png'
    );
  });
}

/** 导出场景为 PNG Blob */
export async function exportSceneImage(options: ExportOptions): Promise<ExportResult> {
  const { canvas, width, height, clamped } = renderSceneToCanvas(options);
  const blob = await canvasToBlob(canvas);
  return { blob, width, height, clamped };
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 复制 PNG 到剪贴板;不支持或权限被拒时抛错,由调用方回退为下载 */
export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof window.ClipboardItem !== 'function'
  ) {
    throw new Error('当前环境不支持剪贴板写入');
  }
  const item = new window.ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([item]);
}
