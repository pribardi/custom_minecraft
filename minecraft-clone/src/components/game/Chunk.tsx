import React, { useMemo, FC, useEffect } from 'react'
import { Chunk as ChunkType, Block, BlockType } from '../../systems/worldGen'
import { BufferGeometry, BufferAttribute, Color, TextureLoader, RepeatWrapping, Vector3, InstancedMesh, Matrix4, DynamicDrawUsage } from 'three'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

interface ChunkProps {
  chunk: ChunkType
  position: Vector3
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

// Constants for instancing
const MAX_INSTANCES = 10000 // Maximum number of block instances per chunk
const MATRIX_POOL = new Array(MAX_INSTANCES).fill(null).map(() => new Matrix4())

// Create a single geometry for each face type
const SHARED_GEOMETRIES = {
  top: createFaceGeometry('top'),
  bottom: createFaceGeometry('bottom'),
  north: createFaceGeometry('north'),
  south: createFaceGeometry('south'),
  east: createFaceGeometry('east'),
  west: createFaceGeometry('west')
}

function createFaceGeometry(face: keyof typeof FACE_VERTICES): BufferGeometry {
  const geometry = new BufferGeometry()
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  
  FACE_VERTICES[face].forEach((position, i) => {
    vertices.push(position[0], position[1], position[2])
    const normal = getFaceNormal(face)
    normals.push(normal[0], normal[1], normal[2])
    const uv = FACE_UVS[i]
    uvs.push(uv[0], uv[1])
  })
  
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex(FACE_INDICES)
  
  return geometry
}

function getFaceNormal(face: keyof typeof FACE_VERTICES): Vec3 {
  switch (face) {
    case 'top': return [0, 1, 0]
    case 'bottom': return [0, -1, 0]
    case 'north': return [0, 0, -1]
    case 'south': return [0, 0, 1]
    case 'east': return [1, 0, 0]
    case 'west': return [-1, 0, 0]
  }
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

// Load textures
const BLOCK_TEXTURES = {
  GRASS: '/textures/grass.png',
  DIRT: '/textures/dirt.jpg',
  STONE: '/textures/stone.webp',
  WOOD: '/textures/wood.webp',
  LEAVES: '/textures/leaves.webp',
  SAND: '/textures/sand.webp'
} as const

const Chunk: FC<ChunkProps> = ({ chunk, position }) => {
  // Load all textures
  const textures = {
    GRASS: useLoader(TextureLoader, BLOCK_TEXTURES.GRASS),
    DIRT: useLoader(TextureLoader, BLOCK_TEXTURES.DIRT),
    STONE: useLoader(TextureLoader, BLOCK_TEXTURES.STONE),
    WOOD: useLoader(TextureLoader, BLOCK_TEXTURES.WOOD),
    LEAVES: useLoader(TextureLoader, BLOCK_TEXTURES.LEAVES),
    SAND: useLoader(TextureLoader, BLOCK_TEXTURES.SAND)
  }

  // Configure all textures
  Object.values(textures).forEach(texture => {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
  })

  // Create instanced meshes for each block type and face
  const { instances, waterInstances } = useMemo(() => {
    const instances = new Map<BlockType, Map<keyof typeof FACE_VERTICES, InstancedMesh>>()
    const waterInstances = new Map<keyof typeof FACE_VERTICES, InstancedMesh>()
    
    // Initialize instance counts
    const instanceCounts = new Map<BlockType, Map<keyof typeof FACE_VERTICES, number>>()
    const waterInstanceCounts = new Map<keyof typeof FACE_VERTICES, number>()
    
    // Count instances needed for each block type and face
    chunk.blocks.forEach((yBlocks, x) =>
      yBlocks.forEach((zBlocks, y) =>
        zBlocks.forEach((block, z) => {
          if (block.type === 'AIR') return
          
          const isWater = block.type === 'WATER'
          const faces = getVisibleFaces(x, y, z, chunk)
          
          faces.forEach(face => {
            if (isWater) {
              waterInstanceCounts.set(face, (waterInstanceCounts.get(face) || 0) + 1)
            } else {
              if (!instanceCounts.has(block.type)) {
                instanceCounts.set(block.type, new Map())
              }
              const typeCounts = instanceCounts.get(block.type)!
              typeCounts.set(face, (typeCounts.get(face) || 0) + 1)
            }
          })
        })
      )
    )
    
    // Create instanced meshes
    instanceCounts.forEach((faceCounts, blockType) => {
      const blockInstances = new Map<keyof typeof FACE_VERTICES, InstancedMesh>()
      instances.set(blockType, blockInstances)
      
      faceCounts.forEach((count, face) => {
        const geometry = SHARED_GEOMETRIES[face]
        const material = createMaterial(blockType, false, textures)
        const instancedMesh = new InstancedMesh(geometry, material, Math.min(count, MAX_INSTANCES))
        instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage)
        blockInstances.set(face, instancedMesh)
      })
    })
    
    // Create water instances
    waterInstanceCounts.forEach((count, face) => {
      const geometry = SHARED_GEOMETRIES[face]
      const material = createMaterial('WATER', true, textures)
      const instancedMesh = new InstancedMesh(geometry, material, Math.min(count, MAX_INSTANCES))
      instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage)
      waterInstances.set(face, instancedMesh)
    })
    
    // Update instance matrices
    let instanceIndices = new Map<BlockType, Map<keyof typeof FACE_VERTICES, number>>()
    let waterIndices = new Map<keyof typeof FACE_VERTICES, number>()
    
    chunk.blocks.forEach((yBlocks, x) =>
      yBlocks.forEach((zBlocks, y) =>
        zBlocks.forEach((block, z) => {
          if (block.type === 'AIR') return
          
          const isWater = block.type === 'WATER'
          const faces = getVisibleFaces(x, y, z, chunk)
          const matrix = MATRIX_POOL[0].makeTranslation(x, y, z)
          
          faces.forEach(face => {
            if (isWater) {
              const index = waterIndices.get(face) || 0
              if (index < MAX_INSTANCES) {
                const mesh = waterInstances.get(face)
                if (mesh) mesh.setMatrixAt(index, matrix)
              }
              waterIndices.set(face, index + 1)
            } else {
              if (!instanceIndices.has(block.type)) {
                instanceIndices.set(block.type, new Map())
              }
              const typeIndices = instanceIndices.get(block.type)!
              const index = typeIndices.get(face) || 0
              if (index < MAX_INSTANCES) {
                const blockInstances = instances.get(block.type)
                const mesh = blockInstances?.get(face)
                if (mesh) mesh.setMatrixAt(index, matrix)
              }
              typeIndices.set(face, index + 1)
            }
          })
        })
      )
    )
    
    return { instances, waterInstances }
  }, [chunk, textures])
  
