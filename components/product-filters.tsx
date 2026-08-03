'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const CATEGORIES = [
  { value: '', label: 'Todas' },
  { value: 'alianca', label: 'Alianças' },
  { value: 'solitario', label: 'Solitários' },
]

const MATERIALS = [
  { value: '', label: 'Todos os materiais' },
  { value: 'Ouro banhado', label: 'Banho de ouro' },
  { value: 'Ouro', label: 'Ouro' },
]

export function ProductFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const categoria = params.get('categoria') || ''
  const material = params.get('material') || ''
  const q = params.get('q') || ''
  const ordem = params.get('ordem') || 'recentes'

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (!value) next.delete(key)
    else next.set(key, value)
    router.push(`/loja?${next.toString()}`)
  }

  return (
    <div className="shop-filters">
      <div className="filter-group">
        {CATEGORIES.map((c) => (
          <button
            key={c.value || 'all'}
            type="button"
            className={categoria === c.value ? 'is-active' : ''}
            onClick={() => setParam('categoria', c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <select value={material} onChange={(e) => setParam('material', e.target.value)}>
          {MATERIALS.map((m) => (
            <option key={m.value || 'all-mat'} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select value={ordem} onChange={(e) => setParam('ordem', e.target.value)}>
          <option value="recentes">Mais recentes</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
          <option value="nome">Nome A–Z</option>
        </select>
        <input
          type="search"
          placeholder="Filtrar por nome..."
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
        />
      </div>
    </div>
  )
}
