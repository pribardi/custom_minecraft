import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef } from 'react'
import World from './World'
import { Player } from './Player'
import { useInventory } from '../../hooks/useInventory'
import { usePlayerStats } from '../../hooks/usePlayerStats'
import { WorldGenerator } from '../../systems/worldGen'
import { BlockType } from '../../types/blocks'
import { FC } from 'react'
import { lazy } from 'react'
import { useSound } from '../../hooks/useSound'
import { Vector3 } from 'three'
import { PigManager, PigManagerRef } from './entities/PigManager'
import { Color } from 'three'

// Lazy load UI components to improve initial load time
const Hotbar = lazy(() => import('../ui/Hotbar'))
const Inventory = lazy(() => import('../ui/Inventory'))
const StatusBars = lazy(() => import('../ui/StatusBars'))

const Game: FC = () => {
  const [showInventory, setShowInventory] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const worldGen = useRef<WorldGenerator | null>(null)
  const { isMuted, toggleMute, playSound, startBackgroundMusic, stopBackgroundMusic } = useSound()
  const pigManagerRef = useRef<PigManagerRef>(null)
  const {
    inventory,
    selectSlot,
    addItem,
    removeItem,
    moveItem,
    swapItems,
    getSelectedItem
  } = useInventory()
  const {
    stats,
    damage,
    heal,
    decreaseHunger,
    increaseHunger
  } = usePlayerStats()

  // Initialize game state
  useEffect(() => {
    console.log('Initializing game...')
    try {
      worldGen.current = new WorldGenerator()
      console.log('WorldGenerator initialized successfully')
      setIsInitialized(true)
      startBackgroundMusic()
    } catch (error) {
      console.error('Failed to initialize WorldGenerator:', error)
      setInitError(error instanceof Error ? error.message : 'Failed to initialize game')
    }
    return () => {
      stopBackgroundMusic()
      if (worldGen.current) {
        worldGen.current.dispose()
      }
    }
  }, [startBackgroundMusic, stopBackgroundMusic])

  // Add some initial items for testing
  useEffect(() => {
    if (isInitialized) {
      console.log('Adding initial items...')
      addItem('DIRT', 64)
      addItem('STONE', 32)
      addItem('GRASS', 16)
      addItem('WOOD', 8)
      addItem('SWORD' as BlockType, 1)
    }
  }, [addItem, isInitialized])

  // Handle inventory toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') {
        e.preventDefault()
        setShowInventory(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Decrease hunger over time and handle health regeneration
  useEffect(() => {
    if (!isInitialized) return

    const hungerInterval = setInterval(() => {
      if (stats.hunger > 0) {
        decreaseHunger(1)
      } else if (stats.health > 0) {
        damage(1)
        playSound('hurt')
      }
    }, 30000)

    const healthRegenInterval = setInterval(() => {
      if (stats.hunger >= 18 && stats.health < stats.maxHealth) {
        heal(1)
      }
    }, 4000)

    return () => {
      clearInterval(hungerInterval)
      clearInterval(healthRegenInterval)
    }
  }, [stats.hunger, stats.health, decreaseHunger, damage, heal, playSound, isInitialized])

  const handleBlockPlace = (type: BlockType) => {
    if (!isInitialized) return
    
    console.log('Handling block place:', { type, selectedItem: getSelectedItem() })
    const selectedItem = getSelectedItem()
    if (selectedItem && selectedItem.count > 0) {
      if (type === selectedItem.type) {
        removeItem(inventory.selectedSlot)
        playSound('blockPlace')
        decreaseHunger(0.1)
        console.log('Block placed successfully, inventory updated')
      }
    } else {
      console.log('No item selected or item count is 0')
    }
  }

  const handlePlayerDamage = (amount: number) => {
    if (!isInitialized) return
    damage(amount)
    playSound('hurt')
  }

  const handleAttack = (position: Vector3) => {
    if (!isInitialized) return
    
    const selectedItem = getSelectedItem()?.type
    if (selectedItem === ('SWORD' as BlockType)) {
      if (pigManagerRef.current?.tryDamagePig) {
        pigManagerRef.current.tryDamagePig(position, 5)
        playSound('hurt')
        decreaseHunger(0.2)
      }
    }
  }

  if (initError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-white">
        <div className="text-2xl text-red-500">Error: {initError}</div>
      </div>
    )
  }

  if (!isInitialized || !worldGen.current) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-white">
        <div className="text-2xl">Loading game...</div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{
          fov: 90,
          near: 0.1,
          far: 1000,
          position: [0, 1.6, 0]
        }}
        gl={{
          antialias: true,
          alpha: false,
          stencil: false,
        }}
        onCreated={({ gl, scene }) => {
          console.log('Canvas created')
          gl.setClearColor('#87CEEB')
          scene.background = new Color('#87CEEB')
        }}
      >
        <Suspense fallback={null}>
          <Sky sunPosition={[100, 10, 100]} />
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[50, 50, -30]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <World worldGen={worldGen.current} />
          <Player 
            worldGen={worldGen.current}
            onBlockPlace={handleBlockPlace}
            onBlockBreak={() => playSound('blockBreak')}
            onDamage={handlePlayerDamage}
            onAttack={handleAttack}
            selectedBlock={getSelectedItem()?.type}
          />
          <PigManager 
            ref={pigManagerRef}
            worldGen={worldGen.current} 
            maxPigs={5} 
            spawnRadius={20} 
          />
          <fog attach="fog" args={['#c9edff', 20, 250]} />
        </Suspense>
      </Canvas>

      {/* UI Elements */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full pointer-events-none" />
      
      <Suspense fallback={<div>Loading UI...</div>}>
        {!showInventory && (
          <Hotbar 
            inventory={inventory}
            onSelectSlot={selectSlot}
          />
        )}
        {showInventory && (
          <Inventory
            inventory={inventory}
            onClose={() => setShowInventory(false)}
            onMoveItem={moveItem}
          />
        )}
        <StatusBars stats={stats} />
      </Suspense>

      {/* Sound Controls */}
      <button 
        onClick={toggleMute}
        className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded"
      >
        {isMuted ? 'Unmute' : 'Mute'}
      </button>

      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-white font-mono text-sm text-center select-none bg-black/50 p-3 rounded">
        Click to play<br />
        WASD to move<br />
        SPACE to jump<br />
        ESC to pause<br />
        E to open inventory<br />
        1-9 to select items<br />
        Left click to attack/break<br />
        Right click to place<br />
        Select sword to attack pigs
      </div>
    </div>
  )
}

export default Game 