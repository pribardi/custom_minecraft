import React, { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Group, MeshStandardMaterial, Euler } from 'three'
import { gsap } from 'gsap'

interface SwordModelProps {
  isAttacking: boolean
  onAttackComplete?: () => void
}

const SwordModel: React.FC<SwordModelProps> = ({ isAttacking, onAttackComplete }) => {
  const groupRef = useRef<Group>(null)
  const isAnimating = useRef(false)
  const { camera } = useThree()
  const initialRotation = useRef(new Euler(0.3, -0.5, 0.2))
  const initialPosition = useRef(new Vector3(0.7, -0.5, -1.0))

  useFrame(() => {
    if (groupRef.current && !isAnimating.current) {
      // Update position to stay relative to camera
      groupRef.current.position.copy(initialPosition.current)
      groupRef.current.rotation.copy(initialRotation.current)

      // Add subtle swaying based on camera movement
      groupRef.current.rotation.x += Math.sin(Date.now() * 0.002) * 0.02
      groupRef.current.rotation.y += Math.cos(Date.now() * 0.002) * 0.02
    }
  })

  useEffect(() => {
    if (isAttacking && !isAnimating.current && groupRef.current) {
      isAnimating.current = true

      // More dramatic slash animation
      const timeline = gsap.timeline({
        onComplete: () => {
          isAnimating.current = false
          if (onAttackComplete) onAttackComplete()
        }
      })

      timeline
        .to(groupRef.current.rotation, {
          x: -0.8,
          y: -1.8,
          z: -1.0,
          duration: 0.1,
          ease: "power2.in"
        })
        .to(groupRef.current.rotation, {
          x: 0.3,
          y: -0.5,
          z: 0.2,
          duration: 0.2,
          ease: "power2.out"
        })
    }
  }, [isAttacking, onAttackComplete])

  return (
    <group ref={groupRef}>
      {/* Sword handle */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color="#4a3728" roughness={0.7} />
      </mesh>
      
      {/* Sword guard */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.2, 0.05, 0.1]} />
        <meshStandardMaterial color="#8b8b8b" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Sword blade */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.1, 0.6, 0.02]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Add a point light to make the sword more visible */}
      <pointLight
        position={[0, 0.5, 0]}
        intensity={1.0}
        distance={2}
        color="#ffffff"
      />
    </group>
  )
}

export default SwordModel 