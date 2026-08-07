import { validateCoupon } from '@/lib/coupons'
import { resolveSelectedShipping } from '@/lib/melhor-envio'
import { isMercadoPagoConfigured } from '@/lib/mercado-pago'
import { STORE } from '@/lib/store-config'
import { createRouteClient, createServiceClient } from '@/lib/supabase/route'
import { NextResponse } from 'next/server'

type IncomingItem = {
  product_id: string
  quantity: number
  size: string
  isPair?: boolean
  size2?: string | null
}

type Body = {
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_street: string
  shipping_number: string
  shipping_complement?: string
  shipping_neighborhood: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  payment_method?: 'mercadopago' | 'pix' | 'transferencia'
  notes?: string
  coupon_code?: string
  shipping_service_id?: string
  items: IncomingItem[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    if (!body?.items?.length) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 })
    }

    const supabase = await createRouteClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Faça login para finalizar.' }, { status: 401 })
    }

    const ids = [...new Set(body.items.map((i) => i.product_id).filter(Boolean))]
    if (!ids.length) {
      return NextResponse.json(
        { error: 'Carrinho sem produtos válidos. Limpe o carrinho e adicione de novo.' },
        { status: 400 },
      )
    }

    // Preferir service role no checkout (evita RLS / schema desatualizado no client).
    const db = createServiceClient() || supabase

    let products: Array<{
      id: string
      name: string
      price: number
      in_stock: boolean
      free_shipping?: boolean | null
    }> | null = null
    let prodErr: { message?: string; code?: string } | null = null

    {
      const first = await db
        .from('products')
        .select('id,name,price,in_stock,free_shipping')
        .in('id', ids)

      if (
        first.error &&
        (first.error.message?.includes('free_shipping') || first.error.code === 'PGRST204')
      ) {
        const fallback = await db
          .from('products')
          .select('id,name,price,in_stock')
          .in('id', ids)
        products = (fallback.data as typeof products) || null
        prodErr = fallback.error
      } else {
        products = (first.data as typeof products) || null
        prodErr = first.error
      }
    }

    if (prodErr) {
      console.error('orders products query', prodErr)
      return NextResponse.json(
        {
          error: prodErr.message?.includes('free_shipping')
            ? 'Banco desatualizado. Execute supabase/security.sql no Supabase (coluna free_shipping).'
            : `Não foi possível ler os produtos: ${prodErr.message || 'erro desconhecido'}`,
        },
        { status: 400 },
      )
    }

    if (!products?.length) {
      return NextResponse.json(
        {
          error:
            'Produtos do carrinho não existem mais no catálogo. Esvazie o carrinho, adicione as peças de novo e tente outra vez.',
          code: 'STALE_CART',
        },
        { status: 400 },
      )
    }

    if (products.length < ids.length) {
      return NextResponse.json(
        {
          error:
            'Algum produto do carrinho foi removido ou alterado. Esvazie o carrinho e adicione de novo.',
          code: 'STALE_CART',
        },
        { status: 400 },
      )
    }

    const byId = new Map(products.map((p) => [p.id, p]))
    let subtotal = 0
    const lines: {
      product_id: string
      quantity: number
      unit_price: number
      size: string
      product_name: string
    }[] = []

    for (const item of body.items) {
      const product = byId.get(item.product_id)
      if (!product) {
        return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 400 })
      }
      if (!product.in_stock) {
        return NextResponse.json(
          { error: `"${product.name}" está indisponível.` },
          { status: 400 },
        )
      }
      const qty = Math.max(1, Math.min(20, Number(item.quantity) || 1))
      const isPair = Boolean(item.isPair)
      const unit = Number(product.price) * (isPair ? 2 : 1)
      const sizeLabel = isPair
        ? `Par: ${item.size || '?'} / ${item.size2 || '?'}`
        : item.size || ''

      subtotal += unit * qty
      lines.push({
        product_id: product.id,
        quantity: qty,
        unit_price: unit,
        size: sizeLabel,
        product_name: isPair ? `${product.name} (Par)` : product.name,
      })
    }

    subtotal = Number(subtotal.toFixed(2))

    // Cupom (validado no servidor)
    let discount_amount = 0
    let coupon_code: string | null = null
    let couponId: string | null = null
    if (body.coupon_code?.trim()) {
      const db = createServiceClient() || supabase
      const couponResult = await validateCoupon(db, body.coupon_code, subtotal)
      if (!couponResult.ok) {
        return NextResponse.json({ error: couponResult.error }, { status: 400 })
      }
      discount_amount = couponResult.discount
      coupon_code = couponResult.code
      couponId = couponResult.coupon.id
    }

    const afterDiscount = Number(Math.max(0, subtotal - discount_amount).toFixed(2))
    const freeShipping = products.length > 0 && products.every((p) => Boolean(p.free_shipping))

    const shipping = await resolveSelectedShipping({
      destinationCep: body.shipping_zip,
      insuranceValue: afterDiscount,
      selectedId: body.shipping_service_id,
      quantity: Math.max(
        1,
        lines.reduce((s, l) => s + l.quantity, 0),
      ),
      freeShipping,
    })

    const shipping_cost = Number(shipping.price.toFixed(2))
    const total_price = Number((afterDiscount + shipping_cost).toFixed(2))

    const mpEnabled = isMercadoPagoConfigured()
    let payment_method: 'mercadopago' | 'pix' | 'transferencia' = 'pix'
    if (body.payment_method === 'transferencia') payment_method = 'transferencia'
    else if (body.payment_method === 'mercadopago' || (mpEnabled && body.payment_method !== 'pix')) {
      payment_method = mpEnabled ? 'mercadopago' : 'pix'
    } else if (body.payment_method === 'pix') {
      payment_method = 'pix'
    } else if (mpEnabled) {
      payment_method = 'mercadopago'
    }

    const { data: orderNumber } = await supabase.rpc('next_order_number')
    const order_number =
      typeof orderNumber === 'string' ? orderNumber : `AB-${Date.now().toString().slice(-8)}`

    const orderPayload = {
      user_id: user.id,
      status: 'pending',
      subtotal,
      discount_amount,
      coupon_code,
      shipping_cost,
      shipping_service_id: shipping.id,
      shipping_service_name: shipping.name,
      shipping_company: shipping.company,
      shipping_delivery_days: shipping.deliveryDays,
      total_price,
      customer_name: body.customer_name.trim(),
      customer_email: body.customer_email.trim().toLowerCase(),
      customer_phone: body.customer_phone.trim(),
      shipping_street: body.shipping_street.trim(),
      shipping_number: body.shipping_number.trim(),
      shipping_complement: body.shipping_complement?.trim() || null,
      shipping_neighborhood: body.shipping_neighborhood.trim(),
      shipping_city: body.shipping_city.trim(),
      shipping_state: body.shipping_state.trim().toUpperCase().slice(0, 2),
      shipping_zip: body.shipping_zip.replace(/\D/g, ''),
      payment_method,
      payment_status: 'pending',
      notes: body.notes?.trim() || null,
      order_number,
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('*')
      .single()

    if (orderErr || !order) {
      console.error(orderErr)
      return NextResponse.json(
        {
          error:
            orderErr?.message?.includes('column') || orderErr?.code === 'PGRST204'
              ? 'Banco desatualizado. Execute supabase/commerce-integrations.sql no Supabase.'
              : orderErr?.message || 'Não foi possível criar o pedido.',
        },
        { status: 500 },
      )
    }

    const { error: itemsErr } = await supabase.from('order_items').insert(
      lines.map((l) => ({
        ...l,
        order_id: order.id,
        price_at_purchase: l.unit_price,
      })),
    )

    if (itemsErr) {
      console.error(itemsErr)
      return NextResponse.json(
        { error: 'Pedido criado, mas itens falharam. Fale conosco com o número do pedido.' },
        { status: 500 },
      )
    }

    if (couponId && discount_amount > 0) {
      const db = createServiceClient() || supabase
      await db.rpc('redeem_coupon', {
        p_coupon_id: couponId,
        p_order_id: order.id,
        p_user_id: user.id,
        p_discount: discount_amount,
      })
    }

    await supabase
      .from('profiles')
      .update({
        full_name: orderPayload.customer_name,
        email: orderPayload.customer_email,
        phone: orderPayload.customer_phone,
        street: orderPayload.shipping_street,
        number: orderPayload.shipping_number,
        complement: orderPayload.shipping_complement,
        neighborhood: orderPayload.shipping_neighborhood,
        city: orderPayload.shipping_city,
        state: orderPayload.shipping_state,
        zip_code: orderPayload.shipping_zip,
      })
      .eq('id', user.id)

    // Estoque só baixa após pagamento aprovado (webhook / API de pagamento / admin).

    // Checkout Transparente: pagamento na página do pedido (Payment Brick), sem redirect Pro.
    if (payment_method === 'mercadopago' && !mpEnabled) {
      console.warn('Mercado Pago solicitado mas não configurado')
    }

    try {
      const { sendOrderEmails } = await import('@/lib/email')
      await sendOrderEmails({
        orderId: order.id,
        orderNumber: order.order_number || order_number,
        customerEmail: orderPayload.customer_email,
        customerName: orderPayload.customer_name,
        total: total_price,
        paymentMethod: payment_method,
        subtotal,
        shippingCost: shipping_cost,
        discountAmount: discount_amount,
        couponCode: coupon_code,
        shippingLabel: `${shipping.company} · ${shipping.name}`,
        deliveryDays: shipping.deliveryDays,
        items: lines.map((l) => ({
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          size: l.size,
        })),
        address: {
          street: orderPayload.shipping_street,
          number: orderPayload.shipping_number,
          complement: orderPayload.shipping_complement,
          neighborhood: orderPayload.shipping_neighborhood,
          city: orderPayload.shipping_city,
          state: orderPayload.shipping_state,
          zip: orderPayload.shipping_zip,
        },
      })
    } catch (e) {
      console.warn('email skip', e)
    }

    return NextResponse.json({
      id: order.id,
      order_number: order.order_number || order_number,
      total_price,
      shipping_cost,
      subtotal,
      discount_amount,
      coupon_code,
      payment_method,
      checkout_mode: payment_method === 'mercadopago' && mpEnabled ? 'transparent' : null,
      pixKey: STORE.pixKey,
      pixBeneficiary: STORE.pixBeneficiary,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro interno ao criar pedido.' }, { status: 500 })
  }
}
