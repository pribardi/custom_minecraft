export type BlockType = 'AIR' | 'GRASS' | 'DIRT' | 'STONE' | 'WOOD' | 'LEAVES' | 'SWORD'

export interface Block {
  type: BlockType
  position: [number, number, number]
  // Add any additional block properties here
  metadata?: {
    durability?: number
    lightLevel?: number
    isWater?: boolean
    isSolid?: boolean
  }
}

export interface BlockFace {
  normal: [number, number, number]
  vertices: [number, number, number][]
  uvs: [number, number][]
  indices: number[]
}

export interface BlockMesh {
  geometry: {
    vertices: number[]
    indices: number[]
    uvs: number[]
    normals: number[]
  }
  material: {
    textureIndex: number
    transparent: boolean
  }
} 