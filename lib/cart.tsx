'use client'

import type { CartItem, Product } from '@/lib/types'
import { cartItemKey, cartUnitPrice } from '@/lib/types'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'alianca-banhada-cart-v2'

type AddItemInput = {
  product: Product
  size: string
  size2?: string | null
  isPair?: boolean
  quantity?: number
}

type CartContextValue = {
  items: CartItem[]
  count: number
  subtotal: number
  addItem: (input: AddItemInput) => void
  removeItem: (key: string) => void
  updateQuantity: (key: string, quantity: number) => void
  clear: () => void
  ready: boolean
}

const CartContext = createContext<CartContextValue | null>(null)

function normalizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item?.product?.id || !item?.size) return null
      return {
        product: item.product,
        size: String(item.size),
        size2: item.size2 ? String(item.size2) : null,
        isPair: Boolean(item.isPair),
        quantity: Math.max(1, Number(item.quantity) || 1),
      } as CartItem
    })
    .filter(Boolean) as CartItem[]
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('alianca-banhada-cart')
      if (raw) setItems(normalizeItems(JSON.parse(raw)))
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, ready])

  const addItem = useCallback((input: AddItemInput) => {
    const nextItem: CartItem = {
      product: input.product,
      size: input.size,
      size2: input.isPair ? input.size2 || null : null,
      isPair: Boolean(input.isPair),
      quantity: input.quantity ?? 1,
    }
    const key = cartItemKey(nextItem)

    setItems((prev) => {
      const idx = prev.findIndex((i) => cartItemKey(i) === key)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + nextItem.quantity }
        return copy
      }
      return [...prev, nextItem]
    })
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => cartItemKey(i) !== key))
  }, [])

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => (cartItemKey(i) === key ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0),
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0)
    const subtotal = items.reduce((s, i) => s + cartUnitPrice(i) * i.quantity, 0)
    return { items, count, subtotal, addItem, removeItem, updateQuantity, clear, ready }
  }, [items, addItem, removeItem, updateQuantity, clear, ready])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
