import { useMemo, FC, useEffect } from 'react'
import { Chunk as ChunkType, Block, BlockType } from '../../systems/worldGen'
import { BufferGeometry, BufferAttribute, Color, TextureLoader, RepeatWrapping } from 'three'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

interface ChunkProps {
  chunk: ChunkType
}

// Block colors for each type (used as fallback and tint)
const BLOCK_COLORS: Record<BlockType, Record<string, Color>> = {
  AIR: {
    all: new Color(0, 0, 0)
  },
  GRASS: {
    top: new Color(0.2, 0.8, 0.2),    // Green top
    bottom: new Color(0.6, 0.3, 0),    // Dirt bottom
    sides: new Color(0.4, 0.6, 0.2)    // Grass+dirt sides
  },
  DIRT: {
    all: new Color(0.6, 0.3, 0)        // Brown
  },
  STONE: {
    all: new Color(0.6, 0.6, 0.6)      // Gray
  },
  WOOD: {
    top: new Color(0.6, 0.4, 0.2),     // Lighter wood for ends
    all: new Color(0.45, 0.3, 0.15)    // Dark brown for trunk
  },
  LEAVES: {
    all: new Color(0.2, 0.5, 0.1)      // Dark green
  },
  SWORD: {
    all: new Color(0.8, 0.8, 0.9)      // Metallic silver
  }
}

type Vec3 = [number, number, number]

// Face vertices for each direction - fixed winding order
const FACE_VERTICES = {
  top: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] as Vec3[],
  bottom: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] as Vec3[],
  north: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] as Vec3[],
  south: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] as Vec3[],
  east: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] as Vec3[],
  west: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] as Vec3[],
}

// UV coordinates for each vertex of a face
const FACE_UVS = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0]
]

const FACE_INDICES = [0, 1, 2, 0, 2, 3] as number[]

const Chunk: FC<ChunkProps> = ({ chunk }) => {
  // Load the grass texture
  const grassTexture = useLoader(TextureLoader, '/textures/grass.png')
  
  // Configure texture
  grassTexture.wrapS = RepeatWrapping
  grassTexture.wrapT = RepeatWrapping
  grassTexture.repeat.set(1, 1)

  const geometry = useMemo(() => {
    const vertices: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    // Helper to check if a block is visible
    const isBlockVisible = (x: number, y: number, z: number): boolean => {
      return chunk.blocks[x]?.[y]?.[z]?.type === 'AIR' || !chunk.blocks[x]?.[y]?.[z]
    }

    // Helper to add a block face
    const addFace = (
      block: Block,
      face: keyof typeof FACE_VERTICES,
      vertexPositions: Vec3[],
      normal: Vec3,
      color: Color
    ) => {
      const startIndex = vertices.length / 3

      vertexPositions.forEach((position, i) => {
        vertices.push(
          position[0] + block.position[0],
          position[1] + block.position[1],
          position[2] + block.position[2]
        )

        colors.push(color.r, color.g, color.b)
        normals.push(normal[0], normal[1], normal[2])
        
        // Add UV coordinates
        const uv = FACE_UVS[i]
        uvs.push(uv[0], uv[1])
      })

      FACE_INDICES.forEach(index => {
        indices.push(startIndex + index)
      })
    }

    // Iterate through blocks and create geometry
    chunk.blocks.forEach((yBlocks, x) =>
      yBlocks.forEach((zBlocks, y) =>
        zBlocks.forEach((block, z) => {
          if (block.type === 'AIR') return

          const blockColors = BLOCK_COLORS[block.type]
          
          // Check each face
          if (isBlockVisible(x, y + 1, z)) {
            const color = blockColors.top || blockColors.all
            addFace(block, 'top', FACE_VERTICES.top, [0, 1, 0], color)
          }
          if (isBlockVisible(x, y - 1, z)) {
            const color = blockColors.bottom || blockColors.all
            addFace(block, 'bottom', FACE_VERTICES.bottom, [0, -1, 0], color)
          }
          if (isBlockVisible(x, y, z - 1)) {
            const color = blockColors.sides || blockColors.all
            addFace(block, 'north', FACE_VERTICES.north, [0, 0, -1], color)
          }
          if (isBlockVisible(x, y, z + 1)) {
            const color = blockColors.sides || blockColors.all
            addFace(block, 'south', FACE_VERTICES.south, [0, 0, 1], color)
          }
          if (isBlockVisible(x + 1, y, z)) {
            const color = blockColors.sides || blockColors.all
            addFace(block, 'east', FACE_VERTICES.east, [1, 0, 0], color)
          }
          if (isBlockVisible(x - 1, y, z)) {
            const color = blockColors.sides || blockColors.all
            addFace(block, 'west', FACE_VERTICES.west, [-1, 0, 0], color)
          }
        })
      )
    )

    const geometry = new BufferGeometry()
    
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
    geometry.setIndex(indices)

    return geometry
  }, [chunk])

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      geometry.dispose()
      grassTexture.dispose()
    }
  }, [geometry, grassTexture])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        shadowSide={THREE.DoubleSide}
        map={grassTexture}
      />
    </mesh>
  )
}

export default Chunk 