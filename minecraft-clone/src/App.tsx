import { useState } from 'react'
import Game from './components/game/Game'
import StartMenu from './components/menu/StartMenu'
import './App.css'

function App() {
  const [gameStarted, setGameStarted] = useState(false)

  return (
    <div className="w-full h-screen flex flex-col">
      <main className="flex-1 relative">
        {!gameStarted ? (
          <StartMenu onStartGame={() => setGameStarted(true)} />
        ) : (
          <Game />
        )}
      </main>
    </div>
  )
}

export default App
