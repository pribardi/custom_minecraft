import { Chunk, CHUNK_SIZE, WorldGenerator } from './worldGen'
import { Vector3, Box3, Frustum, Matrix4, InstancedMesh, BufferGeometry, Material, BufferAttribute } from 'three'
import { BlockType } from '../types/blocks'
import LRUCache from 'lru-cache'
import type { Options } from 'lru-cache'

// Constants for chunk management
const MAX_CHUNKS_IN_MEMORY = 512 // Maximum number of chunks to keep in memory
const MESH_CACHE_TTL = 2 * 60 * 1000 // 2 minutes TTL for unused meshes
const LOD_DISTANCES = [32, 64, 128, 256] // Distances for different LOD levels
const CHUNK_POOL_SIZE = 64 // Number of chunk meshes to keep in pool
const MAX_CONCURRENT_WORKERS = 4 // Maximum number of concurrent mesh generation workers
const PRIORITY_DISTANCE = 3 // High priority for chunks very close to player
const VIEW_CONE_ANGLE = Math.PI / 3 // 60 degrees view cone for prioritization

interface ChunkMeshData {
  geometry: BufferGeometry
  lodLevel: number
  lastUsed: number
}

interface WorkerMeshData {
  vertices: Float32Array
  indices: Uint32Array
  normals: Float32Array
  uvs: Float32Array
}

interface ChunkPriority {
  key: string
  priority: number
  distance: number
  lodLevel: number
}

export class ChunkManager {
  private chunkPool: LRUCache<string, ChunkMeshData>
  private activeChunks: Map<string, Chunk> = new Map()
  private frustum: Frustum = new Frustum()
  private projScreenMatrix: Matrix4 = new Matrix4()
  private instancedMeshes: Map<string, InstancedMesh> = new Map()
  private workers: Worker[] = []
  private workerQueue: { chunk: Chunk; lodLevel: number; resolve: (data: WorkerMeshData) => void }[] = []
  private activeWorkerCount = 0

  constructor(
    private worldGen: WorldGenerator,
    private viewDistance: number
  ) {
    const options: Options<string, ChunkMeshData> = {
      max: MAX_CHUNKS_IN_MEMORY,
      ttl: MESH_CACHE_TTL,
      updateAgeOnGet: true,
      dispose: (meshData: ChunkMeshData, key: string) => {
        console.log('Disposing chunk mesh:', key)
        if (meshData && meshData.geometry) {
          try {
            meshData.geometry.dispose()
          } catch (error) {
            console.error('Error disposing geometry:', error)
          }
        }
      }
    }
    
    this.chunkPool = new LRUCache(options)
    this.initializeWorkers()
    this.initializeInstancedMeshes()
  }

  private initializeWorkers() {
    for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
      const worker = new Worker(new URL('../workers/chunkWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<WorkerMeshData>) => {
        this.handleWorkerMessage(e.data)
        this.activeWorkerCount--
        this.processWorkerQueue()
      }
      this.workers.push(worker)
    }
  }

  private initializeInstancedMeshes() {
    // Initialize instanced meshes for each block type
    // This will be implemented when we have the block geometries and materials
  }

  private handleWorkerMessage(meshData: WorkerMeshData) {
    const geometry = new BufferGeometry()
    
    geometry.setAttribute('position', new BufferAttribute(meshData.vertices, 3))
    geometry.setAttribute('normal', new BufferAttribute(meshData.normals, 3))
    geometry.setAttribute('uv', new BufferAttribute(meshData.uvs, 2))
    geometry.setIndex(new BufferAttribute(meshData.indices, 1))
    
    return geometry
  }

  private processWorkerQueue() {
    while (this.activeWorkerCount < MAX_CONCURRENT_WORKERS && this.workerQueue.length > 0) {
      const task = this.workerQueue.shift()
      if (task) {
        this.activeWorkerCount++
        const worker = this.workers[this.activeWorkerCount % MAX_CONCURRENT_WORKERS]
        worker.postMessage({
          type: 'generateMesh',
          chunk: task.chunk,
          lodLevel: task.lodLevel
        })
      }
    }
  }

