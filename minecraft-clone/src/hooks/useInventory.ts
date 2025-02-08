import { useReducer, useCallback, useEffect } from 'react'
import { BlockType } from '../types/blocks'
import { InventoryState, InventoryAction, InventoryItem } from '../types/inventory'

const initialState: InventoryState = {
  items: [],
  selectedSlot: 0,
  maxStackSize: 64,
  hotbarSize: 9,
  inventorySize: 36
}

function inventoryReducer(state: InventoryState, action: InventoryAction): InventoryState {
  switch (action.type) {
    case 'SELECT_SLOT':
      return {
        ...state,
        selectedSlot: action.slot >= 0 && action.slot < state.hotbarSize ? action.slot : state.selectedSlot
      }

    case 'ADD_ITEM': {
      const count = action.count || 1
      const existingItem = state.items.find(item => 
        item.type === action.item && item.count < state.maxStackSize
      )

      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item === existingItem
              ? { ...item, count: Math.min(item.count + count, state.maxStackSize) }
              : item
          )
        }
      }

      // Find first empty slot
      const emptySlot = Array.from({ length: state.inventorySize })
        .findIndex((_, index) => !state.items.some(item => item.slot === index))

      if (emptySlot === -1) return state // Inventory is full

      return {
        ...state,
        items: [
          ...state.items,
          { type: action.item, count, slot: emptySlot }
        ]
      }
    }

    case 'REMOVE_ITEM': {
      const count = action.count || 1
      const item = state.items.find(item => item.slot === action.slot)
      if (!item) return state

      if (item.count <= count) {
        return {
          ...state,
          items: state.items.filter(i => i !== item)
        }
      }

      return {
        ...state,
        items: state.items.map(i =>
          i === item ? { ...i, count: i.count - count } : i
        )
      }
    }

    case 'MOVE_ITEM': {
      const fromItem = state.items.find(item => item.slot === action.fromSlot)
      const toItem = state.items.find(item => item.slot === action.toSlot)

      if (!fromItem) return state

      if (!toItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item === fromItem ? { ...item, slot: action.toSlot } : item
          )
        }
      }

      if (toItem.type === fromItem.type && toItem.count < state.maxStackSize) {
        const totalCount = toItem.count + fromItem.count
        const toItemCount = Math.min(totalCount, state.maxStackSize)
        const fromItemCount = totalCount - toItemCount

        return {
          ...state,
          items: state.items
            .filter(item => item !== fromItem || fromItemCount > 0)
            .map(item => {
              if (item === toItem) return { ...item, count: toItemCount }
              if (item === fromItem) return { ...item, count: fromItemCount }
              return item
            })
        }
      }

      return state
    }

    case 'SWAP_ITEMS': {
      const item1 = state.items.find(item => item.slot === action.slot1)
      const item2 = state.items.find(item => item.slot === action.slot2)

      if (!item1 && !item2) return state

      return {
        ...state,
        items: state.items.map(item => {
          if (item === item1) return { ...item, slot: action.slot2 }
          if (item === item2) return { ...item, slot: action.slot1 }
          return item
        })
      }
    }

    default:
      return state
  }
}

export function useInventory() {
  const [state, dispatch] = useReducer(inventoryReducer, initialState)

  const selectSlot = useCallback((slot: number) => {
    dispatch({ type: 'SELECT_SLOT', slot })
  }, [])

  const addItem = useCallback((item: BlockType, count?: number) => {
    dispatch({ type: 'ADD_ITEM', item, count })
  }, [])

  const removeItem = useCallback((slot: number, count?: number) => {
    dispatch({ type: 'REMOVE_ITEM', slot, count })
  }, [])

  const moveItem = useCallback((fromSlot: number, toSlot: number) => {
    dispatch({ type: 'MOVE_ITEM', fromSlot, toSlot })
  }, [])

  const swapItems = useCallback((slot1: number, slot2: number) => {
    dispatch({ type: 'SWAP_ITEMS', slot1, slot2 })
  }, [])

  // Handle number keys 1-9 for hotbar selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key)
      if (num >= 1 && num <= state.hotbarSize) {
        selectSlot(num - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectSlot, state.hotbarSize])

  return {
    inventory: state,
    selectSlot,
    addItem,
    removeItem,
    moveItem,
    swapItems,
    getSelectedItem: () => state.items.find(item => item.slot === state.selectedSlot)
  }
} 