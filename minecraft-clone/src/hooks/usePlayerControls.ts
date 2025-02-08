import { useState, useEffect } from 'react'

interface PlayerControls {
  moveForward: boolean
  moveBackward: boolean
  moveLeft: boolean
  moveRight: boolean
  jump: boolean
}

const keys = {
  'KeyW': 'moveForward',
  'KeyS': 'moveBackward',
  'KeyA': 'moveLeft',
  'KeyD': 'moveRight',
  'Space': 'jump'
} as const

export const usePlayerControls = () => {
  const [movement, setMovement] = useState<PlayerControls>({
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    jump: false
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code in keys) {
        e.preventDefault()
        const control = keys[e.code as keyof typeof keys]
        setMovement(m => ({ ...m, [control]: true }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code in keys) {
        e.preventDefault()
        const control = keys[e.code as keyof typeof keys]
        setMovement(m => ({ ...m, [control]: false }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return movement
} 