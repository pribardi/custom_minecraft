import { createNoise2D, createNoise3D } from 'simplex-noise'
import LRUCache from 'lru-cache'
import type { Options } from 'lru-cache'

export type BlockType = 'AIR' | 'GRASS' | 'DIRT' | 'STONE' | 'WOOD' | 'LEAVES' | 'SWORD' | 'WATER' | 'SAND'

export interface Block {
  type: BlockType
  position: [number, number, number]
  metadata?: {
    moisture?: number
    temperature?: number
    hardness?: number
  }
}

export interface Chunk {
  position: [number, number]
  blocks: Block[][][]
  isDirty: boolean
  lastAccessed: number
  isGenerated: boolean
  heightMap: number[][]  // Store height data for faster access
  biomeMap: string[][]   // Store biome data
}

// Constants for world generation
export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 256
const CACHE_SIZE = 512 // Number of chunks to keep in memory
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes TTL for unused chunks
const WATER_LEVEL = 32
const BEACH_LEVEL = WATER_LEVEL + 2

// Terrain generation parameters with better defaults
const TERRAIN_PARAMS = {
  SCALE: 150.0,
  HEIGHT: 48,
  DIRT_DEPTH: 4,
  MOUNTAIN_SCALE: 0.8,
  PLATEAU_SCALE: 0.4,
  BASE_HEIGHT: 5,
  CAVE_DENSITY: 0.03,
  CAVE_THRESHOLD: 0.3,
  TEMPERATURE_SCALE: 200,
  MOISTURE_SCALE: 300
} as const

// Biome definitions with proper types
interface BiomeParams {
  temperature: number
  moisture: number
}

const BIOMES: Record<string, BiomeParams> = {
  DESERT: { temperature: 0.7, moisture: 0.3 },
  PLAINS: { temperature: 0.5, moisture: 0.4 },
  FOREST: { temperature: 0.5, moisture: 0.6 },
  MOUNTAINS: { temperature: 0.3, moisture: 0.5 },
  TUNDRA: { temperature: 0.2, moisture: 0.3 }
} as const

export class WorldGenerator {
  private chunks: LRUCache<string, Chunk>
  private noise2D = createNoise2D()
  private noise3D = createNoise3D()
  private treeNoise2D = createNoise2D()
  private mountainNoise2D = createNoise2D()
  private plateauNoise2D = createNoise2D()
  private temperatureNoise = createNoise2D()
  private moistureNoise = createNoise2D()
  private caveNoise = createNoise3D()

  constructor() {
    const options: Options<string, Chunk> = {
      max: CACHE_SIZE,
      ttl: CACHE_TTL,
      updateAgeOnGet: true,
      dispose: (chunk: Chunk, key: string) => {
        console.log(`Disposing chunk at ${key}`)
        // Clean up any resources associated with the chunk
        if (chunk && Array.isArray(chunk.blocks)) {
          chunk.blocks = []
          chunk.heightMap = []
          chunk.biomeMap = []
          chunk.isDirty = false
          chunk.isGenerated = false
        }
      }
    }
    
    this.chunks = new LRUCache(options)
  }

  private getChunkKey(x: number, z: number): string {
    return `${x},${z}`
  }

  private getBiome(temperature: number, moisture: number): string {
    // Determine biome based on temperature and moisture
    if (temperature > BIOMES.DESERT.temperature && moisture < BIOMES.DESERT.moisture) {
      return 'DESERT'
    } else if (temperature < BIOMES.TUNDRA.temperature) {
      return 'TUNDRA'
    } else if (moisture > BIOMES.FOREST.moisture) {
      return 'FOREST'
    } else if (temperature > BIOMES.MOUNTAINS.temperature && moisture > BIOMES.MOUNTAINS.moisture) {
      return 'MOUNTAINS'
    }
    return 'PLAINS'
  }

