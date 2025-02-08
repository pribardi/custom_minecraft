import React, { useState } from 'react'
import { InventoryState, InventoryItem } from '../../types/inventory'

interface InventoryProps {
  inventory: InventoryState
  onMoveItem: (fromSlot: number, toSlot: number) => void
  onClose: () => void
}

const Inventory: React.FC<InventoryProps> = ({ inventory, onMoveItem, onClose }) => {
  const [draggedItem, setDraggedItem] = useState<{ slot: number } | null>(null)
  const { items, hotbarSize, inventorySize } = inventory

  const handleDragStart = (slot: number) => {
    setDraggedItem({ slot })
  }

  const handleDrop = (targetSlot: number) => {
    if (draggedItem && draggedItem.slot !== targetSlot) {
      onMoveItem(draggedItem.slot, targetSlot)
    }
    setDraggedItem(null)
  }

  const renderSlot = (slot: number, item: InventoryItem | undefined) => (
    <div
      key={slot}
      className={`w-16 h-16 bg-gray-700/80 rounded flex items-center justify-center relative cursor-pointer hover:bg-gray-600/80 transition-colors border border-gray-600 ${
        draggedItem?.slot === slot ? 'opacity-50' : ''
      }`}
      draggable={!!item}
      onDragStart={() => handleDragStart(slot)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => handleDrop(slot)}
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
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-800/95 p-6 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl text-white font-bold">Inventory</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Main inventory grid */}
        <div className="grid grid-cols-9 gap-1 mb-4">
          {Array.from({ length: inventorySize - hotbarSize }).map((_, i) => {
            const slot = i + hotbarSize
            const item = items.find(item => item.slot === slot)
            return renderSlot(slot, item)
          })}
        </div>

        {/* Hotbar */}
        <div className="grid grid-cols-9 gap-1">
          {Array.from({ length: hotbarSize }).map((_, i) => {
            const item = items.find(item => item.slot === i)
            return renderSlot(i, item)
          })}
        </div>
      </div>
    </div>
  )
}

export default Inventory 