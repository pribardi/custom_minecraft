import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Euler, Box3, Raycaster, Matrix4 } from 'three'
import { PointerLockControls } from '@react-three/drei'
import { usePlayerControls } from '../../hooks/usePlayerControls'
import { WorldGenerator } from '../../systems/worldGen'
import { BlockType } from '../../types/blocks'
import { useBlockSelection } from '../../hooks/useBlockSelection'
import SwordModel from './SwordModel'
import PlayerModel from './PlayerModel'

interface PlayerProps {
  onMove?: (position: [number, number, number]) => void
  onBlockPlace?: (type: BlockType, x: number, y: number, z: number) => void
  onBlockBreak?: () => void
  onDamage?: (amount: number) => void
  onAttack?: (position: Vector3) => void
  selectedBlock?: BlockType
  worldGen: WorldGenerator
}

const PLAYER_SPEED = 4
const PLAYER_HEIGHT = 2.2
const PLAYER_WIDTH = 0.6
const PLAYER_RADIUS = PLAYER_WIDTH / 2
const GRAVITY = -5
const JUMP_FORCE = 3.8
const COLLISION_PADDING = 1 // Increased padding for better backward collision
const STEP_HEIGHT = 0.6
const GROUND_CHECK_DISTANCE = 1.5
const SPAWN_SEARCH_RADIUS = 10

// Add new constants for third-person view
const THIRD_PERSON_DISTANCE = 4
const THIRD_PERSON_HEIGHT = 2
const CAMERA_LERP_FACTOR = 0.1
const MIN_VERTICAL_ANGLE = -Math.PI / 3 // Limit looking up (60 degrees)
const MAX_VERTICAL_ANGLE = Math.PI / 3  // Limit looking down (60 degrees)

