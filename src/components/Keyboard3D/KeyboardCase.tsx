import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useCaseMaterial, useLayout } from '@/store/useKeyboardStore';
import { MATERIAL_CONFIGS } from '@/data/materials';
import { LAYOUT_CONFIGS } from '@/data/layouts';

export function KeyboardCase() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialId = useCaseMaterial();
  const layout = useLayout();
  const materialConfig = MATERIAL_CONFIGS[materialId];
  const layoutConfig = LAYOUT_CONFIGS[layout];

  const caseWidth = useMemo(() => layoutConfig.width + 0.8, [layoutConfig.width]);
  const caseDepth = useMemo(() => layoutConfig.height + 0.8, [layoutConfig.height]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.005;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <RoundedBox
        ref={meshRef}
        args={[caseWidth, 0.6, caseDepth]}
        radius={0.15}
        smoothness={8}
        castShadow
        receiveShadow
        position={[0, -0.1, 0]}
      >
        <meshStandardMaterial
          color={materialConfig.color}
          roughness={materialConfig.roughness}
          metalness={materialConfig.metalness}
        />
      </RoundedBox>

      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[caseWidth - 0.5, caseDepth - 0.5]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      <mesh name="keyboard-ground" position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[caseWidth + 8, caseDepth + 8]} />
        <meshStandardMaterial
          color="#0a0a0f"
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}
