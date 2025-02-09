import React, { useEffect, useState, FC, ReactElement, useRef, useCallback, useMemo } from 'react'
import { WorldGenerator, Chunk, CHUNK_SIZE } from '../../systems/worldGen'
import ChunkComponent from './Chunk'
import { Object3D, Vector3 } from 'three'
import { PigManager } from './entities/PigManager'
import { useThree } from '@react-three/fiber'
import { Player } from './Player'

// Constants for chunk loading and rendering
const INITIAL_RENDER_DISTANCE = 8
const RENDER_DISTANCE = 6
const CHUNK_UPDATE_INTERVAL = 50  // ms
const CHUNK_LOAD_DEBOUNCE = 150   // ms
const CHUNK_UNLOAD_DISTANCE = (RENDER_DISTANCE + 3) * CHUNK_SIZE
const MAX_CHUNKS_PER_FRAME = 6
const FORCE_LOAD_RADIUS = 2

interface WorldProps {
  worldGen: WorldGenerator
}

interface ChunkCache {
  [key: string]: {
    element: ReactElement<Object3D>
    lastAccessed: number
    position: Vector3
  }
}

export const World: React.FC<WorldProps> = ({ worldGen }) => {
  const [loadedChunks, setLoadedChunks] = useState<Map<string, Chunk>>(new Map())
  const { camera } = useThree()
  const updateTimer = useRef<NodeJS.Timeout | null>(null)
  const isUpdating = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const getChunkKey = (x: number, z: number) => `${x},${z}`

  const updateLoadedChunks = useCallback(() => {
    if (!camera || isUpdating.current) return
    isUpdating.current = true

    try {
      const cameraPosition = camera.position
      const playerChunkX = Math.floor(cameraPosition.x / CHUNK_SIZE)
      const playerChunkZ = Math.floor(cameraPosition.z / CHUNK_SIZE)

      console.log('Updating chunks around position:', { playerChunkX, playerChunkZ })

      // Create a new Map for the updated chunks
      const newChunks = new Map<string, Chunk>()
      const chunksToLoad: { x: number; z: number }[] = []

      // Calculate chunks to load
      for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
          const chunkX = playerChunkX + x
          const chunkZ = playerChunkZ + z
          const key = getChunkKey(chunkX, chunkZ)

          // Check if chunk is within render distance
          const distance = Math.sqrt(x * x + z * z)
          if (distance <= RENDER_DISTANCE) {
            const existingChunk = loadedChunks.get(key)
            if (existingChunk) {
              newChunks.set(key, existingChunk)
            } else {
              chunksToLoad.push({ x: chunkX, z: chunkZ })
            }
          }
        }
      }

      // Load new chunks
      let loadedCount = 0
      for (const { x, z } of chunksToLoad) {
        if (loadedCount >= MAX_CHUNKS_PER_FRAME) break

        const chunk = worldGen.getChunk(x, z)
        if (chunk) {
          const key = getChunkKey(x, z)
          newChunks.set(key, chunk)
          loadedCount++
          console.log('Loaded new chunk:', { x, z, key })
        }
      }

      // Update state with new chunks
      setLoadedChunks(newChunks)
      console.log('Updated chunks, total loaded:', newChunks.size)
    } catch (err) {
      console.error('Error updating chunks:', err)
      setError(err instanceof Error ? err.message : 'Failed to update chunks')
    } finally {
      isUpdating.current = false
    }
  }, [camera, loadedChunks, worldGen])

  // Initial chunk loading
  useEffect(() => {
    console.log('Initial chunk loading...')
    try {
      const loadInitialChunks = () => {
        for (let x = -INITIAL_RENDER_DISTANCE; x <= INITIAL_RENDER_DISTANCE; x++) {
          for (let z = -INITIAL_RENDER_DISTANCE; z <= INITIAL_RENDER_DISTANCE; z++) {
            const chunk = worldGen.getChunk(x, z)
            if (chunk) {
              const key = getChunkKey(x, z)
              setLoadedChunks(prev => new Map(prev).set(key, chunk))
              console.log('Loaded initial chunk:', { x, z, key })
            }
          }
        }
      }

      loadInitialChunks()
      console.log('Initial chunks loaded')
    } catch (err) {
      console.error('Error loading initial chunks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load initial chunks')
    }
  }, [worldGen])

  // Update chunks periodically
  useEffect(() => {
    if (error) return

    const update = () => {
      updateLoadedChunks()
      updateTimer.current = setTimeout(update, CHUNK_UPDATE_INTERVAL)
    }

    update()
    return () => {
      if (updateTimer.current) {
        clearTimeout(updateTimer.current)
      }
    }
  }, [updateLoadedChunks, error])

  if (error) {
    return (
      <group>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="red" />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      {Array.from(loadedChunks.entries()).map(([key, chunk]) => {
        const [x, z] = key.split(',').map(Number)
        return (
          <ChunkComponent
            key={key}
            chunk={chunk}
            position={new Vector3(x * CHUNK_SIZE, 0, z * CHUNK_SIZE)}
          />
        )
      })}
      <Player 
        worldGen={worldGen}
        onBlockPlace={(type, x, y, z) => {
          console.log('Block place event:', type, x, y, z)
          worldGen.setBlock(x, y, z, type)
        }}
        onBlockBreak={() => {
          // Handle block break sound
        }}
      />
      <PigManager worldGen={worldGen} maxPigs={5} spawnRadius={20} />
    </group>
  )
}

export default World 