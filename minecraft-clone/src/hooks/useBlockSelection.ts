import { useRef, useCallback, useEffect } from 'react'
import { Vector3, Vector2, Raycaster, Camera, BoxGeometry, Mesh, MeshBasicMaterial, DoubleSide } from 'three'
import { WorldGenerator, Block } from '../systems/worldGen'

interface BlockSelection {
  position: Vector3 | null
  normal: Vector3 | null
  block: Block | null
  face: 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back' | null
}

const MAX_REACH = 5
const STEP_SIZE = 0.05 // Smaller step size for more accurate detection

// Create geometries for face highlighting
const createFaceGeometry = (face: 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back') => {
  const geometry = new BoxGeometry(1.001, 1.001, 1.001)
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    side: DoubleSide,
    depthTest: false
  })

  // Only show the relevant face
  const indices = {
    left: [0, 1],
    right: [2, 3],
    top: [4, 5],
    bottom: [6, 7],
    front: [8, 9],
    back: [10, 11]
  }

  const faces = Object.keys(indices)
  faces.forEach((f, i) => {
    if (f !== face) {
      geometry.groups[i].materialIndex = -1
    }
  })

  return new Mesh(geometry, material)
}

export const useBlockSelection = (worldGen: WorldGenerator, camera: Camera) => {
  const raycaster = useRef(new Raycaster())
  const mousePosition = useRef(new Vector2(0, 0))
  const selection = useRef<BlockSelection>({
    position: null,
    normal: null,
    block: null,
    face: null
  })
  const highlightMesh = useRef<Mesh | null>(null)

  // Add mouse movement tracking
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Convert mouse position to normalized device coordinates (-1 to +1)
      mousePosition.current.x = (event.clientX / window.innerWidth) * 2 - 1
      mousePosition.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const updateSelection = useCallback(() => {
    // Use actual mouse position for raycasting
    raycaster.current.setFromCamera(mousePosition.current, camera)
    
    const origin = raycaster.current.ray.origin.clone()
    const direction = raycaster.current.ray.direction.clone().normalize()
    let position = origin.clone()
    let lastPosition = position.clone()
    let distance = 0

    // Ray march through the world with smaller steps
    while (distance < MAX_REACH) {
      lastPosition.copy(position)
      position.addScaledVector(direction, STEP_SIZE)
      distance += STEP_SIZE

      const blockX = Math.floor(position.x)
      const blockY = Math.floor(position.y)
      const blockZ = Math.floor(position.z)

      const block = worldGen.getBlock(blockX, blockY, blockZ)

      if (block && block.type !== 'AIR') {
        // Calculate the exact hit point relative to the block
        const relativeX = position.x - blockX
        const relativeY = position.y - blockY
        const relativeZ = position.z - blockZ

        // Calculate the normal based on which face was hit
        const normal = new Vector3()
        let face: BlockSelection['face'] = null
        
        // Determine which face was hit by checking which coordinate is closest to 0 or 1
        const epsilon = 0.01 // Small threshold for edge cases
        
        if (relativeX < epsilon) { normal.set(-1, 0, 0); face = 'left' }
        else if (relativeX > 1 - epsilon) { normal.set(1, 0, 0); face = 'right' }
        else if (relativeY < epsilon) { normal.set(0, -1, 0); face = 'bottom' }
        else if (relativeY > 1 - epsilon) { normal.set(0, 1, 0); face = 'top' }
        else if (relativeZ < epsilon) { normal.set(0, 0, -1); face = 'back' }
        else if (relativeZ > 1 - epsilon) { normal.set(0, 0, 1); face = 'front' }
        else {
          // If we somehow hit the inside of a block, use the direction we came from
          normal.copy(direction).multiplyScalar(-1)
        }

        // Update highlight mesh
        if (face !== selection.current.face) {
          if (highlightMesh.current) {
            highlightMesh.current.removeFromParent()
          }
          if (face) {
            highlightMesh.current = createFaceGeometry(face)
            highlightMesh.current.position.set(blockX + 0.5, blockY + 0.5, blockZ + 0.5)
          }
        }

        selection.current = {
          position: new Vector3(blockX, blockY, blockZ),
          normal,
          block,
          face
        }
        return selection.current
      }
    }

    // Clear highlight if no block is selected
    if (highlightMesh.current) {
      highlightMesh.current.removeFromParent()
      highlightMesh.current = null
    }

    selection.current = {
      position: null,
      normal: null,
      block: null,
      face: null
    }
    return selection.current
  }, [camera, worldGen])

  const placeBlock = useCallback((blockType: string) => {
    const currentSelection = updateSelection()
    if (currentSelection.position && currentSelection.normal) {
      const placePosition = currentSelection.position.clone().add(currentSelection.normal)
      const x = Math.floor(placePosition.x)
      const y = Math.floor(placePosition.y)
      const z = Math.floor(placePosition.z)
      
      worldGen.setBlock(x, y, z, blockType as any)
      return { x, y, z }
    }
    return null
  }, [worldGen, updateSelection])

  const destroyBlock = useCallback(() => {
    const currentSelection = updateSelection()
    if (currentSelection.position) {
      const x = Math.floor(currentSelection.position.x)
      const y = Math.floor(currentSelection.position.y)
      const z = Math.floor(currentSelection.position.z)
      
      worldGen.setBlock(x, y, z, 'AIR')
      return { x, y, z }
    }
    return null
  }, [worldGen, updateSelection])

  return {
    updateSelection,
    placeBlock,
    destroyBlock,
    selection,
    highlightMesh
  }
} 