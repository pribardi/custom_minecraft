import { FC, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSound } from '../../hooks/useSound'
import { SoundIcon, MuteIcon, SettingsIcon } from './icons/MinecraftIcons'

interface StartMenuProps {
  onStartGame: () => void
}

const StartMenu: FC<StartMenuProps> = ({ onStartGame }) => {
  const { playSound, toggleMute, isMuted, startBackgroundMusic } = useSound()

  useEffect(() => {
    startBackgroundMusic()
  }, [startBackgroundMusic])

  const handleStartGame = () => {
    playSound('click')
    onStartGame()
  }

  const handleMuteToggle = () => {
    playSound('click')
    toggleMute()
  }

  return (
    <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-sky-900 to-black overflow-hidden">
      {/* Animated Minecraft blocks background */}
      <div className="absolute inset-0 w-full h-full">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-white/5 border border-white/10"
            style={{
              width: Math.random() * 100 + 50,
              height: Math.random() * 100 + 50,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundImage: `url('/textures/dirt.png')`,
              backgroundSize: 'cover',
            }}
            initial={{ opacity: 0, scale: 0, rotate: 0 }}
            animate={{
              opacity: [0, 0.5, 0],
              scale: [0, 1, 0],
              y: [0, -1000],
              rotate: [0, 360],
            }}
            transition={{
              duration: Math.random() * 10 + 15,
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * 10,
            }}
          />
        ))}
      </div>

      {/* Menu content */}
      <motion.div 
        className="relative z-10 flex flex-col items-center justify-center h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Title */}
        <motion.h1 
          className="text-6xl font-minecraft text-yellow-500 mb-12 text-center shadow-lg"
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20
          }}
        >
          Minecraft Clone
        </motion.h1>

        {/* Buttons Container */}
        <div className="space-y-4 w-full max-w-md px-4">
          <motion.button
            className="w-full bg-green-600 hover:bg-green-500 text-white font-minecraft py-4 px-8 rounded-none border-b-4 border-green-800 transform transition-all duration-200 shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, borderBottomWidth: '2px', y: 2 }}
            onClick={handleStartGame}
            onMouseEnter={() => playSound('hover')}
          >
            Start Game
          </motion.button>

          <motion.button
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-minecraft py-4 px-8 rounded-none border-b-4 border-blue-800 transform transition-all duration-200 shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, borderBottomWidth: '2px', y: 2 }}
            onMouseEnter={() => playSound('hover')}
          >
            Multiplayer
          </motion.button>

          <motion.button
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-minecraft py-4 px-8 rounded-none border-b-4 border-purple-800 transform transition-all duration-200 shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, borderBottomWidth: '2px', y: 2 }}
            onMouseEnter={() => playSound('hover')}
          >
            Options
          </motion.button>
        </div>

        {/* Controls Info */}
        <motion.div 
          className="absolute bottom-8 left-8 text-white/80 bg-black/50 p-6 rounded-lg backdrop-blur-sm"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-2xl font-minecraft mb-4 text-yellow-500">Controls</h2>
          <ul className="space-y-2 font-minecraft text-sm">
            <li className="flex items-center space-x-2">
              <span className="bg-white/20 px-2 py-1">WASD</span>
              <span>Move</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="bg-white/20 px-2 py-1">SPACE</span>
              <span>Jump</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="bg-white/20 px-2 py-1">E</span>
              <span>Inventory</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="bg-white/20 px-2 py-1">ESC</span>
              <span>Pause</span>
            </li>
          </ul>
        </motion.div>

        {/* Sound Toggle */}
        <motion.button
          className="absolute top-8 right-8 text-white/80 hover:text-white p-2"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleMuteToggle}
          onMouseEnter={() => playSound('hover')}
        >
          {isMuted ? <MuteIcon /> : <SoundIcon />}
        </motion.button>

        {/* Settings Button */}
        <motion.button
          className="absolute top-8 right-20 text-white/80 hover:text-white p-2"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onMouseEnter={() => playSound('hover')}
        >
          <SettingsIcon />
        </motion.button>

        {/* Version */}
        <div className="absolute bottom-4 right-4 text-white/50 font-minecraft text-sm">
          v0.1.0
        </div>
      </motion.div>
    </div>
  )
}

export default StartMenu 