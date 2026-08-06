import {
  getOrder,
  getPayment,
  normalizeOrderPayment,
  verifyMercadoPagoSignature,
} from '@/lib/mercado-pago'
import { createServiceClient } from '@/lib/supabase/route'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function markOrderFromPayment(opts: {
  storeOrderId: string
  paymentId: string
  status: string
  amount: number
}) {
  const supabase = createServiceClient()
  if (!supabase) {
    console.error('webhook mp: SUPABASE_SERVICE_ROLE_KEY ausente')
    return
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id,total_price,payment_status,mp_payment_id,status')
    .eq('id', opts.storeOrderId)
    .maybeSingle()

  if (!order) {
    console.warn('webhook mp: pedido não encontrado', opts.storeOrderId)
    return
  }

  if (order.mp_payment_id === String(opts.paymentId) && order.payment_status === 'paid') {
    return
  }

  const expected = Number(order.total_price)
  if (opts.status === 'approved' && Math.abs(opts.amount - expected) > 0.05) {
    console.warn('webhook mp: valor divergente', {
      amount: opts.amount,
      expected,
      orderId: opts.storeOrderId,
    })
    return
  }

  if (opts.status === 'approved') {
    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: order.status === 'pending' ? 'paid' : order.status,
        mp_payment_id: String(opts.paymentId),
        mp_status: opts.status,
      })
      .eq('id', opts.storeOrderId)

    try {
      const { markOrderProductsSold } = await import('@/lib/stock')
      await markOrderProductsSold(opts.storeOrderId, supabase)
    } catch (e) {
      console.warn('stock paid skip', e)
    }

    try {
      const { sendPaymentApprovedEmail } = await import('@/lib/email')
      const { data: full } = await supabase
        .from('orders')
        .select('order_number,customer_email,customer_name,total_price')
        .eq('id', opts.storeOrderId)
        .maybeSingle()
      if (full?.customer_email) {
        await sendPaymentApprovedEmail({
          orderId: opts.storeOrderId,
          orderNumber: full.order_number || opts.storeOrderId.slice(0, 8),
          customerEmail: full.customer_email,
          customerName: full.customer_name || 'Cliente',
          total: Number(full.total_price),
        })
      }
    } catch (e) {
      console.warn('email paid skip', e)
    }
    return
  }

  if (opts.status === 'rejected' || opts.status === 'cancelled' || opts.status === 'refunded') {
    await supabase
      .from('orders')
      .update({
        payment_status: opts.status === 'refunded' ? 'refunded' : 'failed',
        mp_payment_id: String(opts.paymentId),
        mp_status: opts.status,
      })
      .eq('id', opts.storeOrderId)
    return
  }

  await supabase
    .from('orders')
    .update({
      mp_payment_id: String(opts.paymentId),
      mp_status: opts.status,
      payment_status:
        opts.status === 'pending' || opts.status === 'in_process'
          ? 'pending'
          : order.payment_status,
    })
    .eq('id', opts.storeOrderId)
}

async function processPaymentId(paymentId: string) {
  // Orders API (Checkout Transparente atual)
  if (paymentId.startsWith('ORD') || paymentId.startsWith('PAY')) {
    try {
      const orderId = paymentId.startsWith('PAY')
        ? null
        : paymentId
      if (orderId) {
        const order = await getOrder(orderId)
        const normalized = normalizeOrderPayment(order)
        if (!normalized.externalReference) {
          console.warn('webhook mp: order sem external_reference', paymentId)
          return
        }
        await markOrderFromPayment({
          storeOrderId: normalized.externalReference,
          paymentId: normalized.id,
          status: normalized.status,
          amount: normalized.amount,
        })
        return
      }
    } catch (e) {
      console.warn('webhook mp order lookup', paymentId, e)
    }
  }

  // Fallback Payment API clássica
  try {
    const payment = await getPayment(paymentId)
    const storeOrderId =
      (payment.external_reference as string | undefined) ||
      (payment.metadata as { order_id?: string } | undefined)?.order_id

    if (!storeOrderId) {
      console.warn('webhook mp: sem external_reference', paymentId)
      return
    }

    const status = String(payment.status || '')
    const amount = Number(payment.transaction_amount || 0)
    const currency = String(payment.currency_id || '')
    if (currency && currency !== 'BRL') {
      console.warn('webhook mp: moeda inválida', currency)
      return
    }

    await markOrderFromPayment({
      storeOrderId,
      paymentId,
      status,
      amount,
    })
  } catch (e) {
    console.warn('webhook mp payment lookup', paymentId, e)
  }
}

export async function POST(request: Request) {
  try {
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.MERCADO_PAGO_WEBHOOK_SECRET
    ) {
      console.error('webhook mp: MERCADO_PAGO_WEBHOOK_SECRET ausente em produção')
      return NextResponse.json({ error: 'Webhook não configurado' }, { status: 503 })
    }

    const url = new URL(request.url)
    const body = await request.json().catch(() => ({}))

    const dataId =
      url.searchParams.get('data.id') ||
      String(body?.data?.id || body?.id || '') ||
      null
    const type = url.searchParams.get('type') || body?.type || body?.topic || ''

    const ok = verifyMercadoPagoSignature({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId,
    })

    if (!ok) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }

    if (
      (type === 'payment' ||
        type === 'order' ||
        body?.action?.includes('payment') ||
        body?.action?.includes('order') ||
        dataId) &&
      dataId
    ) {
      await processPaymentId(String(dataId))
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('webhook mp', e)
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'mercado-pago-webhook' })
}
