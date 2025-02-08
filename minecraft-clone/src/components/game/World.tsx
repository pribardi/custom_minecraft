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
  const [chunks, setChunks] = useState<Map<string, Chunk>>(new Map())
  const [loadedChunks, setLoadedChunks] = useState<Set<string>>(new Set())
  const [pendingChunks, setPendingChunks] = useState<string[]>([])
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const cameraPosition = useRef<[number, number, number]>([0, 0, 0])
  const lastUpdatePosition = useRef<[number, number, number]>([0, 0, 0])
  const dirtyChunks = useRef(new Set<string>())
  const chunkCache = useRef<ChunkCache>({})
  const { scene } = useThree()

  // Get chunk coordinates from world position
  const getChunkCoords = (x: number, z: number): [number, number] => {
    return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)]
  }

  // Get visible chunk keys based on camera position and render distance
  const getVisibleChunkKeys = useCallback((position: [number, number, number], renderDistance: number): string[] => {
    const [chunkX, chunkZ] = getChunkCoords(position[0], position[2])
    const chunkDistances: { key: string; distance: number }[] = []

    // Calculate chunks in a square pattern for better coverage
    for (let x = -renderDistance; x <= renderDistance; x++) {
      for (let z = -renderDistance; z <= renderDistance; z++) {
        const distance = Math.sqrt(x * x + z * z)
        if (distance <= renderDistance) {
          const key = `${chunkX + x},${chunkZ + z}`
          chunkDistances.push({
            key,
            distance: distance
          })
        }
      }
    }

    // Sort chunks by distance and whether they're in force load radius
    chunkDistances.sort((a, b) => {
      const aInForceRadius = a.distance <= FORCE_LOAD_RADIUS
      const bInForceRadius = b.distance <= FORCE_LOAD_RADIUS
      if (aInForceRadius !== bInForceRadius) {
        return aInForceRadius ? -1 : 1
      }
      return a.distance - b.distance
    })

    return chunkDistances.map(c => c.key)
  }, [])

  // Process pending chunks with priority
  const processPendingChunks = useCallback(() => {
    if (pendingChunks.length === 0) return

    const chunksToProcess = pendingChunks.slice(0, MAX_CHUNKS_PER_FRAME)
    const remainingChunks = pendingChunks.slice(MAX_CHUNKS_PER_FRAME)

    chunksToProcess.forEach(key => {
      const [x, z] = key.split(',').map(Number)
      const chunk = worldGen.generateChunk(x, z)
      setChunks(prev => new Map(prev).set(key, chunk))
      setLoadedChunks(prev => new Set(prev).add(key))
    })

    setPendingChunks(remainingChunks)
  }, [pendingChunks])

  // Update chunks based on camera position
  const updateChunks = useCallback(() => {
    const [x, y, z] = cameraPosition.current
    const renderDist = isInitialLoad ? INITIAL_RENDER_DISTANCE : RENDER_DISTANCE
    const visibleKeys = getVisibleChunkKeys([x, y, z], renderDist)

    // Add new chunks to pending list
    const newPendingChunks = visibleKeys.filter(key => 
      !loadedChunks.has(key) && !pendingChunks.includes(key)
    )

    if (newPendingChunks.length > 0) {
      setPendingChunks(prev => [...prev, ...newPendingChunks])
    }

    // Unload distant chunks
    setChunks(prev => {
      const newChunks = new Map(prev)
      for (const [key, chunk] of prev.entries()) {
        const [cx, cz] = key.split(',').map(Number)
        const distance = Math.sqrt(
          Math.pow((cx * CHUNK_SIZE) - x, 2) +
          Math.pow((cz * CHUNK_SIZE) - z, 2)
        )
        if (distance > CHUNK_UNLOAD_DISTANCE) {
          newChunks.delete(key)
          setLoadedChunks(prev => {
            const newLoaded = new Set(prev)
            newLoaded.delete(key)
            return newLoaded
          })
        }
      }
      return newChunks
    })

    if (isInitialLoad && loadedChunks.size >= Math.pow(INITIAL_RENDER_DISTANCE * 2 + 1, 2)) {
      setIsInitialLoad(false)
    }
  }, [getVisibleChunkKeys, loadedChunks, pendingChunks, isInitialLoad])

  // Update camera position
  const onCameraMove = useCallback((position: [number, number, number]) => {
    cameraPosition.current = position
    const [lastX, lastY, lastZ] = lastUpdatePosition.current
    const [x, y, z] = position
    
    // Check if camera has moved enough to trigger update
    const distance = Math.sqrt(
      Math.pow(x - lastX, 2) +
      Math.pow(y - lastY, 2) +
      Math.pow(z - lastZ, 2)
    )
    
    if (distance > CHUNK_SIZE / 4) {
      lastUpdatePosition.current = position
      updateChunks()
    }
  }, [updateChunks])

  // Process chunks periodically
  useEffect(() => {
    const interval = setInterval(processPendingChunks, CHUNK_UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [processPendingChunks])

  // Initial load
  useEffect(() => {
    updateChunks()
  }, [updateChunks])

  // Handle block updates immediately
  const handleBlockUpdate = useCallback((x: number, y: number, z: number) => {
    console.log('World - Handling block update at:', x, y, z)
    const [chunkX, chunkZ] = getChunkCoords(x, z)
    const chunkKey = `${chunkX},${chunkZ}`
    console.log('World - Chunk coordinates:', chunkX, chunkZ)
    
    // Get the current chunk
    const chunk = worldGen.getChunk(chunkX, chunkZ)
    if (chunk) {
      console.log('World - Found chunk, updating...')
      // Update chunks state to trigger re-render
      setChunks(prev => {
        const newChunks = new Map(prev)
        newChunks.set(chunkKey, {
          ...chunk,
          isDirty: true,
          position: [chunkX, chunkZ]
        })

        // Check if we need to update neighboring chunks
        const chunkLocalX = x - chunkX * CHUNK_SIZE
        const chunkLocalZ = z - chunkZ * CHUNK_SIZE
        console.log('World - Local coordinates in chunk:', chunkLocalX, chunkLocalZ)

        // Update neighboring chunks if block is on a border
        if (chunkLocalX === 0) {
          console.log('World - Updating chunk to the left')
          const neighborChunk = worldGen.getChunk(chunkX - 1, chunkZ)
          if (neighborChunk) {
            newChunks.set(`${chunkX - 1},${chunkZ}`, {
              ...neighborChunk,
              isDirty: true,
              position: [chunkX - 1, chunkZ]
            })
          }
        } else if (chunkLocalX === CHUNK_SIZE - 1) {
          console.log('World - Updating chunk to the right')
          const neighborChunk = worldGen.getChunk(chunkX + 1, chunkZ)
          if (neighborChunk) {
            newChunks.set(`${chunkX + 1},${chunkZ}`, {
              ...neighborChunk,
              isDirty: true,
              position: [chunkX + 1, chunkZ]
            })
          }
        }

        if (chunkLocalZ === 0) {
          console.log('World - Updating chunk to the back')
          const neighborChunk = worldGen.getChunk(chunkX, chunkZ - 1)
          if (neighborChunk) {
            newChunks.set(`${chunkX},${chunkZ - 1}`, {
              ...neighborChunk,
              isDirty: true,
              position: [chunkX, chunkZ - 1]
            })
          }
        } else if (chunkLocalZ === CHUNK_SIZE - 1) {
          console.log('World - Updating chunk to the front')
          const neighborChunk = worldGen.getChunk(chunkX, chunkZ + 1)
          if (neighborChunk) {
            newChunks.set(`${chunkX},${chunkZ + 1}`, {
              ...neighborChunk,
              isDirty: true,
              position: [chunkX, chunkZ + 1]
            })
          }
        }

        return newChunks
      })
    } else {
      console.log('World - No chunk found for coordinates:', chunkX, chunkZ)
    }
  }, [worldGen])

  return (
    <>
      {Array.from(chunks.values()).map(chunk => (
        <ChunkComponent 
          key={`${chunk.position[0]},${chunk.position[1]}`} 
          chunk={chunk} 
        />
      ))}
      <Player 
        worldGen={worldGen}
        onBlockPlace={(type, x, y, z) => {
          console.log('Block place event:', type, x, y, z)
          worldGen.setBlock(x, y, z, type)
          handleBlockUpdate(x, y, z)
        }}
        onBlockBreak={() => {
          // Handle block break sound
        }}
      />
      <PigManager worldGen={worldGen} maxPigs={5} spawnRadius={20} />
    </>
  )
}

export default World 