import { BlockType } from './blocks'

export interface InventoryItem {
  type: BlockType
  count: number
  slot: number
}

export interface InventoryState {
  items: InventoryItem[]
  selectedSlot: number
  maxStackSize: number
  hotbarSize: number
  inventorySize: number
}

export type InventoryAction = 
  | { type: 'SELECT_SLOT'; slot: number }
  | { type: 'ADD_ITEM'; item: BlockType; count?: number }
  | { type: 'REMOVE_ITEM'; slot: number; count?: number }
  | { type: 'MOVE_ITEM'; fromSlot: number; toSlot: number }
  | { type: 'SWAP_ITEMS'; slot1: number; slot2: number } 