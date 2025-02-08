import React, { useRef, useEffect } from 'react'
import { Vector3, Euler, Group } from 'three'
import { useFrame } from '@react-three/fiber'

interface PlayerModelProps {
  position: Vector3
  rotation: Euler
  isMoving: boolean
  isJumping: boolean
}

const PlayerModel: React.FC<PlayerModelProps> = ({ position, rotation, isMoving, isJumping }) => {
  const groupRef = useRef<Group>(null)
  const animationTime = useRef(0)
  const legRotation = useRef(0)
  const armRotation = useRef(0)
  const bobHeight = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Update animation time
    if (isMoving) {
      animationTime.current += delta * 10
    } else {
      animationTime.current = 0
      legRotation.current = 0
      armRotation.current = 0
      bobHeight.current = 0
    }

    // Calculate limb rotations for walking animation
    if (isMoving) {
      const swingAmount = Math.PI / 4
      legRotation.current = Math.sin(animationTime.current) * swingAmount
      armRotation.current = -Math.sin(animationTime.current) * swingAmount
      bobHeight.current = Math.abs(Math.sin(animationTime.current)) * 0.1
    }

    // Apply jump animation
    if (isJumping) {
      armRotation.current = -Math.PI / 4
    }

    // Update model position and rotation
    // Adjust the position to account for the model's height
    const adjustedPosition = position.clone()
    adjustedPosition.y -= 1.0 // Offset to align feet with ground
    groupRef.current.position.copy(adjustedPosition)
    groupRef.current.rotation.copy(rotation)
    
    if (isMoving) {
      groupRef.current.position.y += bobHeight.current
    }
  })

  return (
    <group ref={groupRef}>
      {/* Body - Adjusted positions to be relative to feet */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.75, 0.25]} />
        <meshStandardMaterial color="#3498db" />
      </mesh>

      {/* Head - Adjusted position */}
      <mesh position={[0, 1.75, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#e8d7a9" />
      </mesh>

      {/* Right Arm - Adjusted position */}
      <group position={[0.35, 1.3, 0]}>
        <mesh position={[0, -0.3, 0]} rotation={[armRotation.current, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color="#3498db" />
        </mesh>
      </group>

      {/* Left Arm - Adjusted position */}
      <group position={[-0.35, 1.3, 0]}>
        <mesh position={[0, -0.3, 0]} rotation={[-armRotation.current, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color="#3498db" />
        </mesh>
      </group>

      {/* Right Leg - Adjusted position */}
      <group position={[0.15, 0.75, 0]}>
        <mesh position={[0, -0.25, 0]} rotation={[legRotation.current, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.5, 0.2]} />
          <meshStandardMaterial color="#2980b9" />
        </mesh>
      </group>

      {/* Left Leg - Adjusted position */}
      <group position={[-0.15, 0.75, 0]}>
        <mesh position={[0, -0.25, 0]} rotation={[-legRotation.current, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.5, 0.2]} />
          <meshStandardMaterial color="#2980b9" />
        </mesh>
      </group>
    </group>
  )
}

export default PlayerModel 