  private getHeight(x: number, z: number, biome: string): number {
    const nx = x / TERRAIN_PARAMS.SCALE
    const nz = z / TERRAIN_PARAMS.SCALE
    
    // Base terrain noise
    let baseNoise = (this.noise2D(nx, nz) + 1) * 0.5

    // Mountain noise with larger scale
    const mnx = x / (TERRAIN_PARAMS.SCALE * 1.5)
    const mnz = z / (TERRAIN_PARAMS.SCALE * 1.5)
    let mountainNoiseValue = Math.pow(Math.max(0, this.mountainNoise2D(mnx, mnz)), 1.5)

    // Plateau noise
    const px = x / (TERRAIN_PARAMS.SCALE * 2)
    const pz = z / (TERRAIN_PARAMS.SCALE * 2)
    let plateauNoiseValue = (this.plateauNoise2D(px, pz) + 1) * 0.5

    // Apply biome-specific modifications
    switch (biome) {
      case 'MOUNTAINS':
        baseNoise *= 1.5
        mountainNoiseValue *= 2
        break
      case 'DESERT':
        plateauNoiseValue *= 1.2
        baseNoise *= 0.8
        break
      case 'TUNDRA':
        baseNoise *= 0.7
        break
      case 'FOREST':
        baseNoise *= 1.1
        break
    }

    // Combine different noise layers
    const baseHeight = TERRAIN_PARAMS.BASE_HEIGHT + baseNoise * TERRAIN_PARAMS.HEIGHT
    const mountainHeight = mountainNoiseValue * TERRAIN_PARAMS.HEIGHT * TERRAIN_PARAMS.MOUNTAIN_SCALE
    const plateauHeight = plateauNoiseValue * TERRAIN_PARAMS.HEIGHT * TERRAIN_PARAMS.PLATEAU_SCALE

    return Math.floor(Math.max(
      TERRAIN_PARAMS.BASE_HEIGHT,
      baseHeight + mountainHeight + plateauHeight
    ))
  }

  private shouldGenerateCave(x: number, y: number, z: number): boolean {
    const value = this.caveNoise(
      x * TERRAIN_PARAMS.CAVE_DENSITY,
      y * TERRAIN_PARAMS.CAVE_DENSITY,
      z * TERRAIN_PARAMS.CAVE_DENSITY
    )
    return value > TERRAIN_PARAMS.CAVE_THRESHOLD
  }

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    console.time(`generateChunk-${chunkX},${chunkZ}`)
    
    const chunk: Chunk = {
      position: [chunkX, chunkZ],
      blocks: Array(CHUNK_SIZE).fill(null).map(() =>
        Array(WORLD_HEIGHT).fill(null).map(() =>
          Array(CHUNK_SIZE).fill(null)
        )
      ),
      isDirty: false,
      lastAccessed: Date.now(),
      isGenerated: true,
      heightMap: Array(CHUNK_SIZE).fill(null).map(() => Array(CHUNK_SIZE).fill(0)),
      biomeMap: Array(CHUNK_SIZE).fill(null).map(() => Array(CHUNK_SIZE).fill('PLAINS'))
    }

    // Generate temperature and moisture maps first
    const temperatureMap: number[][] = []
    const moistureMap: number[][] = []

    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      temperatureMap[localX] = []
      moistureMap[localX] = []
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
        const worldX = chunkX * CHUNK_SIZE + localX
        const worldZ = chunkZ * CHUNK_SIZE + localZ
        
