import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Group, Euler, MeshStandardMaterial, BufferGeometry, BoxGeometry } from 'three'
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
  const timeline = useRef<gsap.core.Timeline | null>(null)

  // Memoize geometries and materials
  const { handleGeometry, guardGeometry, bladeGeometry } = useMemo(() => ({
    handleGeometry: new BoxGeometry(0.08, 0.3, 0.08),
    guardGeometry: new BoxGeometry(0.2, 0.05, 0.1),
    bladeGeometry: new BoxGeometry(0.1, 0.6, 0.02)
  }), [])

  const { handleMaterial, guardMaterial, bladeMaterial } = useMemo(() => ({
    handleMaterial: new MeshStandardMaterial({ 
      color: '#4a3728', 
      roughness: 0.7,
      name: 'handle'
    }),
    guardMaterial: new MeshStandardMaterial({ 
      color: '#8b8b8b', 
      metalness: 0.8, 
      roughness: 0.2,
      name: 'guard'
    }),
    bladeMaterial: new MeshStandardMaterial({ 
      color: '#c0c0c0', 
      metalness: 0.9, 
      roughness: 0.1,
      name: 'blade'
    })
  }), [])

  // Smooth idle animation
  useFrame(() => {
    if (groupRef.current && !isAnimating.current) {
      // Update position to stay relative to camera
      groupRef.current.position.copy(initialPosition.current)
      groupRef.current.rotation.copy(initialRotation.current)

      // Add subtle breathing animation
      const time = Date.now() * 0.002
      groupRef.current.rotation.x += Math.sin(time) * 0.02
      groupRef.current.rotation.y += Math.cos(time * 0.8) * 0.02
      groupRef.current.position.y += Math.sin(time * 1.2) * 0.005
    }
  })

  // Attack animation with proper cleanup
  useEffect(() => {
    if (isAttacking && !isAnimating.current && groupRef.current) {
      isAnimating.current = true

      // Kill any existing animation
      if (timeline.current) {
        timeline.current.kill()
      }

      // Create new animation timeline
      timeline.current = gsap.timeline({
        onComplete: () => {
          isAnimating.current = false
          if (onAttackComplete) onAttackComplete()
        },
        defaults: { ease: "power2.out" }
      })

      // Enhanced attack animation
      timeline.current
        .to(groupRef.current.rotation, {
          x: -0.8,
          y: -1.8,
          z: -1.0,
          duration: 0.1,
          ease: "power2.in"
        })
        .to(groupRef.current.position, {
          x: "+=0.2",
          z: "-=0.2",
          duration: 0.1,
          ease: "power2.in"
        }, "<")
        .to(groupRef.current.rotation, {
          x: 0.3,
          y: -0.5,
          z: 0.2,
          duration: 0.2
        })
        .to(groupRef.current.position, {
          x: initialPosition.current.x,
          y: initialPosition.current.y,
          z: initialPosition.current.z,
          duration: 0.2
        }, "<")
    }
  }, [isAttacking, onAttackComplete])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeline.current) {
        timeline.current.kill()
      }
      handleGeometry.dispose()
      guardGeometry.dispose()
      bladeGeometry.dispose()
      handleMaterial.dispose()
      guardMaterial.dispose()
      bladeMaterial.dispose()
    }
  }, [handleGeometry, guardGeometry, bladeGeometry, handleMaterial, guardMaterial, bladeMaterial])

  return (
    <group ref={groupRef}>
      {/* Sword handle */}
      <mesh 
        geometry={handleGeometry}
        material={handleMaterial}
        castShadow
      />
      
      {/* Sword guard */}
      <mesh 
        position={[0, 0.15, 0]} 
        geometry={guardGeometry}
        material={guardMaterial}
        castShadow
      />
      
      {/* Sword blade */}
      <mesh 
        position={[0, 0.5, 0]} 
        geometry={bladeGeometry}
        material={bladeMaterial}
        castShadow
      />

      {/* Dynamic lighting */}
      <pointLight
        position={[0, 0.5, 0]}
        intensity={0.8}
        distance={2}
        color="#ffffff"
        castShadow
      />
    </group>
  )
}

export default SwordModel 