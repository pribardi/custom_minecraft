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

// Enhanced terrain generation parameters
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
  MOISTURE_SCALE: 300,
  RIVER_SCALE: 400,
  RIVER_THRESHOLD: 0.02,
  MOUNTAIN_THRESHOLD: 0.7,
  PLATEAU_THRESHOLD: 0.6,
  BEACH_SLOPE: 0.05,
  CLIFF_THRESHOLD: 0.8,
  EROSION_SCALE: 250,
} as const

// Enhanced biome definitions with proper types
interface BiomeParams {
  temperature: number
  moisture: number
  heightModifier: number
  roughness: number
  features: {
    trees: number
    rocks: number
    flowers: number
  }
}

const BIOMES: Record<string, BiomeParams> = {
  DESERT: {
    temperature: 0.8,
    moisture: 0.2,
    heightModifier: 0.7,
    roughness: 0.3,
    features: { trees: 0.01, rocks: 0.2, flowers: 0.05 }
  },
  SAVANNA: {
    temperature: 0.7,
    moisture: 0.3,
    heightModifier: 0.8,
    roughness: 0.4,
    features: { trees: 0.1, rocks: 0.1, flowers: 0.2 }
  },
  PLAINS: {
    temperature: 0.5,
    moisture: 0.4,
    heightModifier: 1.0,
    roughness: 0.2,
    features: { trees: 0.15, rocks: 0.05, flowers: 0.4 }
  },
  FOREST: {
    temperature: 0.5,
    moisture: 0.6,
    heightModifier: 1.1,
    roughness: 0.5,
    features: { trees: 0.6, rocks: 0.1, flowers: 0.3 }
  },
  RAINFOREST: {
    temperature: 0.6,
    moisture: 0.8,
    heightModifier: 1.2,
    roughness: 0.6,
    features: { trees: 0.8, rocks: 0.05, flowers: 0.5 }
  },
  MOUNTAINS: {
    temperature: 0.3,
    moisture: 0.5,
    heightModifier: 1.8,
    roughness: 0.9,
    features: { trees: 0.2, rocks: 0.8, flowers: 0.1 }
  },
  SNOWY_MOUNTAINS: {
    temperature: 0.1,
    moisture: 0.5,
    heightModifier: 1.6,
    roughness: 0.8,
    features: { trees: 0.1, rocks: 0.7, flowers: 0.05 }
  },
  TUNDRA: {
    temperature: 0.2,
    moisture: 0.3,
    heightModifier: 0.9,
    roughness: 0.4,
    features: { trees: 0.05, rocks: 0.3, flowers: 0.1 }
  },
  SWAMP: {
    temperature: 0.6,
    moisture: 0.7,
    heightModifier: 0.6,
    roughness: 0.3,
    features: { trees: 0.4, rocks: 0.1, flowers: 0.2 }
  },
  BEACH: {
    temperature: 0.6,
    moisture: 0.5,
    heightModifier: 0.2,
    roughness: 0.1,
    features: { trees: 0.05, rocks: 0.1, flowers: 0.1 }
  }
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

  private getBiome(temperature: number, moisture: number, height: number, slope: number): string {
    // Calculate slope-based features
    const isCliff = slope > TERRAIN_PARAMS.CLIFF_THRESHOLD
    const isBeach = height <= BEACH_LEVEL + 2 && height > WATER_LEVEL - 1

    // Special biome cases
    if (isBeach) return 'BEACH'
    if (isCliff && height > 80) return 'MOUNTAINS'

    // Temperature-based biome selection with moisture influence
    if (temperature > 0.7) {
      return moisture < 0.3 ? 'DESERT' : 'SAVANNA'
    } else if (temperature < 0.2) {
      return height > 70 ? 'SNOWY_MOUNTAINS' : 'TUNDRA'
    } else if (temperature < 0.4) {
      return height > 90 ? 'MOUNTAINS' : 'PLAINS'
    }

    // Moisture-based biome selection
    if (moisture > 0.7) {
      return temperature > 0.5 ? 'RAINFOREST' : 'FOREST'
    } else if (moisture > 0.6) {
      return height < WATER_LEVEL + 5 ? 'SWAMP' : 'FOREST'
    }

    return 'PLAINS'
  }

  private getHeight(x: number, z: number, biome: string): number {
    const nx = x / TERRAIN_PARAMS.SCALE
    const nz = z / TERRAIN_PARAMS.SCALE
    
    // Base terrain noise with multiple octaves
    let baseNoise = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0
    
    for (let i = 0; i < 4; i++) {
      baseNoise += this.noise2D(nx * frequency, nz * frequency) * amplitude
      maxValue += amplitude
      amplitude *= 0.5
      frequency *= 2
    }
    baseNoise /= maxValue

    // Mountain noise with ridged multifractal
    const mnx = x / (TERRAIN_PARAMS.SCALE * 1.5)
    const mnz = z / (TERRAIN_PARAMS.SCALE * 1.5)
    let mountainNoise = 0
    amplitude = 1
    frequency = 1
    maxValue = 0
    
    for (let i = 0; i < 3; i++) {
      const n = Math.abs(this.mountainNoise2D(mnx * frequency, mnz * frequency))
      mountainNoise += (1 - n) * amplitude
      maxValue += amplitude
      amplitude *= 0.5
      frequency *= 2
    }
    mountainNoise /= maxValue

    // River noise
    const riverNoise = Math.abs(this.noise2D(x / TERRAIN_PARAMS.RIVER_SCALE, z / TERRAIN_PARAMS.RIVER_SCALE))
    const isRiver = riverNoise < TERRAIN_PARAMS.RIVER_THRESHOLD

    // Erosion noise for terrain roughness
    const erosionNoise = (this.noise2D(x / TERRAIN_PARAMS.EROSION_SCALE, z / TERRAIN_PARAMS.EROSION_SCALE) + 1) * 0.5

    // Get biome parameters
    const biomeParams = BIOMES[biome]
    const heightModifier = biomeParams.heightModifier
    const roughness = biomeParams.roughness

    // Calculate final height
    let height = baseNoise * TERRAIN_PARAMS.HEIGHT * heightModifier
    height += mountainNoise * TERRAIN_PARAMS.HEIGHT * TERRAIN_PARAMS.MOUNTAIN_SCALE * heightModifier
    height *= 1 + (erosionNoise * roughness)

    // Apply river carving
    if (isRiver && height > WATER_LEVEL) {
      height = Math.min(height, WATER_LEVEL + 1)
    }

    // Ensure minimum height and apply base height
    height = Math.max(TERRAIN_PARAMS.BASE_HEIGHT, height)

    // Round to integer
    return Math.floor(height)
  }

  private shouldGenerateCave(x: number, y: number, z: number): boolean {
    const value = this.caveNoise(
      x * TERRAIN_PARAMS.CAVE_DENSITY,
      y * TERRAIN_PARAMS.CAVE_DENSITY,
      z * TERRAIN_PARAMS.CAVE_DENSITY
    )
    return value > TERRAIN_PARAMS.CAVE_THRESHOLD
  }

  private generateFeatures(chunk: Chunk): void {
    const { blocks, biomeMap } = chunk
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const biome = biomeMap[x][z]
        const biomeParams = BIOMES[biome]
        
        // Find surface height
        let surfaceY = WORLD_HEIGHT - 1
        while (surfaceY > 0 && blocks[x][surfaceY][z].type === 'AIR') {
          surfaceY--
        }
        
        // Skip water blocks
        if (blocks[x][surfaceY][z].type === 'WATER') continue
        
        // Generate features based on biome parameters
        const featureNoise = this.noise3D(
          (chunk.position[0] * CHUNK_SIZE + x) / 10,
          surfaceY / 10,
          (chunk.position[1] * CHUNK_SIZE + z) / 10
        )
        
        // Trees
        if (featureNoise > 1 - biomeParams.features.trees) {
          this.generateTree(blocks, x, surfaceY + 1, z, biome)
        }
        
        // Rocks
        else if (featureNoise > 1 - biomeParams.features.rocks - biomeParams.features.trees) {
          this.generateRock(blocks, x, surfaceY + 1, z)
        }
        
        // Flowers
        else if (featureNoise > 1 - biomeParams.features.flowers - biomeParams.features.rocks - biomeParams.features.trees) {
          this.generateFlower(blocks, x, surfaceY + 1, z, biome)
        }
      }
    }
  }

  private generateTree(blocks: Block[][][], x: number, y: number, z: number, biome: string): void {
    // Skip if too close to chunk edge
    if (x < 2 || x > CHUNK_SIZE - 3 || z < 2 || z > CHUNK_SIZE - 3) return
    
    const height = biome === 'RAINFOREST' ? 
      8 + Math.floor(Math.random() * 4) : 
      5 + Math.floor(Math.random() * 3)
    
    // Generate trunk
    for (let dy = 0; dy < height; dy++) {
      if (y + dy >= WORLD_HEIGHT) break
      blocks[x][y + dy][z].type = 'WOOD'
    }
    
    // Generate leaves
    const leafStart = height - 3
    const leafRadius = biome === 'RAINFOREST' ? 3 : 2
    
    for (let dy = leafStart; dy < height + 1; dy++) {
      if (y + dy >= WORLD_HEIGHT) break
      const radius = dy === height ? 1 : leafRadius
      
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const lx = x + dx
          const ly = y + dy
          const lz = z + dz
          
          if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= WORLD_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) continue
          
          const distance = Math.sqrt(dx * dx + dz * dz)
          if (distance <= radius + 0.5 && blocks[lx][ly][lz].type === 'AIR') {
            blocks[lx][ly][lz].type = 'LEAVES'
          }
        }
      }
    }
  }

  private generateRock(blocks: Block[][][], x: number, y: number, z: number): void {
    // Skip if too close to chunk edge
    if (x < 1 || x > CHUNK_SIZE - 2 || z < 1 || z > CHUNK_SIZE - 2) return
    
    const size = 1 + Math.floor(Math.random() * 2)
    
    for (let dx = -size; dx <= size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        for (let dz = -size; dz <= size; dz++) {
          const rx = x + dx
          const ry = y + dy
          const rz = z + dz
          
          if (rx < 0 || rx >= CHUNK_SIZE || ry < 0 || ry >= WORLD_HEIGHT || rz < 0 || rz >= CHUNK_SIZE) continue
          
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (distance <= size && blocks[rx][ry][rz].type === 'AIR') {
            blocks[rx][ry][rz].type = 'STONE'
          }
        }
      }
    }
  }

  private generateFlower(blocks: Block[][][], x: number, y: number, z: number, biome: string): void {
    if (y < 0 || y >= WORLD_HEIGHT) return
    
    // For now, just place a single flower block
    // In the future, this could be expanded to different flower types
    blocks[x][y][z].type = 'GRASS' // Replace with 'FLOWER' type when available
  }

  public generateChunk(chunkX: number, chunkZ: number): Chunk {
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
        const biome = this.getBiome(temperatureMap[localX][localZ], moistureMap[localX][localZ], 0, 0)
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

    // Generate features
    this.generateFeatures(chunk)

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