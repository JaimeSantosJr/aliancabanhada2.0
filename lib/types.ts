export type ProductCategory = 'alianca' | 'solitario'
export type ProductMaterial = 'Ouro banhado' | 'Ouro'

export interface Product {
  id: string
  name: string
  description: string
  price: number
  image_url: string
  category: ProductCategory | string
  material: ProductMaterial | string
  size_range: string | null
  in_stock: boolean
  created_at?: string
  updated_at?: string
  slug?: string | null
}

export interface CartItem {
  product: Product
  /** Tamanho único, ou tamanho da 1ª aliança no par */
  size: string
  /** Tamanho da 2ª aliança (somente par) */
  size2?: string | null
  /** Par de alianças (cobra 2× o preço unitário) */
  isPair: boolean
  quantity: number
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  is_admin?: boolean
}

export interface Order {
  id: string
  user_id: string
  status: string
  total_price: number
  subtotal?: number | null
  shipping_cost?: number | null
  tracking_code?: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  shipping_street?: string | null
  shipping_number?: string | null
  shipping_complement?: string | null
  shipping_neighborhood?: string | null
  shipping_city?: string | null
  shipping_state?: string | null
  shipping_zip?: string | null
  payment_method?: string | null
  payment_status?: string | null
  notes?: string | null
  order_number?: string | null
  created_at: string
  updated_at?: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price?: number | null
  size?: string | null
  product_name?: string | null
  created_at?: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  alianca: 'Aliança',
  solitario: 'Solitário',
}

export const MATERIAL_LABELS: Record<string, string> = {
  'Ouro banhado': 'Banho de ouro',
  Ouro: 'Ouro',
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  preparing: 'Em preparo',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export function isAlianca(category: string) {
  return category === 'alianca'
}

export function cartItemKey(item: Pick<CartItem, 'product' | 'size' | 'size2' | 'isPair'>) {
  if (item.isPair) {
    return `${item.product.id}|pair|${item.size}|${item.size2 || ''}`
  }
  return `${item.product.id}|unit|${item.size}`
}

/** Preço cobrado por unidade de linha (par = 2 anéis) */
export function cartUnitPrice(item: CartItem) {
  const base = Number(item.product.price)
  return item.isPair ? base * 2 : base
}

export function formatCartSize(item: CartItem) {
  if (item.isPair) {
    return `Par · tam. ${item.size} + ${item.size2}`
  }
  return `Tamanho ${item.size}`
}

/** Valor gravado em order_items.size */
export function orderSizeLabel(item: CartItem) {
  if (item.isPair) {
    return `Par: ${item.size} + ${item.size2}`
  }
  return item.size
}
