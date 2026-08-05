import { calcShipping, STORE } from '@/lib/store-config'
import { createRouteClient } from '@/lib/supabase/route'
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
  payment_method: 'pix' | 'transferencia'
  notes?: string
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

    const ids = [...new Set(body.items.map((i) => i.product_id))]
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id,name,price,in_stock')
      .in('id', ids)

    if (prodErr || !products?.length) {
      return NextResponse.json({ error: 'Produtos inválidos.' }, { status: 400 })
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

    const shipping_cost = calcShipping(subtotal)
    const total_price = Number((subtotal + shipping_cost).toFixed(2))

    const { data: orderNumber } = await supabase.rpc('next_order_number')
    const order_number =
      typeof orderNumber === 'string' ? orderNumber : `AB-${Date.now().toString().slice(-8)}`

    const orderPayload = {
      user_id: user.id,
      status: 'pending',
      subtotal: Number(subtotal.toFixed(2)),
      shipping_cost,
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
      payment_method: body.payment_method === 'transferencia' ? 'transferencia' : 'pix',
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
              ? 'Banco desatualizado. Execute supabase/hardening.sql no Supabase.'
              : orderErr?.message || 'Não foi possível criar o pedido.',
        },
        { status: 500 },
      )
    }

    const { error: itemsErr } = await supabase.from('order_items').insert(
      lines.map((l) => ({ ...l, order_id: order.id })),
    )

    if (itemsErr) {
      console.error(itemsErr)
      return NextResponse.json(
        { error: 'Pedido criado, mas itens falharam. Fale conosco com o número do pedido.' },
        { status: 500 },
      )
    }

    // Atualiza endereço do perfil (sem tocar is_admin)
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

    // Baixa estoque quando aplicável
    try {
      await supabase.rpc('mark_products_sold', { p_ids: ids })
    } catch {
      /* opcional se RPC ainda não existir */
    }

    // E-mail opcional (Resend)
    try {
      const { sendOrderEmails } = await import('@/lib/email')
      await sendOrderEmails({
        orderId: order.id,
        orderNumber: order.order_number || order_number,
        customerEmail: orderPayload.customer_email,
        customerName: orderPayload.customer_name,
        total: total_price,
        paymentMethod: orderPayload.payment_method,
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
      pixKey: STORE.pixKey,
      pixBeneficiary: STORE.pixBeneficiary,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro interno ao criar pedido.' }, { status: 500 })
  }
}
