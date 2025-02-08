import { useState, useCallback } from 'react'

export interface PlayerStats {
  health: number
  maxHealth: number
  hunger: number
  maxHunger: number
}

const INITIAL_STATS: PlayerStats = {
  health: 20,
  maxHealth: 20,
  hunger: 20,
  maxHunger: 20
}

export const usePlayerStats = () => {
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS)

  const damage = useCallback((amount: number) => {
    setStats(prev => ({
      ...prev,
      health: Math.max(0, prev.health - amount)
    }))
  }, [])

  const heal = useCallback((amount: number) => {
    setStats(prev => ({
      ...prev,
      health: Math.min(prev.maxHealth, prev.health + amount)
    }))
  }, [])

  const decreaseHunger = useCallback((amount: number) => {
    setStats(prev => ({
      ...prev,
      hunger: Math.max(0, prev.hunger - amount)
    }))
  }, [])

  const increaseHunger = useCallback((amount: number) => {
    setStats(prev => ({
      ...prev,
      hunger: Math.min(prev.maxHunger, prev.hunger + amount)
    }))
  }, [])

  return {
    stats,
    damage,
    heal,
    decreaseHunger,
    increaseHunger
  }
} 