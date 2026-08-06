import { createTransparentPayment, isMercadoPagoConfigured } from '@/lib/mercado-pago'
import { createRouteClient, createServiceClient } from '@/lib/supabase/route'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    if (!isMercadoPagoConfigured()) {
      return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 503 })
    }

    const body = await request.json()
    const orderId = String(body?.orderId || '')
    if (!orderId) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
    }

    // formData do Payment Brick (token, payment_method_id, payer, etc.)
    const { orderId: _omit, ...formData } = body as Record<string, unknown>

    const supabase = await createRouteClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Faça login para pagar.' }, { status: 401 })
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('id,user_id,order_number,total_price,payment_status,customer_email,customer_name,status')
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: 'Pedido não pertence a esta conta.' }, { status: 403 })
    }
    if (order.payment_status === 'paid') {
      return NextResponse.json({
        id: order.id,
        status: 'approved',
        alreadyPaid: true,
      })
    }

    const payment = await createTransparentPayment({
      orderId: order.id,
      orderNumber: order.order_number || order.id.slice(0, 8),
      amount: Number(order.total_price),
      payerEmail: order.customer_email || user.email || '',
      formData,
    })

    const db = createServiceClient() || supabase
    const patch: Record<string, string> = {
      mp_payment_id: payment.id,
      mp_status: payment.status,
    }

    if (payment.status === 'approved') {
      patch.payment_status = 'paid'
      patch.status = order.status === 'pending' ? 'paid' : order.status
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      patch.payment_status = 'failed'
    }

    await db.from('orders').update(patch).eq('id', order.id)

    if (payment.status === 'approved') {
      try {
        const { sendPaymentApprovedEmail } = await import('@/lib/email')
        await sendPaymentApprovedEmail({
          orderId: order.id,
          orderNumber: order.order_number || order.id.slice(0, 8),
          customerEmail: order.customer_email || user.email || '',
          customerName: order.customer_name || 'Cliente',
          total: Number(order.total_price),
        })
      } catch {
        /* opcional */
      }
    }

    return NextResponse.json(payment)
  } catch (e) {
    console.error('mp transparent payment', e)
    const err = e as { message?: string; cause?: { message?: string } }
    const message =
      err?.cause?.message ||
      err?.message ||
      'Não foi possível processar o pagamento.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
