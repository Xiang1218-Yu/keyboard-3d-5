import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useExportStore } from '@/store/useExportStore';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import {
  renderExport,
  downloadBlob,
  copyBlobToClipboard,
  buildFilename,
} from '@/lib/exportImage';

/**
 * Bridges the export UI (outside the Canvas) with the Three.js renderer.
 *
 * It subscribes to `requestId` from the export store and, on each request,
 * renders the scene to a high-resolution PNG off-screen. The on-screen canvas,
 * render loop and OrbitControls are never resized or reconfigured, so the
 * running 3D interaction is left intact.
 */
export function ExportController() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;

  const requestId = useExportStore((state) => state.requestId);
  const setStatus = useExportStore((state) => state.setStatus);
  const setResultUrl = useExportStore((state) => state.setResultUrl);

  // Always-latest refs so the effect only depends on requestId.
  const contextRef = useRef({ gl, scene, camera });
  contextRef.current = { gl, scene, camera };

  useEffect(() => {
    if (requestId === 0) return;
    let cancelled = false;

    const { gl, scene, camera } = contextRef.current;
    const { settings, lastAction } = useExportStore.getState();

    (async () => {
      try {
        const blob = await renderExport(gl, scene, camera, settings);
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        setResultUrl(url);

        const layout = useKeyboardStore.getState().layout;
        const filename = buildFilename(settings.resolution, layout);

        if (lastAction === 'download') {
          downloadBlob(blob, filename);
          setStatus('success', '高清 PNG 已开始下载');
        } else {
          const result = await copyBlobToClipboard(blob);
          if (result.ok) {
            setStatus('success', '已复制到剪贴板');
          } else {
            // Clipboard permission failed — fall back to a download so the
            // user always gets their image.
            downloadBlob(blob, filename);
            setStatus(
              'success',
              result.reason
                ? `剪贴板不可用（${result.reason}），已自动改为下载`
                : '剪贴板不可用，已自动改为下载'
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(
            'error',
            err instanceof Error ? err.message : '导出失败，请重试'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  return null;
}
