'use client'

import { categoryLabel, formatPrice, materialLabel, productHref } from '@/lib/format'
import type { Product } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (!open) return
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('products').select('*').eq('in_stock', true)
      setProducts((data as Product[]) || [])
    }
    load()
  }, [open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products.slice(0, 6)
    return products.filter((p) => {
      const hay = `${p.name} ${p.description} ${p.category} ${p.material}`.toLowerCase()
      return hay.includes(q)
    }).slice(0, 12)
  }, [products, query])

  if (!open) return null

  return (
    <div className="search-overlay" onClick={onClose} role="presentation">
      <div className="search-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <button type="button" className="search-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <input
          type="search"
          placeholder="Buscar alianças e solitários..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="search-input"
        />
        <div className="search-tags">
          {['aliança', 'solitário', 'banho de ouro', 'ouro'].map((tag) => (
            <button key={tag} type="button" onClick={() => setQuery(tag)}>
              {tag}
            </button>
          ))}
        </div>
        <ul className="search-results">
          {results.map((p) => (
            <li key={p.id}>
              <Link href={productHref(p)} onClick={onClose}>
                <span>{p.name}</span>
                <span>
                  {categoryLabel(p.category)} · {materialLabel(p.material)} · {formatPrice(p.price)}
                </span>
              </Link>
            </li>
          ))}
          {results.length === 0 && <li className="search-empty">Nenhuma peça encontrada.</li>}
        </ul>
      </div>
    </div>
  )
}
