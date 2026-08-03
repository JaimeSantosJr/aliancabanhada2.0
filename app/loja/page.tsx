'use client'

import { ProductCard } from '@/components/product-card'
import { ProductFilters } from '@/components/product-filters'
import type { Product } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function ShopContent() {
  const params = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const categoria = params.get('categoria') || ''
  const material = params.get('material') || ''
  const q = (params.get('q') || '').toLowerCase()
  const ordem = params.get('ordem') || 'recentes'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      let query = supabase.from('products').select('*').eq('in_stock', true)
      if (categoria) query = query.eq('category', categoria)
      if (material) query = query.eq('material', material)
      const { data } = await query
      setProducts((data as Product[]) || [])
      setLoading(false)
    }
    load()
  }, [categoria, material])

  const filtered = useMemo(() => {
    let list = [...products]
    if (q) {
      list = list.filter((p) =>
        `${p.name} ${p.description} ${p.material} ${p.category}`.toLowerCase().includes(q),
      )
    }
    if (ordem === 'menor') list.sort((a, b) => Number(a.price) - Number(b.price))
    else if (ordem === 'maior') list.sort((a, b) => Number(b.price) - Number(a.price))
    else if (ordem === 'nome') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    else list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    return list
  }, [products, q, ordem])

  return (
    <div className="container page-pad">
      <div className="section-title">
        <h2>Loja</h2>
        <p className="section-sub">Somente alianças e solitários — banho de ouro ou ouro.</p>
      </div>
      <ProductFilters />
      {loading ? (
        <p className="center-msg">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="center-msg">Nenhuma peça com esses filtros.</p>
      ) : (
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LojaPage() {
  return (
    <Suspense fallback={<p className="center-msg">Carregando loja...</p>}>
      <ShopContent />
    </Suspense>
  )
}
