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

// Lazy load UI components to improve initial load time
const Hotbar = lazy(() => import('../ui/Hotbar'))
const Inventory = lazy(() => import('../ui/Inventory'))
const StatusBars = lazy(() => import('../ui/StatusBars'))

const Game: FC = () => {
  const [showInventory, setShowInventory] = useState(false)
  const worldGen = useRef(new WorldGenerator())
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

  // Start background music when game loads
  useEffect(() => {
    startBackgroundMusic()
    return () => stopBackgroundMusic()
  }, [startBackgroundMusic, stopBackgroundMusic])

  // Add some initial items for testing
  useEffect(() => {
    addItem('DIRT', 64)
    addItem('STONE', 32)
    addItem('GRASS', 16)
    addItem('WOOD', 8)
    addItem('SWORD' as BlockType, 1) // Cast SWORD as BlockType
  }, [addItem])

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
    const hungerInterval = setInterval(() => {
      if (stats.hunger > 0) {
        decreaseHunger(1)
      } else if (stats.health > 0) {
        // Take damage when starving
        damage(1)
        playSound('hurt')
      }
    }, 30000) // Decrease hunger every 30 seconds

    const healthRegenInterval = setInterval(() => {
      if (stats.hunger >= 18 && stats.health < stats.maxHealth) {
        heal(1)
      }
    }, 4000) // Regenerate health every 4 seconds if well fed

    return () => {
      clearInterval(hungerInterval)
      clearInterval(healthRegenInterval)
    }
  }, [stats.hunger, stats.health, decreaseHunger, damage, heal, playSound])

  const handleBlockPlace = (type: BlockType) => {
    console.log('Handling block place:', { type, selectedItem: getSelectedItem() })
    const selectedItem = getSelectedItem()
    if (selectedItem && selectedItem.count > 0) {
      // Only remove item if block placement was successful
      if (type === selectedItem.type) {
        removeItem(inventory.selectedSlot)
        playSound('blockPlace')
        // Decrease hunger slightly when placing blocks
        decreaseHunger(0.1)
        console.log('Block placed successfully, inventory updated')
      }
    } else {
      console.log('No item selected or item count is 0')
    }
  }

  const handlePlayerDamage = (amount: number) => {
    damage(amount)
    playSound('hurt')
  }

  const handleAttack = (position: Vector3) => {
    const selectedItem = getSelectedItem()?.type
    if (selectedItem === ('SWORD' as BlockType)) {
      // Try to damage pigs at the attack position
      if (pigManagerRef.current?.tryDamagePig) {
        pigManagerRef.current.tryDamagePig(position, 5) // Sword deals 5 damage
        playSound('hurt') // Reuse hurt sound for now
        decreaseHunger(0.2) // Attacking costs hunger
      }
    }
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows="soft"
        camera={{
          fov: 90,
          near: 0.1,
          far: 1000,
          position: [0, 1.6, 0],
          rotation: [0, 0, 0]
        }}
        gl={{
          antialias: true,
          alpha: false,
          stencil: false,
        }}
      >
        <color attach="background" args={["#87CEEB"]} />
        <Suspense fallback={null}>
          <Sky 
            distance={450000} 
            sunPosition={[100, 100, 20]} 
            inclination={0.49} 
            azimuth={0.25} 
          />
          <ambientLight intensity={0.5} />
          <directionalLight
            castShadow
            position={[100, 100, 20]}
            intensity={1.5}
            shadow-mapSize={[4096, 4096]}
            shadow-camera-left={-100}
            shadow-camera-right={100}
            shadow-camera-top={100}
            shadow-camera-bottom={-100}
            shadow-camera-near={0.1}
            shadow-camera-far={500}
            shadow-bias={-0.001}
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
      
      <Suspense fallback={null}>
        <Hotbar 
          inventory={inventory}
          onSelectSlot={selectSlot}
        />

        <StatusBars stats={stats} />

        {showInventory && (
          <Inventory
            inventory={inventory}
            onMoveItem={moveItem}
            onClose={() => setShowInventory(false)}
          />
        )}
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