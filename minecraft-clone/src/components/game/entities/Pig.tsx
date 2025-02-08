import { useRef, useEffect, FC, useState, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, Box3, Quaternion, Euler } from 'three'
import { WorldGenerator } from '../../../systems/worldGen'

interface PigProps {
  position: [number, number, number]
  worldGen: WorldGenerator
  direction: number  // Angle in radians
  onDeath?: () => void
  id: number // Add id to props
}

const PIG_WIDTH = 0.6
const PIG_HEIGHT = 0.6
const PIG_LENGTH = 0.8
const MOVEMENT_SPEED = 1.5
const WANDER_RADIUS = 10
const DIRECTION_CHANGE_TIME = 3
const GRAVITY = -20
const MAX_PIG_HEALTH = 10

export interface PigRef {
  takeDamage: (amount: number) => void
  getBoundingBox: () => Box3
}

export const Pig = forwardRef<PigRef, PigProps>(({ 
  position: initialPosition, 
  worldGen, 
  direction, 
  onDeath,
  id 
}, ref) => {
  const position = useRef(new Vector3(...initialPosition))
  const rotation = useRef(new Euler(0, direction, 0))
  const velocity = useRef(new Vector3())
  const isGrounded = useRef(false)
  const boundingBox = useRef(new Box3())
  const groupRef = useRef<THREE.Group>(null)
  const [health, setHealth] = useState(MAX_PIG_HEALTH)
  const [isHurt, setIsHurt] = useState(false)

  const takeDamage = (amount: number) => {
    setHealth(prev => {
      const newHealth = prev - amount
      if (newHealth <= 0 && onDeath) {
        onDeath()
      }
      return newHealth
    })
    setIsHurt(true)
    setTimeout(() => setIsHurt(false), 200) // Flash red when hurt
  }

  const updateBoundingBox = () => {
    boundingBox.current.min.set(
      position.current.x - PIG_WIDTH / 2,
      position.current.y,
      position.current.z - PIG_LENGTH / 2
    )
    boundingBox.current.max.set(
      position.current.x + PIG_WIDTH / 2,
      position.current.y + PIG_HEIGHT,
      position.current.z + PIG_LENGTH / 2
    )
  }

  const findGroundHeight = (x: number, z: number): number => {
    for (let y = Math.floor(position.current.y + 1); y >= 0; y--) {
      const block = worldGen.getBlock(Math.floor(x), y, Math.floor(z))
      if (block && block.type !== 'AIR') {
        return y + 1
      }
    }
    return 0
  }

  const checkCollision = (pos: Vector3): boolean => {
    const tempBox = new Box3()
    tempBox.min.set(
      pos.x - PIG_WIDTH / 2,
      pos.y,
      pos.z - PIG_LENGTH / 2
    )
    tempBox.max.set(
      pos.x + PIG_WIDTH / 2,
      pos.y + PIG_HEIGHT,
      pos.z + PIG_LENGTH / 2
    )

    // Check collision with blocks
    const minX = Math.floor(tempBox.min.x)
    const maxX = Math.ceil(tempBox.max.x)
    const minY = Math.floor(tempBox.min.y)
    const maxY = Math.ceil(tempBox.max.y)
    const minZ = Math.floor(tempBox.min.z)
    const maxZ = Math.ceil(tempBox.max.z)

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = worldGen.getBlock(x, y, z)
          if (block && block.type !== 'AIR') {
            const blockBox = new Box3(
              new Vector3(x, y, z),
              new Vector3(x + 1, y + 1, z + 1)
            )
            if (tempBox.intersectsBox(blockBox)) {
              return true
            }
          }
        }
      }
    }
    return false
  }

  useFrame((_, delta) => {
    // Update rotation to match direction
    rotation.current.y = direction

    // Calculate movement direction
    const moveDirection = new Vector3(
      Math.sin(direction),
      0,
      Math.cos(direction)
    ).normalize()

    // Apply movement
    velocity.current.x = moveDirection.x * MOVEMENT_SPEED * delta
    velocity.current.z = moveDirection.z * MOVEMENT_SPEED * delta

    // Apply gravity
    if (!isGrounded.current) {
      velocity.current.y += GRAVITY * delta
    }

    // Try to move
    const newPosition = position.current.clone()
    newPosition.add(velocity.current)

    // Check ground height at new position
    const groundHeight = findGroundHeight(newPosition.x, newPosition.z)
    if (newPosition.y < groundHeight) {
      newPosition.y = groundHeight
      velocity.current.y = 0
      isGrounded.current = true
    } else if (newPosition.y > groundHeight) {
      isGrounded.current = false
    }

    // Check for collisions
    if (!checkCollision(newPosition)) {
      position.current.copy(newPosition)
      updateBoundingBox()
      
      // Update group position and rotation
      if (groupRef.current) {
        groupRef.current.position.copy(position.current)
        groupRef.current.rotation.copy(rotation.current)
      }
    } else {
      // If collision occurred, try to slide along walls
      newPosition.copy(position.current)
      newPosition.x += velocity.current.x
      if (!checkCollision(newPosition)) {
        position.current.x = newPosition.x
      }

      newPosition.copy(position.current)
      newPosition.z += velocity.current.z
      if (!checkCollision(newPosition)) {
        position.current.z = newPosition.z
      }
    }
  })

  // Make the pig's bounding box accessible
  useEffect(() => {
    updateBoundingBox()
  }, [position.current])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    takeDamage,
    getBoundingBox: () => boundingBox.current
  }))

  return (
    <group ref={groupRef} position={position.current.toArray()}>
      {/* Pig body */}
      <mesh castShadow>
        <boxGeometry args={[PIG_WIDTH, PIG_HEIGHT, PIG_LENGTH]} />
        <meshStandardMaterial color={isHurt ? "#ff0000" : "#ffcfcf"} />
      </mesh>
      {/* Pig head */}
      <mesh position={[0, PIG_HEIGHT * 0.25, PIG_LENGTH * 0.4]} castShadow>
        <boxGeometry args={[PIG_WIDTH * 0.8, PIG_HEIGHT * 0.8, PIG_LENGTH * 0.4]} />
        <meshStandardMaterial color={isHurt ? "#ff0000" : "#ffcfcf"} />
      </mesh>
      {/* Pig legs */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
        <mesh
          key={i}
          position={[
            x * (PIG_WIDTH * 0.3),
            -PIG_HEIGHT * 0.4,
            z * (PIG_LENGTH * 0.3)
          ]}
          castShadow
        >
          <boxGeometry args={[PIG_WIDTH * 0.2, PIG_HEIGHT * 0.4, PIG_WIDTH * 0.2]} />
          <meshStandardMaterial color={isHurt ? "#ff0000" : "#ffcfcf"} />
        </mesh>
      ))}
      {/* Health bar */}
      <mesh position={[0, PIG_HEIGHT + 0.3, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh position={[(-0.5 + (health / MAX_PIG_HEALTH) * 0.5), PIG_HEIGHT + 0.3, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[(health / MAX_PIG_HEALTH), 0.1]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
    </group>
  )
})

Pig.displayName = 'Pig'

export type { PigProps } 