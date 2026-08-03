import type { Product } from './types'

export function formatPrice(value: number | string) {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseSizes(sizeRange: string | null | undefined): string[] {
  if (!sizeRange) {
    return Array.from({ length: 13 }, (_, i) => String(i + 12))
  }
  const parts = sizeRange.split(/[,;/|]+/).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) {
    return Array.from({ length: 13 }, (_, i) => String(i + 12))
  }
  // Map letter sizes to approx Brazilian numbers if needed
  const map: Record<string, string> = { P: '14', M: '16', G: '18', GG: '20' }
  return parts.map((p) => map[p.toUpperCase()] ?? p)
}

export function productHref(product: Product) {
  return `/produto/${product.id}`
}

export function categoryLabel(category: string) {
  if (category === 'alianca') return 'Aliança'
  if (category === 'solitario') return 'Solitário'
  return category
}

export function materialLabel(material: string) {
  if (material === 'Ouro banhado') return 'Banho de ouro'
  if (material === 'Ouro') return 'Ouro'
  return material
}
