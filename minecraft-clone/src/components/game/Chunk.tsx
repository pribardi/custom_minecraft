import React, { useMemo, FC, useEffect } from 'react'
import { Chunk as ChunkType, Block, BlockType } from '../../systems/worldGen'
import { BufferGeometry, BufferAttribute, Color, TextureLoader, RepeatWrapping, Vector3 } from 'three'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

interface ChunkProps {
  chunk: ChunkType
  position: Vector3
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
  },
  WATER: {
    all: new Color(0.2, 0.3, 0.9)      // Blue with slight transparency
  },
  SAND: {
    all: new Color(0.76, 0.7, 0.5)     // Sandy beige
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

const Chunk: FC<ChunkProps> = ({ chunk, position }) => {
  // Load the grass texture
  const grassTexture = useLoader(TextureLoader, '/textures/grass.png')
  
  // Configure texture
  grassTexture.wrapS = RepeatWrapping
  grassTexture.wrapT = RepeatWrapping
  grassTexture.repeat.set(1, 1)

  // Create separate geometries for solid blocks and water
  const { solidGeometry, waterGeometry } = useMemo(() => {
    const solidVerts: number[] = []
    const solidColors: number[] = []
    const solidIndices: number[] = []
    const solidNormals: number[] = []
    const solidUvs: number[] = []

    const waterVerts: number[] = []
    const waterColors: number[] = []
    const waterIndices: number[] = []
    const waterNormals: number[] = []
    const waterUvs: number[] = []

    // Helper to check if a block is visible
    const isBlockVisible = (x: number, y: number, z: number): boolean => {
      return chunk.blocks[x]?.[y]?.[z]?.type === 'AIR' || !chunk.blocks[x]?.[y]?.[z]
    }

    // Helper to add a block face
    const addFace = (
      localX: number,
      localY: number,
      localZ: number,
      face: keyof typeof FACE_VERTICES,
      normal: Vec3,
      color: Color,
      isWater: boolean
    ) => {
      const vertices = isWater ? waterVerts : solidVerts
      const colors = isWater ? waterColors : solidColors
      const indices = isWater ? waterIndices : solidIndices
      const normals = isWater ? waterNormals : solidNormals
      const uvs = isWater ? waterUvs : solidUvs

      const startIndex = vertices.length / 3

      FACE_VERTICES[face].forEach((position, i) => {
        vertices.push(
          position[0] + localX,
          position[1] + localY,
          position[2] + localZ
        )

        colors.push(color.r, color.g, color.b)
        normals.push(normal[0], normal[1], normal[2])
        
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

          const isWater = block.type === 'WATER'
          const blockColors = BLOCK_COLORS[block.type]
          
          // Check each face
          if (isBlockVisible(x, y + 1, z)) {
            const color = blockColors.top || blockColors.all
            addFace(x, y, z, 'top', [0, 1, 0], color, isWater)
          }
          if (isBlockVisible(x, y - 1, z)) {
            const color = blockColors.bottom || blockColors.all
            addFace(x, y, z, 'bottom', [0, -1, 0], color, isWater)
          }
          if (isBlockVisible(x, y, z - 1)) {
            const color = blockColors.sides || blockColors.all
            addFace(x, y, z, 'north', [0, 0, -1], color, isWater)
          }
          if (isBlockVisible(x, y, z + 1)) {
            const color = blockColors.sides || blockColors.all
            addFace(x, y, z, 'south', [0, 0, 1], color, isWater)
          }
          if (isBlockVisible(x + 1, y, z)) {
            const color = blockColors.sides || blockColors.all
            addFace(x, y, z, 'east', [1, 0, 0], color, isWater)
          }
          if (isBlockVisible(x - 1, y, z)) {
            const color = blockColors.sides || blockColors.all
            addFace(x, y, z, 'west', [-1, 0, 0], color, isWater)
          }
        })
      )
    )

    const solidGeometry = new BufferGeometry()
    solidGeometry.setAttribute('position', new BufferAttribute(new Float32Array(solidVerts), 3))
    solidGeometry.setAttribute('color', new BufferAttribute(new Float32Array(solidColors), 3))
    solidGeometry.setAttribute('normal', new BufferAttribute(new Float32Array(solidNormals), 3))
    solidGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(solidUvs), 2))
    solidGeometry.setIndex(solidIndices)

    const waterGeometry = new BufferGeometry()
    waterGeometry.setAttribute('position', new BufferAttribute(new Float32Array(waterVerts), 3))
    waterGeometry.setAttribute('color', new BufferAttribute(new Float32Array(waterColors), 3))
    waterGeometry.setAttribute('normal', new BufferAttribute(new Float32Array(waterNormals), 3))
    waterGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(waterUvs), 2))
    waterGeometry.setIndex(waterIndices)

    return { solidGeometry, waterGeometry }
  }, [chunk])

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      solidGeometry.dispose()
      waterGeometry.dispose()
      grassTexture.dispose()
    }
  }, [solidGeometry, waterGeometry, grassTexture])

  return (
    <>
      <mesh
        geometry={solidGeometry}
        position={position}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          shadowSide={THREE.DoubleSide}
          map={grassTexture}
        />
      </mesh>
      <mesh
        geometry={waterGeometry}
        position={position}
        receiveShadow
      >
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          shadowSide={THREE.DoubleSide}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
    </>
  )
}

export default Chunk 