        temperatureMap[localX][localZ] = (this.temperatureNoise(worldX / TERRAIN_PARAMS.TEMPERATURE_SCALE, worldZ / TERRAIN_PARAMS.TEMPERATURE_SCALE) + 1) * 0.5
        moistureMap[localX][localZ] = (this.moistureNoise(worldX / TERRAIN_PARAMS.MOISTURE_SCALE, worldZ / TERRAIN_PARAMS.MOISTURE_SCALE) + 1) * 0.5
      }
    }

    // Generate terrain
    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
        const worldX = chunkX * CHUNK_SIZE + localX
        const worldZ = chunkZ * CHUNK_SIZE + localZ

        // Determine biome
        const biome = this.getBiome(temperatureMap[localX][localZ], moistureMap[localX][localZ])
        chunk.biomeMap[localX][localZ] = biome

        // Get terrain height
        const height = this.getHeight(worldX, worldZ, biome)
        chunk.heightMap[localX][localZ] = height

        // Generate terrain layers
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let blockType: BlockType = 'AIR'
          
          // Cave generation
          const isCave = this.shouldGenerateCave(worldX, y, worldZ)
          
          if (!isCave) {
            if (y === 0) {
              blockType = 'STONE' // Bedrock layer
            } else if (y < height - TERRAIN_PARAMS.DIRT_DEPTH) {
              blockType = 'STONE'
            } else if (y < height) {
              blockType = 'DIRT'
            } else if (y === height) {
              // Surface block based on biome
              switch (biome) {
                case 'DESERT':
                  blockType = 'SAND'
                  break
                case 'TUNDRA':
                  blockType = height <= WATER_LEVEL + 1 ? 'DIRT' : 'GRASS'
                  break
                default:
                  blockType = height <= WATER_LEVEL + 1 ? 'SAND' : 'GRASS'
              }
            } else if (y <= WATER_LEVEL && y > height) {
              blockType = 'WATER'
            }
          }

          chunk.blocks[localX][y][localZ] = {
            type: blockType,
            position: [localX, y, localZ], // Store local position within chunk
            metadata: {
              temperature: temperatureMap[localX][localZ],
              moisture: moistureMap[localX][localZ]
            }
          }
        }
      }
    }

    // Cache the generated chunk
    this.chunks.set(this.getChunkKey(chunkX, chunkZ), chunk)
    
    console.timeEnd(`generateChunk-${chunkX},${chunkZ}`)
    return chunk
  }

  getChunk(chunkX: number, chunkZ: number): Chunk | undefined {
    const key = this.getChunkKey(chunkX, chunkZ)
    let chunk = this.chunks.get(key)
    
    if (!chunk || !chunk.blocks || !Array.isArray(chunk.blocks)) {
      chunk = this.generateChunk(chunkX, chunkZ)
      this.chunks.set(key, chunk)
      console.log(`Generated and cached new chunk at ${key}`)
    }

    return chunk
  }

  getBlock(x: number, y: number, z: number): Block | undefined {
    if (y < 0 || y >= WORLD_HEIGHT) return undefined

    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    const chunk = this.getChunk(chunkX, chunkZ)

    if (!chunk) return undefined

    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

    return chunk.blocks[localX][y][localZ]
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (y < 0 || y >= WORLD_HEIGHT) return

    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    
    let chunk = this.getChunk(chunkX, chunkZ)
    if (!chunk) {
      chunk = this.generateChunk(chunkX, chunkZ)
    }

    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

    if (chunk.blocks[localX] && chunk.blocks[localX][y] && chunk.blocks[localX][y][localZ]) {
      chunk.blocks[localX][y][localZ] = {
        type,
        position: [x, y, z],
        metadata: chunk.blocks[localX][y][localZ].metadata
      }
      chunk.isDirty = true
      
      // Update height map if necessary
      if (type !== 'AIR' && y > chunk.heightMap[localX][localZ]) {
        chunk.heightMap[localX][localZ] = y
      } else if (type === 'AIR' && y === chunk.heightMap[localX][localZ]) {
        // Recalculate height map for this column
        for (let ny = y; ny >= 0; ny--) {
          if (chunk.blocks[localX][ny][localZ].type !== 'AIR') {
            chunk.heightMap[localX][localZ] = ny
            break
          }
        }
      }
    }
  }

  // Clean up resources
  dispose(): void {
    console.log('Disposing WorldGenerator')
    if (this.chunks) {
      try {
        // Get all entries and dispose them properly
        for (const [key, chunk] of this.chunks.entries()) {
          if (chunk && Array.isArray(chunk.blocks)) {
            chunk.blocks = []
            chunk.heightMap = []
            chunk.biomeMap = []
            chunk.isDirty = false
            chunk.isGenerated = false
          }
          this.chunks.delete(key)
        }
      } catch (error) {
        console.error('Error during WorldGenerator disposal:', error)
      }
      
      // Reset the cache
      this.chunks = new LRUCache({
        max: CACHE_SIZE,
        ttl: CACHE_TTL
      })
    }
  }
} 