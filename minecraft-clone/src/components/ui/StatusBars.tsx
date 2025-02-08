import React from 'react'
import { PlayerStats } from '../../hooks/usePlayerStats'

interface StatusBarsProps {
  stats: PlayerStats
}

const StatusBars: React.FC<StatusBarsProps> = ({ stats }) => {
  const { health, maxHealth, hunger, maxHunger } = stats

  // Helper function to create heart/hunger icons
  const createIcons = (current: number, max: number, type: 'health' | 'hunger') => {
    const icons: JSX.Element[] = []
    const fullIcons = Math.floor(current / 2)
    const hasHalf = current % 2 === 1

    for (let i = 0; i < Math.ceil(max / 2); i++) {
      if (i < fullIcons) {
        icons.push(
          <svg key={i} className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill={type === 'health' ? '#ff0000' : '#d4a017'}>
            {type === 'health' ? (
              // Heart icon
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            ) : (
              // Drumstick icon for hunger
              <path d="M15.5 4.8c2.2.7 3.7 2.3 4.4 4.4.7 2.2.3 4.5-1.1 6.3l-2.8 2.8c-.3.3-.7.4-1.1.4-.4 0-.8-.1-1.1-.4l-8.7-8.7c-.3-.3-.4-.7-.4-1.1 0-.4.1-.8.4-1.1l2.8-2.8c1.8-1.4 4.1-1.8 6.3-1.1l-.9.9c-1.7-.5-3.5-.2-4.9.9l-2.8 2.8 8.7 8.7 2.8-2.8c1.1-1.4 1.4-3.2.9-4.9l.9-.9z" />
            )}
          </svg>
        )
      } else if (i === fullIcons && hasHalf) {
        icons.push(
          <svg key={i} className="w-4 h-4 inline-block" viewBox="0 0 24 24">
            <defs>
              <linearGradient id={`half-${type}-${i}`}>
                <stop offset="50%" stopColor={type === 'health' ? '#ff0000' : '#d4a017'} />
                <stop offset="50%" stopColor="#808080" />
              </linearGradient>
            </defs>
            {type === 'health' ? (
              <path fill={`url(#half-${type}-${i})`} d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            ) : (
              <path fill={`url(#half-${type}-${i})`} d="M15.5 4.8c2.2.7 3.7 2.3 4.4 4.4.7 2.2.3 4.5-1.1 6.3l-2.8 2.8c-.3.3-.7.4-1.1.4-.4 0-.8-.1-1.1-.4l-8.7-8.7c-.3-.3-.4-.7-.4-1.1 0-.4.1-.8.4-1.1l2.8-2.8c1.8-1.4 4.1-1.8 6.3-1.1l-.9.9c-1.7-.5-3.5-.2-4.9.9l-2.8 2.8 8.7 8.7 2.8-2.8c1.1-1.4 1.4-3.2.9-4.9l.9-.9z" />
            )}
          </svg>
        )
      } else {
        icons.push(
          <svg key={i} className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="#808080">
            {type === 'health' ? (
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            ) : (
              <path d="M15.5 4.8c2.2.7 3.7 2.3 4.4 4.4.7 2.2.3 4.5-1.1 6.3l-2.8 2.8c-.3.3-.7.4-1.1.4-.4 0-.8-.1-1.1-.4l-8.7-8.7c-.3-.3-.4-.7-.4-1.1 0-.4.1-.8.4-1.1l2.8-2.8c1.8-1.4 4.1-1.8 6.3-1.1l-.9.9c-1.7-.5-3.5-.2-4.9.9l-2.8 2.8 8.7 8.7 2.8-2.8c1.1-1.4 1.4-3.2.9-4.9l.9-.9z" />
            )}
          </svg>
        )
      }
    }
    return icons
  }

  return (
    <div className="absolute left-1/2 bottom-28 transform -translate-x-1/2 flex justify-center items-center gap-4 pointer-events-none select-none w-full max-w-lg">
      <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
        {createIcons(health, maxHealth, 'health')}
      </div>
      <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded">
        {createIcons(hunger, maxHunger, 'hunger')}
      </div>
    </div>
  )
}

export default StatusBars 