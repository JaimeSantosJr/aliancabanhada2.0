import type { SupabaseClient } from '@supabase/supabase-js'

export type CouponRow = {
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
}

export type CouponValidation =
  | {
      ok: true
      coupon: CouponRow
      discount: number
      code: string
    }
  | {
      ok: false
      error: string
    }

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

export function computeDiscount(coupon: CouponRow, subtotal: number): number {
  if (subtotal <= 0) return 0
  let discount = 0
  if (coupon.discount_type === 'percent') {
    discount = (subtotal * Number(coupon.discount_value)) / 100
  } else {
    discount = Number(coupon.discount_value)
  }
  discount = Math.min(discount, subtotal)
  return Number(Math.max(0, discount).toFixed(2))
}

export async function validateCoupon(
  supabase: SupabaseClient,
  codeInput: string,
  subtotal: number,
): Promise<CouponValidation> {
  const code = normalizeCode(codeInput)
  if (!code) return { ok: false, error: 'Informe um cupom.' }

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .ilike('code', code)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01' || error.message.includes('coupons')) {
      return { ok: false, error: 'Cupons ainda não estão ativos. Execute commerce-integrations.sql.' }
    }
    return { ok: false, error: error.message }
  }

  if (!data) return { ok: false, error: 'Cupom inválido.' }

  const coupon = data as CouponRow
  if (!coupon.is_active) return { ok: false, error: 'Cupom inativo.' }

  const now = Date.now()
  if (coupon.starts_at && now < new Date(coupon.starts_at).getTime()) {
    return { ok: false, error: 'Cupom ainda não está válido.' }
  }
  if (coupon.ends_at && now > new Date(coupon.ends_at).getTime()) {
    return { ok: false, error: 'Cupom expirado.' }
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return { ok: false, error: 'Cupom esgotado.' }
  }
  if (subtotal < Number(coupon.min_subtotal || 0)) {
    return {
      ok: false,
      error: `Pedido mínimo de R$ ${Number(coupon.min_subtotal).toFixed(2).replace('.', ',')} para este cupom.`,
    }
  }

  const discount = computeDiscount(coupon, subtotal)
  if (discount <= 0) return { ok: false, error: 'Cupom sem desconto aplicável.' }

  return { ok: true, coupon, discount, code: coupon.code }
}