  private async generateChunkMesh(chunk: Chunk, lodLevel: number): Promise<BufferGeometry> {
    return new Promise((resolve) => {
      this.workerQueue.push({
        chunk: {
          ...chunk,
          position: chunk.position.map(pos => pos * CHUNK_SIZE) as [number, number], // Convert chunk position to world position
          blocks: chunk.blocks.map((yBlocks, x) =>
            yBlocks.map((zBlocks, y) =>
              zBlocks.map((block, z) => ({
                ...block,
                position: [
                  chunk.position[0] * CHUNK_SIZE + x,
                  y,
                  chunk.position[1] * CHUNK_SIZE + z
                ] // Convert local positions to world positions
              }))
            )
          )
        },
        lodLevel,
        resolve: (meshData) => {
          resolve(this.handleWorkerMessage(meshData))
        }
      })
      this.processWorkerQueue()
    })
  }

  private getChunkKey(x: number, z: number): string {
    return `${x},${z}`
  }

  private getLODLevel(distance: number): number {
    for (let i = 0; i < LOD_DISTANCES.length; i++) {
      if (distance <= LOD_DISTANCES[i]) return i
    }
    return LOD_DISTANCES.length
  }

  private updateFrustum(camera: THREE.Camera) {
    this.projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix)
  }

  private isChunkVisible(chunkX: number, chunkZ: number): boolean {
    const worldX = chunkX * CHUNK_SIZE
    const worldZ = chunkZ * CHUNK_SIZE
    const chunkBox = new Box3(
      new Vector3(worldX, 0, worldZ),
      new Vector3(worldX + CHUNK_SIZE, 256, worldZ + CHUNK_SIZE)
    )
    return this.frustum.intersectsBox(chunkBox)
  }

  private async optimizeChunkMesh(chunk: Chunk, lodLevel: number): Promise<ChunkMeshData> {
    const geometry = await this.generateChunkMesh(chunk, lodLevel)
    return {
      geometry,
      lodLevel,
      lastUsed: Date.now()
    }
  }

  private cleanupUnusedChunks() {
    // No need for manual cleanup as LRUCache handles it automatically
    console.log(`Active chunks in pool: ${this.chunkPool.size}`)
  }

  private calculateChunkPriority(chunkX: number, chunkZ: number, playerPosition: Vector3, cameraDirection: Vector3): ChunkPriority {
    const chunkCenter = new Vector3(
      chunkX * CHUNK_SIZE + CHUNK_SIZE / 2,
      0,
      chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2
    )
    
    // Calculate distance
    const distance = playerPosition.distanceTo(chunkCenter)
    
    // Calculate angle to camera direction
    const toChunk = chunkCenter.clone().sub(playerPosition).normalize()
    const angle = Math.acos(toChunk.dot(cameraDirection))
    
    // Calculate base priority
    let priority = 1.0
    
    // Distance priority
    if (distance < PRIORITY_DISTANCE * CHUNK_SIZE) {
      priority *= 2.0 // Double priority for very close chunks
    }
    
    // View direction priority
    if (angle < VIEW_CONE_ANGLE) {
      priority *= 1.5 // Higher priority for chunks in view direction
    }
    
    // Calculate LOD level
    const lodLevel = this.getLODLevel(distance)
    
    return {
      key: this.getChunkKey(chunkX, chunkZ),
      priority,
      distance,
      lodLevel
    }
  }

  async updateChunks(camera: THREE.Camera, playerPosition: Vector3) {
    this.updateFrustum(camera)
    const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE)
    const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE)
    
    const cameraDirection = new Vector3()
    camera.getWorldDirection(cameraDirection)
    cameraDirection.y = 0
    cameraDirection.normalize()

    // Calculate priorities for all chunks in range
    const chunkPriorities: ChunkPriority[] = []
    
    for (let x = -this.viewDistance; x <= this.viewDistance; x++) {
      for (let z = -this.viewDistance; z <= this.viewDistance; z++) {
        const chunkX = playerChunkX + x
        const chunkZ = playerChunkZ + z
        
        if (this.isChunkVisible(chunkX, chunkZ)) {
          const priority = this.calculateChunkPriority(chunkX, chunkZ, playerPosition, cameraDirection)
          chunkPriorities.push(priority)
        }
      }
    }
    
    // Sort chunks by priority
    chunkPriorities.sort((a, b) => b.priority - a.priority)
    
    const updatePromises: Promise<void>[] = []
    let processedCount = 0
    
    // Process chunks in priority order
    for (const { key, lodLevel } of chunkPriorities) {
      const [chunkX, chunkZ] = key.split(',').map(Number)
      
      // Get or generate chunk
      let chunk = this.activeChunks.get(key)
      if (!chunk) {
        chunk = this.worldGen.generateChunk(chunkX, chunkZ)
        this.activeChunks.set(key, chunk)
      }
      
      // Update mesh if needed
      let meshData = this.chunkPool.get(key)
      if (!meshData || meshData.lodLevel !== lodLevel || chunk.isDirty) {
        if (meshData) {
          meshData.geometry.dispose()
        }
        
        // Limit concurrent mesh updates
        if (processedCount < MAX_CONCURRENT_WORKERS) {
          updatePromises.push(
            this.optimizeChunkMesh(chunk, lodLevel).then(newMeshData => {
              this.chunkPool.set(key, newMeshData)
              chunk!.isDirty = false
            })
          )
          processedCount++
        }
      }
      
      // Break if we've reached our processing limit
      if (processedCount >= MAX_CONCURRENT_WORKERS) break
    }
    
    await Promise.all(updatePromises)
    this.cleanupUnusedChunks()
  }

  getChunkMesh(x: number, z: number): BufferGeometry | undefined {
    const key = this.getChunkKey(x, z)
    const meshData = this.chunkPool.get(key)
    console.log('Getting chunk mesh for:', key, 'Found:', !!meshData)
    return meshData?.geometry
  }

  setBlock(x: number, y: number, z: number, type: BlockType) {
    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    const key = this.getChunkKey(chunkX, chunkZ)

    // Update the block in the world
    this.worldGen.setBlock(x, y, z, type)

    // Mark chunk as dirty
    const chunk = this.activeChunks.get(key)
    if (chunk) {
      chunk.isDirty = true
    }

    // Mark neighboring chunks as dirty if block is on border
    const localX = x - chunkX * CHUNK_SIZE
    const localZ = z - chunkZ * CHUNK_SIZE

    if (localX === 0) {
      const neighborKey = this.getChunkKey(chunkX - 1, chunkZ)
      const neighborChunk = this.activeChunks.get(neighborKey)
      if (neighborChunk) neighborChunk.isDirty = true
    } else if (localX === CHUNK_SIZE - 1) {
      const neighborKey = this.getChunkKey(chunkX + 1, chunkZ)
      const neighborChunk = this.activeChunks.get(neighborKey)
      if (neighborChunk) neighborChunk.isDirty = true
    }

    if (localZ === 0) {
      const neighborKey = this.getChunkKey(chunkX, chunkZ - 1)
      const neighborChunk = this.activeChunks.get(neighborKey)
      if (neighborChunk) neighborChunk.isDirty = true
    } else if (localZ === CHUNK_SIZE - 1) {
      const neighborKey = this.getChunkKey(chunkX, chunkZ + 1)
      const neighborChunk = this.activeChunks.get(neighborKey)
      if (neighborChunk) neighborChunk.isDirty = true
    }
  }

  dispose() {
    // Cleanup all geometries
    if (this.chunkPool) {
      try {
        // Get all entries and dispose them properly
        for (const [key, meshData] of this.chunkPool.entries()) {
          if (meshData && meshData.geometry) {
            try {
              meshData.geometry.dispose()
            } catch (error) {
              console.error('Error disposing geometry:', error)
            }
          }
          this.chunkPool.delete(key)
        }
      } catch (error) {
        console.error('Error during ChunkManager disposal:', error)
      }

      // Reset the cache
      this.chunkPool = new LRUCache({
        max: MAX_CHUNKS_IN_MEMORY,
        ttl: MESH_CACHE_TTL
      })
    }
    
    this.activeChunks.clear()

    // Cleanup instanced meshes
    this.instancedMeshes.forEach(mesh => {
      try {
        if (mesh.geometry) mesh.geometry.dispose()
        if (mesh.material instanceof Material) {
          mesh.material.dispose()
        }
      } catch (error) {
        console.error('Error disposing mesh:', error)
      }
    })
    this.instancedMeshes.clear()

    // Terminate workers
    this.workers.forEach(worker => {
      try {
        worker.terminate()
      } catch (error) {
        console.error('Error terminating worker:', error)
      }
    })
    this.workers = []

    console.log('ChunkManager disposed')
  }

  getActiveChunks(): Map<string, Chunk> {
    return this.activeChunks
  }
} 