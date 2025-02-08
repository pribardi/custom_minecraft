import React, { useEffect } from 'react'
import { InventoryState } from '../../types/inventory'

interface HotbarProps {
  inventory: InventoryState
  onSelectSlot: (slot: number) => void
}

const Hotbar: React.FC<HotbarProps> = ({ inventory, onSelectSlot }) => {
  const { items, selectedSlot, hotbarSize } = inventory

  // Add keyboard number bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the key is a number between 1-9
      const num = parseInt(e.key)
      if (!isNaN(num) && num >= 1 && num <= hotbarSize) {
        // Convert to 0-based index
        onSelectSlot(num - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSelectSlot, hotbarSize])

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 mb-2 flex gap-1 p-1 bg-gray-800/50 rounded">
      {Array.from({ length: hotbarSize }).map((_, index) => {
        const item = items.find(item => item.slot === index)
        const isSelected = selectedSlot === index

        return (
          <div
            key={index}
            className={`w-16 h-16 bg-gray-700/80 rounded flex items-center justify-center relative cursor-pointer hover:bg-gray-600/80 transition-colors ${
              isSelected ? 'border-2 border-white' : 'border border-gray-600'
            }`}
            onClick={() => onSelectSlot(index)}
          >
            {item && (
              <>
                <div className="w-12 h-12 flex items-center justify-center">
                  <img
                    src={`/textures/${item.type.toLowerCase()}.png`}
                    alt={item.type}
                    className="w-10 h-10 object-contain"
                  />
                </div>
                <span className="absolute bottom-1 right-1 text-white text-sm font-bold">
                  {item.count}
                </span>
              </>
            )}
            {/* Add number indicator */}
            <span className="absolute top-0.5 left-1 text-gray-400 text-xs">
              {index + 1}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default Hotbar 