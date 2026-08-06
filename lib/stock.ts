import { createServiceClient } from '@/lib/supabase/route'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function publicDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Baixa estoque dos produtos de um pedido (após pagamento aprovado). */
export async function markOrderProductsSold(
  orderId: string,
  client?: SupabaseClient | null,
) {
  const db = client || createServiceClient()
  if (!db) return

  const { data: items } = await db
    .from('order_items')
    .select('product_id')
    .eq('order_id', orderId)

  const ids = [...new Set((items || []).map((i) => i.product_id).filter(Boolean))]
  if (!ids.length) return

  try {
    await db.rpc('mark_products_sold', { p_ids: ids })
  } catch (e) {
    console.warn('mark_products_sold', orderId, e)
  }
}

/** True se todos os produtos informados existem e têm frete grátis. */
export async function productsAllFreeShipping(
  productIds: string[],
  client?: SupabaseClient | null,
): Promise<boolean> {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (!ids.length) return false

  const db = client || createServiceClient() || publicDb()
  if (!db) return false

  const { data } = await db.from('products').select('id,free_shipping').in('id', ids)
  if (!data || data.length !== ids.length) return false
  return data.every((p) => Boolean(p.free_shipping))
}