  // Cleanup
  useEffect(() => {
    return () => {
      instances.forEach(blockInstances => {
        blockInstances.forEach(mesh => {
          mesh.geometry.dispose()
          if (mesh.material instanceof THREE.Material) {
            mesh.material.dispose()
          }
        })
      })
      
      waterInstances.forEach(mesh => {
        mesh.geometry.dispose()
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose()
        }
      })
      
      Object.values(textures).forEach(texture => texture.dispose())
    }
  }, [instances, waterInstances, textures])
  
  return (
    <group position={position}>
      {Array.from(instances.entries()).map(([blockType, blockInstances]) => (
        Array.from(blockInstances.entries()).map(([face, mesh]) => (
          <primitive 
            key={`${blockType}-${face}`}
            object={mesh}
            castShadow
            receiveShadow
          />
        ))
      ))}
      {Array.from(waterInstances.entries()).map(([face, mesh]) => (
        <primitive
          key={`water-${face}`}
          object={mesh}
          receiveShadow
        />
      ))}
    </group>
  )
}

function getVisibleFaces(x: number, y: number, z: number, chunk: ChunkType): (keyof typeof FACE_VERTICES)[] {
  const faces: (keyof typeof FACE_VERTICES)[] = []
  
  const isBlockVisible = (x: number, y: number, z: number): boolean => {
    return chunk.blocks[x]?.[y]?.[z]?.type === 'AIR' || !chunk.blocks[x]?.[y]?.[z]
  }
  
  if (isBlockVisible(x, y + 1, z)) faces.push('top')
  if (isBlockVisible(x, y - 1, z)) faces.push('bottom')
  if (isBlockVisible(x, y, z - 1)) faces.push('north')
  if (isBlockVisible(x, y, z + 1)) faces.push('south')
  if (isBlockVisible(x + 1, y, z)) faces.push('east')
  if (isBlockVisible(x - 1, y, z)) faces.push('west')
  
  return faces
}

function createMaterial(blockType: BlockType, isWater: boolean, textures: Record<string, THREE.Texture>): THREE.Material {
  const blockColors = BLOCK_COLORS[blockType]
  const material = new THREE.MeshStandardMaterial({
    map: textures[blockType],
    color: blockColors.all ? blockColors.all : blockColors.sides,
    transparent: isWater,
    opacity: isWater ? 0.6 : 1,
    roughness: isWater ? 0.2 : 0.8,
    metalness: isWater ? 0.1 : 0,
    side: THREE.DoubleSide,
    shadowSide: THREE.FrontSide,
    vertexColors: false
  })

  return material
}

export default Chunk 