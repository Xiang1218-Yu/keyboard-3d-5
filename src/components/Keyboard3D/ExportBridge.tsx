import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { registerScene } from '@/lib/exporter';

/**
 * 挂载在 Canvas 内,把 renderer / scene / camera 注册到导出模块,
 * 使 Canvas 外的导出面板可以触发高清渲染。
 */
export function ExportBridge() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    registerScene({ gl, scene, camera });
    return () => registerScene(null);
  }, [gl, scene, camera]);

  return null;
}