export const Player: React.FC<PlayerProps> = ({ onMove, onBlockPlace, onBlockBreak, onDamage, onAttack, selectedBlock, worldGen }) => {
  const controlsRef = useRef<any>(null)
  const { moveForward, moveBackward, moveLeft, moveRight, jump } = usePlayerControls()
  const velocity = useRef(new Vector3())
  const position = useRef(new Vector3(0, PLAYER_HEIGHT * 2, 0))
  const direction = useRef(new Vector3())
  const isGrounded = useRef(false)
  const { camera, scene } = useThree()
  const { updateSelection, placeBlock, destroyBlock, highlightMesh } = useBlockSelection(worldGen, camera)
  const hasInitialized = useRef(false)
  const playerBoundingBox = useRef(new Box3())
  const fallStartHeight = useRef<number | null>(null)
  const [isAttacking, setIsAttacking] = useState(false)
  const attackCooldown = useRef(false)
  const raycaster = useRef(new Raycaster())
  const [isThirdPerson, setIsThirdPerson] = useState(false)
  const thirdPersonCameraPosition = useRef(new Vector3())
  const thirdPersonCameraTarget = useRef(new Vector3())
  const playerRotation = useRef(new Euler(0, 0, 0))
  const cameraMatrix = useRef(new Matrix4())
  const verticalAngle = useRef(0)

  // Add highlight mesh to scene when it changes
  useEffect(() => {
    const interval = setInterval(() => {
      const selection = updateSelection()
      if (selection.position && highlightMesh.current && !highlightMesh.current.parent) {
        scene.add(highlightMesh.current)
      }
    }, 50) // Update highlight every 50ms

    return () => {
      clearInterval(interval)
      if (highlightMesh.current) {
        highlightMesh.current.removeFromParent()
      }
    }
  }, [scene, updateSelection, highlightMesh])

  const updatePlayerBoundingBox = (pos: Vector3) => {
    // Add padding to the bounding box for more reliable collision
    playerBoundingBox.current.min.set(
      pos.x - PLAYER_RADIUS - COLLISION_PADDING,
      pos.y,
      pos.z - PLAYER_RADIUS - COLLISION_PADDING
    )
    playerBoundingBox.current.max.set(
      pos.x + PLAYER_RADIUS + COLLISION_PADDING,
      pos.y + PLAYER_HEIGHT,
      pos.z + PLAYER_RADIUS + COLLISION_PADDING
    )
  }

  const findSpawnPoint = () => {
    for (let r = 0; r < SPAWN_SEARCH_RADIUS; r++) {
      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          for (let y = 100; y > 0; y--) {
            const block = worldGen.getBlock(x, y, z)
            const blockAbove = worldGen.getBlock(x, y + 1, z)
            const blockTwoAbove = worldGen.getBlock(x, y + 2, z)
            
            if (block?.type !== 'AIR' && 
                (blockAbove?.type === 'AIR' || !blockAbove) && 
                (blockTwoAbove?.type === 'AIR' || !blockTwoAbove)) {
              return new Vector3(x, y + 1, z)
            }
          }
        }
      }
    }
    return new Vector3(0, 100, 0)
  }

  useEffect(() => {
    if (!hasInitialized.current && camera) {
      const spawnPoint = findSpawnPoint()
      position.current.copy(spawnPoint)
      position.current.y += PLAYER_HEIGHT
      
      if (controlsRef.current) {
        controlsRef.current.getObject().position.copy(position.current)
      }
      
      camera.position.copy(position.current)
      updatePlayerBoundingBox(position.current)
      hasInitialized.current = true
    }
  }, [camera])

  const checkBlockCollision = (blockPos: Vector3): boolean => {
    const blockBox = new Box3(
      new Vector3(Math.floor(blockPos.x), Math.floor(blockPos.y), Math.floor(blockPos.z)),
      new Vector3(Math.floor(blockPos.x) + 1, Math.floor(blockPos.y) + 1, Math.floor(blockPos.z) + 1)
    )
    return playerBoundingBox.current.intersectsBox(blockBox)
  }

  const checkCollision = (pos: Vector3, checkVertical: boolean = true): { 
    collision: boolean, 
    groundHeight: number | null,
    canStepUp: boolean,
    collisionNormal: Vector3 | null
  } => {
    updatePlayerBoundingBox(pos)
    
    // Expand bounds slightly for more reliable collision
    const bounds = {
      minX: Math.floor(playerBoundingBox.current.min.x - COLLISION_PADDING),
      maxX: Math.ceil(playerBoundingBox.current.max.x + COLLISION_PADDING),
      minY: Math.floor(playerBoundingBox.current.min.y),
      maxY: Math.ceil(playerBoundingBox.current.max.y),
      minZ: Math.floor(playerBoundingBox.current.min.z - COLLISION_PADDING),
      maxZ: Math.ceil(playerBoundingBox.current.max.z + COLLISION_PADDING),
    }

    let minGroundHeight = null
    let hasCollision = false
    let canStepUp = false
    let collisionNormal: Vector3 | null = null

    // Check all blocks that could intersect with the player's bounding box
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
        // First check for ground below
        if (checkVertical) {
          for (let y = bounds.minY; y > bounds.minY - GROUND_CHECK_DISTANCE; y--) {
            const block = worldGen.getBlock(x, y, z)
            if (block?.type !== 'AIR' && block?.type !== undefined) {
              if (minGroundHeight === null || y + 1 > minGroundHeight) {
                minGroundHeight = y + 1
                const blockAbove = worldGen.getBlock(x, y + 1, z)
                const blockTwoAbove = worldGen.getBlock(x, y + 2, z)
                if ((blockAbove?.type === 'AIR' || !blockAbove) && 
                    (blockTwoAbove?.type === 'AIR' || !blockTwoAbove)) {
                  const heightDiff = (y + 1) - pos.y
                  if (heightDiff > 0 && heightDiff <= STEP_HEIGHT) {
                    canStepUp = true
                  }
                }
              }
              break
            }
          }
        }

        // Then check for collisions at current level and slightly above
        for (let y = bounds.minY; y <= bounds.maxY + 1; y++) {
          const block = worldGen.getBlock(x, y, z)
          if (block?.type !== 'AIR' && block?.type !== undefined) {
            const blockPos = new Vector3(x, y, z)
            if (checkBlockCollision(blockPos)) {
              hasCollision = true
              
              // Calculate collision normal with more emphasis on horizontal direction
              const blockCenter = new Vector3(x + 0.5, y + 0.5, z + 0.5)
              const toPlayer = new Vector3().subVectors(pos, blockCenter)
              // Emphasize horizontal component for better wall sliding
              toPlayer.y *= 0.5
              toPlayer.normalize()
              
              // Update collision normal if this is more significant
              if (!collisionNormal || toPlayer.lengthSq() > collisionNormal.lengthSq()) {
                collisionNormal = toPlayer
              }
            }
          }
        }
      }
    }

    return { collision: hasCollision, groundHeight: minGroundHeight, canStepUp, collisionNormal }
  }

  // Handle view switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') {
        setIsThirdPerson(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Modify the useFrame hook to handle third-person camera
  useFrame((_, delta) => {
    if (controlsRef.current?.isLocked) {
      const cameraDirection = new Vector3()
      camera.getWorldDirection(cameraDirection)
      
      // Store vertical angle
      verticalAngle.current = Math.asin(cameraDirection.y)
      verticalAngle.current = Math.max(MIN_VERTICAL_ANGLE, Math.min(MAX_VERTICAL_ANGLE, verticalAngle.current))
      
      // Get horizontal direction for movement
      direction.current.copy(cameraDirection)
      direction.current.y = 0
      direction.current.normalize()

      // Update player rotation based on camera direction (horizontal only)
      playerRotation.current.y = Math.atan2(direction.current.x, direction.current.z)

      // Calculate movement with equal treatment for all directions
      const moveDirection = new Vector3()
      if (moveForward) moveDirection.add(direction.current)
      if (moveBackward) moveDirection.sub(direction.current)
      if (moveLeft) moveDirection.add(direction.current.clone().cross(new Vector3(0, 1, 0)))
      if (moveRight) moveDirection.sub(direction.current.clone().cross(new Vector3(0, 1, 0)))
      
      // Normalize and scale movement
      if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize()
        const speed = PLAYER_SPEED * delta
        velocity.current.x = moveDirection.x * speed
        velocity.current.z = moveDirection.z * speed
      } else {
        velocity.current.x = 0
        velocity.current.z = 0
      }

      if (!isGrounded.current) {
        velocity.current.y += GRAVITY * delta
      }

      if (jump && isGrounded.current) {
        velocity.current.y = JUMP_FORCE
        isGrounded.current = false
      }

      // Try horizontal movement with more steps for smoother collision
      const horizontalSteps = 10 // Increased for smoother collision
      const stepX = velocity.current.x / horizontalSteps
      const stepZ = velocity.current.z / horizontalSteps
      
      let newPosition = position.current.clone()
      let validPosition = position.current.clone()
      let lastValidPosition = position.current.clone()

      for (let i = 0; i < horizontalSteps; i++) {
        lastValidPosition.copy(validPosition)

        // Try full movement first
        newPosition.copy(validPosition).add(new Vector3(stepX, 0, stepZ))
        let fullCheck = checkCollision(newPosition, true)
        
        if (!fullCheck.collision) {
          validPosition.copy(newPosition)
          if (fullCheck.canStepUp && fullCheck.groundHeight !== null) {
            validPosition.y = fullCheck.groundHeight
          }
          continue
        }

        // If collision occurred, try X and Z separately
        newPosition.copy(validPosition).add(new Vector3(stepX, 0, 0))
        const xCheck = checkCollision(newPosition, true)
        if (!xCheck.collision) {
          validPosition.copy(newPosition)
        }

        newPosition.copy(validPosition).add(new Vector3(0, 0, stepZ))
        const zCheck = checkCollision(newPosition, true)
        if (!zCheck.collision) {
          validPosition.copy(newPosition)
        }

        // If we're still colliding after both attempts, revert and stop
        const finalCheck = checkCollision(validPosition, true)
        if (finalCheck.collision && !finalCheck.canStepUp) {
          validPosition.copy(lastValidPosition)
          break
        }

        // Handle step-up
        if (finalCheck.canStepUp && finalCheck.groundHeight !== null) {
          validPosition.y = finalCheck.groundHeight
        }
      }

      position.current.copy(validPosition)

      // Handle vertical movement and fall damage
      newPosition = position.current.clone()
      newPosition.y += velocity.current.y * delta

      const verticalCheck = checkCollision(newPosition, true)
      
      if (verticalCheck.groundHeight !== null) {
        const heightDifference = verticalCheck.groundHeight - newPosition.y
        
        if (heightDifference > 0 && heightDifference <= STEP_HEIGHT && velocity.current.y >= 0) {
          newPosition.y = verticalCheck.groundHeight
          velocity.current.y = 0
          isGrounded.current = true
          
          // Check for fall damage when landing
          if (fallStartHeight.current !== null) {
            const fallDistance = fallStartHeight.current - newPosition.y
            if (fallDistance > 3) {
              const damage = Math.floor(fallDistance - 3)
              if (onDamage) {
                onDamage(damage)
              }
            }
            fallStartHeight.current = null
          }
        } else if (heightDifference > 0 || velocity.current.y < 0) {
          newPosition.y = verticalCheck.groundHeight
          velocity.current.y = 0
          isGrounded.current = true
          
          // Check for fall damage when landing
          if (fallStartHeight.current !== null) {
            const fallDistance = fallStartHeight.current - newPosition.y
            if (fallDistance > 3) {
              const damage = Math.floor(fallDistance - 3)
              if (onDamage) {
                onDamage(damage)
              }
            }
            fallStartHeight.current = null
          }
        } else {
          isGrounded.current = heightDifference >= -0.1
        }
      } else {
        isGrounded.current = false
        // Start tracking fall height
        if (fallStartHeight.current === null && velocity.current.y < 0) {
          fallStartHeight.current = position.current.y
        }
      }

      if (!verticalCheck.collision || (verticalCheck.collision && velocity.current.y > 0)) {
        position.current.y = newPosition.y
      } else {
        velocity.current.y = 0
      }

      // Call onMove with the new position
      if (onMove) {
        onMove([validPosition.x, validPosition.y, validPosition.z])
      }

      // Update camera position for third-person view
      if (isThirdPerson) {
        // Calculate desired camera position with vertical angle
        const horizontalDistance = THIRD_PERSON_DISTANCE * Math.cos(verticalAngle.current)
        const verticalOffset = THIRD_PERSON_DISTANCE * Math.sin(verticalAngle.current)
        
        const idealOffset = new Vector3(
          -direction.current.x * horizontalDistance,
          THIRD_PERSON_HEIGHT + verticalOffset,
          -direction.current.z * horizontalDistance
        )

        // Check for collisions with the world
        const rayStart = position.current.clone()
        rayStart.y += THIRD_PERSON_HEIGHT * 0.7
        const rayDirection = idealOffset.clone().normalize()
        const ray = new Raycaster(rayStart, rayDirection)
        
        // Calculate points to check for collision
        const points: Vector3[] = []
        for (let i = 0; i <= THIRD_PERSON_DISTANCE; i += 0.5) {
          points.push(rayStart.clone().add(rayDirection.clone().multiplyScalar(i)))
        }

        // Find the furthest non-colliding point
        let maxDistance = THIRD_PERSON_DISTANCE
        for (const point of points) {
          const blockX = Math.floor(point.x)
          const blockY = Math.floor(point.y)
          const blockZ = Math.floor(point.z)
          const block = worldGen.getBlock(blockX, blockY, blockZ)
          
          if (block && block.type !== 'AIR') {
            maxDistance = point.distanceTo(rayStart) - 0.5
            break
          }
        }

        // Update camera position with collision avoidance
        const finalOffset = idealOffset.normalize().multiplyScalar(Math.min(THIRD_PERSON_DISTANCE, maxDistance))
        thirdPersonCameraTarget.current.copy(position.current).add(finalOffset)

        // Smoothly interpolate camera position
        thirdPersonCameraPosition.current.lerp(thirdPersonCameraTarget.current, CAMERA_LERP_FACTOR)
        camera.position.copy(thirdPersonCameraPosition.current)

        // Make camera look at player's head level with vertical offset
        const lookAtPoint = position.current.clone().add(
          new Vector3(0, PLAYER_HEIGHT * 0.5 + verticalOffset * 0.3, 0)
        )
        camera.lookAt(lookAtPoint)
      } else {
        // First-person camera position
        camera.position.copy(position.current)
      }

      // Update selection
      updateSelection()
    }
  })

  useEffect(() => {
    if (controlsRef.current) {
      const controls = controlsRef.current
      controls.getObject().position.copy(position.current)

      const handleMouseDown = (e: MouseEvent) => {
        if (!controls.isLocked) return

        // Update selection before any action
        const currentSelection = updateSelection()

        if (e.button === 0) { // Left click
          if (selectedBlock === 'SWORD' && !attackCooldown.current) {
            // Start attack animation
            setIsAttacking(true)
            attackCooldown.current = true
            
            // Calculate attack direction and position
            const attackDirection = new Vector3()
            camera.getWorldDirection(attackDirection)
            
            // Update raycaster for precise hit detection
            raycaster.current.set(position.current, attackDirection)
            const attackRange = 2.5 // Slightly increased range
            raycaster.current.far = attackRange
            
            // Perform attack
            if (onAttack) {
              // Calculate attack position more precisely
              const attackPos = position.current.clone().add(
                attackDirection.multiplyScalar(attackRange / 2)
              )
              onAttack(attackPos)
            }

            // Reset cooldown after delay
            setTimeout(() => {
              attackCooldown.current = false
            }, 500) // 500ms cooldown between attacks
          } else if (currentSelection.position) {
            // Normal block breaking
            const destroyedBlock = destroyBlock()
            if (destroyedBlock) {
              if (onBlockBreak) {
                onBlockBreak()
              }
              if (onBlockPlace) {
                onBlockPlace('AIR', destroyedBlock.x, destroyedBlock.y, destroyedBlock.z)
              }
            }
          }
        } else if (e.button === 2 && selectedBlock && selectedBlock !== 'SWORD') { // Right click - place block
          console.log('Right click detected:', {
            selectedBlock,
            hasSelection: !!currentSelection.position,
            hasNormal: !!currentSelection.normal,
            currentSelection
          })
          
          if (currentSelection.position && currentSelection.normal && selectedBlock) {
            const placePosition = currentSelection.position.clone().add(currentSelection.normal)
            const x = Math.floor(placePosition.x)
            const y = Math.floor(placePosition.y)
            const z = Math.floor(placePosition.z)
            
            console.log('Attempting to place block:', {
              type: selectedBlock,
              position: { x, y, z },
              currentBlock: worldGen.getBlock(x, y, z)
            })
            
            // First check if we can place the block (not colliding with player)
            const blockBox = new Box3(
              new Vector3(x, y, z),
              new Vector3(x + 1, y + 1, z + 1)
            )
            
            // Update player bounding box before collision check
            updatePlayerBoundingBox(position.current)
            
            const hasCollision = playerBoundingBox.current.intersectsBox(blockBox)
            console.log('Player collision check:', hasCollision)
            
            // Also check if the target position is air or undefined (can place block)
            const targetBlock = worldGen.getBlock(x, y, z)
            const canPlace = !hasCollision && (!targetBlock || targetBlock.type === 'AIR')
            
            if (canPlace) {
              console.log('Setting block:', selectedBlock, 'at position:', x, y, z)
              // Place the block first
              worldGen.setBlock(x, y, z, selectedBlock)
              // Then notify about the placement
              if (onBlockPlace) {
                onBlockPlace(selectedBlock, x, y, z)
              }
            } else {
              console.log('Cannot place block:', {
                hasCollision,
                targetBlock,
                position: { x, y, z }
              })
            }
          } else {
            console.log('No valid selection for block placement:', {
              hasSelection: !!currentSelection.position,
              hasNormal: !!currentSelection.normal,
              hasSelectedBlock: !!selectedBlock,
              selectedBlock
            })
          }
        }
      }

      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('contextmenu', (e) => e.preventDefault())

      return () => {
        document.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('contextmenu', (e) => e.preventDefault())
      }
    }
  }, [destroyBlock, placeBlock, selectedBlock, onBlockPlace, onBlockBreak, onAttack, updateSelection, worldGen, camera])

  // Add camera to scene
  useEffect(() => {
    if (camera && controlsRef.current) {
      camera.position.y = PLAYER_HEIGHT
      camera.near = 0.1
      camera.updateProjectionMatrix()
    }
  }, [camera])

  return (
    <>
      <PointerLockControls
        ref={controlsRef}
        onLock={() => console.log('locked')}
        onUnlock={() => console.log('unlocked')}
      />
      {/* Only show sword in first-person view */}
      {selectedBlock === 'SWORD' && controlsRef.current?.isLocked && !isThirdPerson && (
        <SwordModel 
          isAttacking={isAttacking}
          onAttackComplete={() => setIsAttacking(false)}
        />
      )}
      {/* Only show player model in third-person view */}
      {isThirdPerson && (
        <PlayerModel 
          position={position.current}
          rotation={playerRotation.current}
          isMoving={moveForward || moveBackward || moveLeft || moveRight}
          isJumping={!isGrounded.current}
        />
      )}
    </>
  )
}

export default Player 