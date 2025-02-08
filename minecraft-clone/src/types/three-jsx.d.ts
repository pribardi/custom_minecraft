import { ReactThreeFiber } from '@react-three/fiber'
import { Group, Mesh, AmbientLight, DirectionalLight } from 'three'
import { ReactNode } from 'react'
import { Sky, OrbitControls } from '@react-three/drei'

declare global {
  namespace JSX {
    interface Element extends ReactNode {}
    interface IntrinsicElements {
      mesh: ReactThreeFiber.Object3DNode<Mesh, typeof Mesh>
      group: ReactThreeFiber.Object3DNode<Group, typeof Group>
      boxGeometry: ReactThreeFiber.BufferGeometryNode<THREE.BoxGeometry, typeof THREE.BoxGeometry>
      meshStandardMaterial: ReactThreeFiber.MaterialNode<THREE.MeshStandardMaterial, typeof THREE.MeshStandardMaterial>
      ambientLight: ReactThreeFiber.Object3DNode<AmbientLight, typeof AmbientLight>
      directionalLight: ReactThreeFiber.Object3DNode<DirectionalLight, typeof DirectionalLight>
      sky: ReactThreeFiber.Object3DNode<typeof Sky, typeof Sky>
      orbitControls: ReactThreeFiber.Object3DNode<typeof OrbitControls, typeof OrbitControls>
    }
  }
} 