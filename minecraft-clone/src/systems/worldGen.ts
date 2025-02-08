import { createNoise2D } from 'simplex-noise'

export type BlockType = 'AIR' | 'GRASS' | 'DIRT' | 'STONE' | 'WOOD' | 'LEAVES' | 'SWORD'

export interface Block {
  type: BlockType
  position: [number, number, number]
}

export interface Chunk {
  position: [number, number]  // x, z coordinates of chunk
  blocks: Block[][][]        // 3D array of blocks
  isDirty: boolean          // Flag to indicate if chunk needs updating
}

export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 256

// Terrain generation parameters
const TERRAIN_SCALE = 150.0  // Increased for wider, smoother terrain
const TERRAIN_HEIGHT = 48    // Adjusted for better visibility
const DIRT_DEPTH = 4        // Slightly reduced
const MOUNTAIN_SCALE = 0.8   // Increased for more dramatic mountains
const PLATEAU_SCALE = 0.4    // Increased for more noticeable plateaus
const BASE_HEIGHT = 5       // Minimum terrain height

export class WorldGenerator {
  private chunks: Map<string, Chunk> = new Map()
  private noise2D = createNoise2D()
  private treeNoise2D = createNoise2D()
  private mountainNoise2D = createNoise2D()
  private plateauNoise2D = createNoise2D()
  private treeTypeNoise2D = createNoise2D()

  // Tree generation parameters
  private readonly TREE_FREQUENCY = 0.05 // Increased from 0.02
  private readonly MIN_TREE_HEIGHT = 4
  private readonly MAX_TREE_HEIGHT = 8 // Increased from 7
  private readonly TREE_SPACING = 4 // Reduced from 5
  private readonly TREE_TYPES = {
    OAK: {
      minHeight: 4,
      maxHeight: 6,
      leafRadius: 2,
      leafHeight: 3,
      chance: 0.6
    },
    BIRCH: {
      minHeight: 5,
      maxHeight: 8,
      leafRadius: 1.5,
      leafHeight: 4,
      chance: 0.3
    },
    PINE: {
      minHeight: 6,
      maxHeight: 10,
      leafRadius: 1,
      leafHeight: 5,
      chance: 0.1
    }
  }

  private getChunkKey(x: number, z: number): string {
    return `${x},${z}`
  }

  private getHeight(x: number, z: number): number {
    // Base terrain noise
    const nx = x / TERRAIN_SCALE
    const nz = z / TERRAIN_SCALE
    const baseNoise = (this.noise2D(nx, nz) + 1) * 0.5

    // Mountain noise with larger scale
    const mnx = x / (TERRAIN_SCALE * 1.5)
    const mnz = z / (TERRAIN_SCALE * 1.5)
    const mountainNoise = Math.pow(Math.max(0, this.mountainNoise2D(mnx, mnz)), 1.5)

    // Plateau noise with medium scale
    const px = x / (TERRAIN_SCALE * 2)
    const pz = z / (TERRAIN_SCALE * 2)
    const plateauNoise = (this.plateauNoise2D(px, pz) + 1) * 0.5

    // Combine different noise layers
    const baseHeight = BASE_HEIGHT + baseNoise * TERRAIN_HEIGHT
    const mountainHeight = mountainNoise * TERRAIN_HEIGHT * MOUNTAIN_SCALE
    const plateauHeight = plateauNoise * TERRAIN_HEIGHT * PLATEAU_SCALE

    // Blend the different height components
    const finalHeight = Math.max(
      BASE_HEIGHT,
      baseHeight + mountainHeight + plateauHeight
    )

    return Math.floor(finalHeight)
  }

