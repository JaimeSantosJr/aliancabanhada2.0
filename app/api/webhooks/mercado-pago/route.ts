import { getPayment, verifyMercadoPagoSignature } from '@/lib/mercado-pago'
import { createServiceClient } from '@/lib/supabase/route'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function processPaymentId(paymentId: string) {
  const supabase = createServiceClient()
  if (!supabase) {
    console.error('webhook mp: SUPABASE_SERVICE_ROLE_KEY ausente')
    return
  }

  const payment = await getPayment(paymentId)
  const orderId =
    (payment.external_reference as string | undefined) ||
    (payment.metadata as { order_id?: string } | undefined)?.order_id

  if (!orderId) {
    console.warn('webhook mp: sem external_reference', paymentId)
    return
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id,total_price,payment_status,mp_payment_id,status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    console.warn('webhook mp: pedido não encontrado', orderId)
    return
  }

  // Idempotência
  if (order.mp_payment_id === String(paymentId) && order.payment_status === 'paid') {
    return
  }

  const status = String(payment.status || '')
  const amount = Number(payment.transaction_amount || 0)
  const currency = String(payment.currency_id || '')

  if (currency && currency !== 'BRL') {
    console.warn('webhook mp: moeda inválida', currency)
    return
  }

  const expected = Number(order.total_price)
  if (status === 'approved' && Math.abs(amount - expected) > 0.05) {
    console.warn('webhook mp: valor divergente', { amount, expected, orderId })
    return
  }

  if (status === 'approved') {
    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: order.status === 'pending' ? 'paid' : order.status,
        mp_payment_id: String(paymentId),
        mp_status: status,
      })
      .eq('id', orderId)

    try {
      const { sendPaymentApprovedEmail } = await import('@/lib/email')
      const { data: full } = await supabase
        .from('orders')
        .select('order_number,customer_email,customer_name,total_price')
        .eq('id', orderId)
        .maybeSingle()
      if (full?.customer_email) {
        await sendPaymentApprovedEmail({
          orderId,
          orderNumber: full.order_number || orderId.slice(0, 8),
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

  if (status === 'rejected' || status === 'cancelled' || status === 'refunded') {
    await supabase
      .from('orders')
      .update({
        payment_status: status === 'refunded' ? 'refunded' : 'failed',
        mp_payment_id: String(paymentId),
        mp_status: status,
      })
      .eq('id', orderId)
    return
  }

  await supabase
    .from('orders')
    .update({
      mp_payment_id: String(paymentId),
      mp_status: status,
      payment_status: status === 'pending' || status === 'in_process' ? 'pending' : order.payment_status,
    })
    .eq('id', orderId)
}

export async function POST(request: Request) {
  try {
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

    // Responde rápido; processa payment
    if ((type === 'payment' || body?.action?.includes('payment') || dataId) && dataId) {
      // processa sem bloquear demais — mas await curto é ok
      await processPaymentId(String(dataId))
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('webhook mp', e)
    // Ainda 200 para evitar storm de retries em erro interno transitório após validação
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'mercado-pago-webhook' })
}
