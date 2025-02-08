import React, { FC, useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { Vector3 } from 'three'
import { Pig, PigRef } from './Pig'
import { WorldGenerator } from '../../../systems/worldGen'
import { useThree } from '@react-three/fiber'

interface PigManagerProps {
  worldGen: WorldGenerator
  maxPigs?: number
  spawnRadius?: number
}

export interface PigManagerRef {
  tryDamagePig: (position: Vector3, damage: number) => void
}

interface PigData {
  id: number
  position: [number, number, number]
  lastUpdateTime: number
  direction: number // Angle in radians
  nextDirectionChange: number
  movementType: 'wander' | 'circle' | 'zigzag'
  movementPhase: number
  lastPosition: Vector3 // Track last valid position
  ref: React.RefObject<PigRef> // Update ref type
}

const MIN_PIG_DISTANCE = 48 // Greatly increased minimum distance between pigs
const DIRECTION_CHANGE_INTERVAL = 3000 // Time between direction changes in ms
const UPDATE_INTERVAL = 500 // Reduced update frequency
const MAX_SPAWN_ATTEMPTS = 15 // Increased spawn attempts to find better positions
const MIN_SPAWN_HEIGHT = 0
const MAX_SPAWN_HEIGHT = 100
const SPAWN_CHECK_INTERVAL = 60000 // Increased to 1 minute
const DESPAWN_DISTANCE = 96 // Increased despawn distance
const MIN_SPAWN_DISTANCE = 32 // Increased minimum distance from player
const MAX_SPAWN_DISTANCE = 64 // Increased maximum distance from player
const SPAWN_CHANCE = 0.3 // Only 30% chance to spawn when conditions are met

export const PigManager = forwardRef<PigManagerRef, PigManagerProps>(({ 
  worldGen, 
  maxPigs = 2,
  spawnRadius = 48 
}, ref) => {
  const [pigs, setPigs] = useState<PigData[]>([])
  const { camera } = useThree()
  const spawnAttempts = useRef(0)
  const lastSpawnCheck = useRef(Date.now())
  const isUpdating = useRef(false)
  const loadedChunks = useRef(new Set<string>())

  const getMovementPattern = (type: 'wander' | 'circle' | 'zigzag', phase: number, baseDirection: number): number => {
    const now = Date.now() / 1000
    switch (type) {
      case 'circle':
        // Circular movement
        return baseDirection + Math.sin(now + phase) * Math.PI / 2
      case 'zigzag':
        // Zigzag movement
        return baseDirection + Math.sin(now * 2 + phase) * Math.PI / 3
      case 'wander':
      default:
        // Random wandering with smooth transitions
        return baseDirection + Math.sin(now * 0.5 + phase) * Math.PI / 6
    }
  }

  const isTooCloseToOtherPigs = useCallback((position: [number, number, number], excludeId?: number) => {
    const pos = new Vector3(...position)
    return pigs.some(pig => {
      if (excludeId && pig.id === excludeId) return false
      const pigPos = new Vector3(...pig.position)
      return pigPos.distanceTo(pos) < MIN_PIG_DISTANCE
    })
  }, [pigs])

  const findSpawnPosition = useCallback((): [number, number, number] | null => {
    const cameraPos = camera.position
    spawnAttempts.current++

    // Add random chance to even attempt spawning
    if (Math.random() > SPAWN_CHANCE) {
      return null
    }

    // Try spawning in a spiral pattern for better distribution
    for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
      // Generate random angle and distance within spawn range
      const angle = Math.random() * Math.PI * 2
      const distance = MIN_SPAWN_DISTANCE + Math.random() * (MAX_SPAWN_DISTANCE - MIN_SPAWN_DISTANCE)
      
      const x = cameraPos.x + Math.cos(angle) * distance
      const z = cameraPos.z + Math.sin(angle) * distance

      // Check if the chunk is loaded
      const chunkKey = `${Math.floor(x / 16)},${Math.floor(z / 16)}`
      if (!loadedChunks.current.has(chunkKey)) {
        continue
      }

      // Find the highest solid block at this position
      let surfaceFound = false
      let surfaceY = -1

      for (let y = Math.min(MAX_SPAWN_HEIGHT, Math.floor(cameraPos.y) + 20); y >= MIN_SPAWN_HEIGHT; y--) {
        const block = worldGen.getBlock(Math.floor(x), y, Math.floor(z))
        const blockAbove = worldGen.getBlock(Math.floor(x), y + 1, Math.floor(z))
        const blockTwoAbove = worldGen.getBlock(Math.floor(x), y + 2, Math.floor(z))

        // Only spawn on grass blocks to make it more natural and rare
        if (block && block.type === 'GRASS' && 
            (!blockAbove || blockAbove.type === 'AIR') && 
            (!blockTwoAbove || blockTwoAbove.type === 'AIR')) {
          surfaceY = y + 1
          surfaceFound = true
          break
        }
      }

      if (surfaceFound) {
        const position: [number, number, number] = [x, surfaceY, z]
        if (!isTooCloseToOtherPigs(position)) {
          return position
        }
      }
    }
    return null
  }, [camera.position, worldGen, isTooCloseToOtherPigs])

  const spawnPig = useCallback(() => {
    const position = findSpawnPosition()
    if (position) {
      const now = Date.now()
      const movementTypes: Array<'wander' | 'circle' | 'zigzag'> = ['wander', 'circle', 'zigzag']
      const newPig: PigData = {
        id: now + Math.random(),
        position,
        lastUpdateTime: now,
        direction: Math.random() * Math.PI * 2,
        nextDirectionChange: now + DIRECTION_CHANGE_INTERVAL,
        movementType: movementTypes[Math.floor(Math.random() * movementTypes.length)],
        movementPhase: Math.random() * Math.PI * 2,
        lastPosition: new Vector3(...position),
        ref: React.createRef<PigRef>()
      }
      setPigs(current => [...current, newPig])
      spawnAttempts.current = 0
      return true
    }
    return false
  }, [findSpawnPosition])

  // Track loaded chunks
  useEffect(() => {
    const updateLoadedChunks = () => {
      const cameraPos = camera.position
      const chunkX = Math.floor(cameraPos.x / 16)
      const chunkZ = Math.floor(cameraPos.z / 16)
      const newLoadedChunks = new Set<string>()

      // Mark chunks in render distance as loaded
      for (let x = -4; x <= 4; x++) {
        for (let z = -4; z <= 4; z++) {
          const chunk = worldGen.getChunk(chunkX + x, chunkZ + z)
          if (chunk) {
            newLoadedChunks.add(`${chunkX + x},${chunkZ + z}`)
          }
        }
      }

      loadedChunks.current = newLoadedChunks
    }

    const interval = setInterval(updateLoadedChunks, 1000)
    return () => clearInterval(interval)
  }, [camera, worldGen])

  // Initial spawn
  useEffect(() => {
    const initialSpawn = () => {
      const delay = 5000 // Increased initial delay to 5 seconds
      setTimeout(() => {
        let spawnedCount = 0
        const interval = setInterval(() => {
          if (spawnedCount < maxPigs) {
            if (Math.random() < SPAWN_CHANCE && spawnPig()) { // Added additional spawn chance
              spawnedCount++
            }
          } else {
            clearInterval(interval)
          }
        }, 3000) // Increased to spawn attempt every 3 seconds
      }, delay)
    }

    initialSpawn()
  }, [maxPigs, spawnPig])

  useEffect(() => {
    const updatePigs = () => {
      if (isUpdating.current) return
      isUpdating.current = true

      try {
        const now = Date.now()
        
        setPigs(current => {
          return current.map(pig => {
            // Update direction based on movement pattern
            const baseDirection = pig.direction
            const newDirection = getMovementPattern(pig.movementType, pig.movementPhase, baseDirection)

            // Check if the pig's position has changed significantly
            const currentPos = new Vector3(...pig.position)
            const distanceFromLast = currentPos.distanceTo(pig.lastPosition)

            // If pig hasn't moved in a while, it might be stuck
            if (distanceFromLast < 0.1 && now - pig.lastUpdateTime > 5000) {
              // Try to unstuck by changing direction
              return {
                ...pig,
                direction: Math.random() * Math.PI * 2,
                movementPhase: Math.random() * Math.PI * 2,
                lastUpdateTime: now
              }
            }

            return {
              ...pig,
              direction: newDirection,
              lastUpdateTime: now,
              lastPosition: currentPos
            }
          }).filter(pig => {
            const pigPos = new Vector3(...pig.position)
            const distanceToCamera = pigPos.distanceTo(camera.position)
            return distanceToCamera < DESPAWN_DISTANCE
          })
        })

        // Only check for new spawns periodically
        if (now - lastSpawnCheck.current > SPAWN_CHECK_INTERVAL) {
          lastSpawnCheck.current = now
          const missingPigs = maxPigs - pigs.length
          if (missingPigs > 0) {
            spawnPig()
          }
        }
      } finally {
        isUpdating.current = false
      }
    }

    const interval = setInterval(updatePigs, UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [maxPigs, spawnPig, spawnRadius, camera.position, pigs.length])

  const handlePigDeath = useCallback((pigId: number) => {
    setPigs(current => current.filter(pig => pig.id !== pigId))
  }, [])

  // Update tryDamagePig to use better hit detection
  const tryDamagePig = useCallback((position: Vector3, damage: number) => {
    setPigs(current => {
      let pigHit = false
      const updatedPigs = current.map(pig => {
        if (!pigHit) {
          const pigPos = new Vector3(...pig.position)
          const distance = pigPos.distanceTo(position)
          
          // Calculate angle between attack direction and pig position
          const toPig = pigPos.clone().sub(position).normalize()
          const attackDirection = new Vector3()
          camera.getWorldDirection(attackDirection)
          const angle = Math.abs(toPig.angleTo(attackDirection))
          
          // Hit if within range (2.5 blocks) and within a 60-degree cone in front
          if (distance < 2.5 && angle < Math.PI / 3) {
            pigHit = true
            console.log('Hit pig! Distance:', distance, 'Angle:', angle)
            // Apply damage to the pig
            if (pig.ref.current) {
              pig.ref.current.takeDamage(damage)
            }
          }
        }
        return pig
      })
      return updatedPigs
    })
  }, [camera])

  // Expose tryDamagePig via ref
  useImperativeHandle(ref, () => ({
    tryDamagePig
  }))

  return (
    <>
      {pigs.map(pig => (
        <Pig
          key={pig.id}
          id={pig.id}
          position={pig.position}
          worldGen={worldGen}
          direction={pig.direction}
          onDeath={() => handlePigDeath(pig.id)}
          ref={pig.ref}
        />
      ))}
    </>
  )
})

PigManager.displayName = 'PigManager'

export type { PigManagerProps } 