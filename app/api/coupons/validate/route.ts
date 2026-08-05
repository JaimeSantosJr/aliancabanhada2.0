import { validateCoupon } from '@/lib/coupons'
import { createRouteClient, createServiceClient } from '@/lib/supabase/route'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const code = String(body?.code || '')
    const subtotal = Number(body?.subtotal || 0)
    if (!code.trim()) {
      return NextResponse.json({ error: 'Informe um cupom.' }, { status: 400 })
    }

    const routeClient = await createRouteClient()
    const {
      data: { user },
    } = await routeClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Faça login para usar cupom.' }, { status: 401 })
    }

    // Service role lê cupons (sem SELECT público); cai no client autenticado se ausente
    const db = createServiceClient() || routeClient
    const result = await validateCoupon(db, code, subtotal)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      code: result.code,
      discount: result.discount,
      discount_type: result.coupon.discount_type,
      discount_value: result.coupon.discount_value,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Não foi possível validar o cupom.' }, { status: 500 })
  }
}