  private generateTree(x: number, y: number, z: number): void {
    // Use noise to determine tree type
    const treeTypeNoise = this.treeTypeNoise2D(x / 100, z / 100)
    let treeType = this.TREE_TYPES.OAK
    
    if (treeTypeNoise > 0.6) {
      treeType = this.TREE_TYPES.PINE
    } else if (treeTypeNoise > 0.3) {
      treeType = this.TREE_TYPES.BIRCH
    }

    // Generate random tree height within type constraints
    const height = Math.floor(
      treeType.minHeight + 
      Math.random() * (treeType.maxHeight - treeType.minHeight)
    )

    // Generate trunk
    for (let i = 0; i < height; i++) {
      this.setBlock(x, y + i, z, 'WOOD')
    }

    // Generate leaves based on tree type
    const leafStart = height - treeType.leafHeight
    const leafEnd = height + 1

    for (let ly = leafStart; ly <= leafEnd; ly++) {
      // Radius decreases as we go up
      const levelProgress = (ly - leafStart) / (leafEnd - leafStart)
      const radius = Math.ceil(treeType.leafRadius * (1 - levelProgress * 0.5))

      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          // Skip if it's too far from the trunk (makes the tree more round)
          if (Math.sqrt(lx * lx + lz * lz) > radius + 0.5) continue
          
          // Don't override trunk blocks
          if (ly < height && lx === 0 && lz === 0) continue

          // Add some randomness to leaf placement
          if (Math.random() > 0.8) continue

          this.setBlock(x + lx, y + ly, z + lz, 'LEAVES')
        }
      }
    }
  }

  private shouldGenerateTree(x: number, z: number): boolean {
    // Use multiple noise values for more natural distribution
    const baseNoise = this.treeNoise2D(x / 100, z / 100)
    const detailNoise = this.treeNoise2D(x / 30, z / 30)
    
    return (
      baseNoise > 0.6 && // Base noise threshold
      detailNoise > 0.5 && // Detail noise for variation
      Math.random() < this.TREE_FREQUENCY && // Random chance
      x % this.TREE_SPACING === 0 && // Grid spacing
      z % this.TREE_SPACING === 0
    )
  }

  generateChunk(chunkX: number, chunkZ: number): Chunk {
    const chunk: Chunk = {
      position: [chunkX, chunkZ],
      blocks: Array(CHUNK_SIZE).fill(null).map(() =>
        Array(WORLD_HEIGHT).fill(null).map(() =>
          Array(CHUNK_SIZE).fill(null)
        )
      ),
      isDirty: false
    }

    // Generate terrain
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x
        const worldZ = chunkZ * CHUNK_SIZE + z
        const height = this.getHeight(worldX, worldZ)

        // Ensure we generate from bottom up
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let blockType: BlockType = 'AIR'
          
          if (y === 0) {
            blockType = 'STONE' // Bedrock layer
          } else if (y < height - DIRT_DEPTH) {
            blockType = 'STONE'
          } else if (y < height) {
            blockType = 'DIRT'
          } else if (y === height) {
            blockType = 'GRASS'
          }

          chunk.blocks[x][y][z] = {
            type: blockType,
            position: [worldX, y, worldZ]
          }
        }

        // Generate trees on grass blocks with better height check
        if (this.shouldGenerateTree(worldX, worldZ)) {
          const surfaceHeight = height
          if (surfaceHeight > BASE_HEIGHT && surfaceHeight + this.MAX_TREE_HEIGHT + 2 < WORLD_HEIGHT) {
            this.generateTree(worldX, surfaceHeight + 1, worldZ)
          }
        }
      }
    }

    this.chunks.set(this.getChunkKey(chunkX, chunkZ), chunk)
    return chunk
  }

  getChunk(chunkX: number, chunkZ: number): Chunk | undefined {
    const key = this.getChunkKey(chunkX, chunkZ)
    let chunk = this.chunks.get(key)
    
    if (!chunk) {
      chunk = this.generateChunk(chunkX, chunkZ)
    }

    return chunk
  }

  getBlock(x: number, y: number, z: number): Block | undefined {
    if (y < 0 || y >= WORLD_HEIGHT) return undefined

    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    const chunk = this.getChunk(chunkX, chunkZ)

    if (!chunk) return undefined

    const localX = x - chunkX * CHUNK_SIZE
    const localZ = z - chunkZ * CHUNK_SIZE

    return chunk.blocks[localX][y][localZ]
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (y < 0 || y >= WORLD_HEIGHT) return

    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    console.log('WorldGen - Setting block:', { x, y, z, type, chunkX, chunkZ })
    
    const chunk = this.getChunk(chunkX, chunkZ)
    if (!chunk) {
      console.log('WorldGen - No chunk found')
      return
    }

    // Calculate local coordinates within the chunk
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

    console.log('WorldGen - Local coordinates:', { localX, y, localZ })

    // Update the block in the chunk
    if (chunk.blocks[localX] && chunk.blocks[localX][y] && chunk.blocks[localX][y][localZ]) {
      chunk.blocks[localX][y][localZ] = {
        type,
        position: [x, y, z]
      }
      chunk.isDirty = true
      console.log('WorldGen - Block updated successfully')

      // Store the updated chunk
      this.chunks.set(this.getChunkKey(chunkX, chunkZ), chunk)
    } else {
      console.log('WorldGen - Invalid block coordinates within chunk')
    }
  }

  getChunkByBlockPosition(x: number, z: number): Chunk | undefined {
    const chunkX = Math.floor(x / CHUNK_SIZE)
    const chunkZ = Math.floor(z / CHUNK_SIZE)
    return this.getChunk(chunkX, chunkZ)
  }
} 