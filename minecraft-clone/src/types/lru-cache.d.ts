declare module 'lru-cache' {
  export interface Options<K = any, V = any> {
    max?: number
    ttl?: number
    updateAgeOnGet?: boolean
    dispose?: (value: V, key: K, cache: LRUCache<K, V>) => void
    maxSize?: number
    sizeCalculation?: (value: V, key: K) => number
    allowStale?: boolean
  }

  export default class LRUCache<K = any, V = any> {
    constructor(options?: Options<K, V>)
    set(key: K, value: V): this
    get(key: K): V | undefined
    has(key: K): boolean
    delete(key: K): boolean
    clear(): void
    keys(): IterableIterator<K>
    values(): IterableIterator<V>
    entries(): IterableIterator<[K, V]>
    readonly size: number
    readonly max: number
    readonly maxSize: number | undefined
    readonly allowStale: boolean
  }
} 