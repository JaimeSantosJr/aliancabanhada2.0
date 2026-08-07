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
  free_shipping?: boolean | null
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
  discount_amount?: number | null
  coupon_code?: string | null
  shipping_service_id?: string | null
  shipping_service_name?: string | null
  shipping_company?: string | null
  shipping_delivery_days?: number | null
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
  payment_attempt_count?: number | null
  payment_last_attempt_at?: string | null
  mp_preference_id?: string | null
  mp_payment_id?: string | null
  mp_status?: string | null
  mp_init_point?: string | null
  notes?: string | null
  order_number?: string | null
  created_at: string
  updated_at?: string
}

export interface Coupon {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_subtotal: number
  max_uses: number | null
  used_count: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at?: string
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
  paid: 'Pagamento confirmado',
  preparing: 'Em separação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pagamento pendente',
  paid: 'Pago',
  failed: 'Pagamento recusado',
  refunded: 'Estornado',
}

/** Etapas visíveis ao cliente (estilo acompanhamento de compra). */
export const ORDER_TRACK_STEPS = [
  { key: 'pending', label: 'Pedido feito', hint: 'Registramos seu pedido' },
  { key: 'paid', label: 'Pagamento', hint: 'Pagamento confirmado' },
  { key: 'preparing', label: 'Em separação', hint: 'Sua peça está sendo preparada' },
  { key: 'shipped', label: 'Enviado', hint: 'Saiu para entrega' },
  { key: 'delivered', label: 'Entregue', hint: 'Chegou até você' },
] as const

export function orderTrackIndex(status: string): number {
  if (status === 'cancelled') return -1
  const idx = ORDER_TRACK_STEPS.findIndex((s) => s.key === status)
  if (idx >= 0) return idx
  // payment_status paid mas status ainda pending → trata como pago
  if (status === 'paid') return 1
  return 0
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
