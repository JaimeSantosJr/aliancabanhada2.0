import {
  PAYMENT_POLICY,
  clientIpFromRequest,
  consumeRateLimit,
  formatRetryMessage,
} from '@/lib/rate-limit'
import { createTransparentPayment, isMercadoPagoConfigured } from '@/lib/mercado-pago'
import { createRouteClient, createServiceClient } from '@/lib/supabase/route'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MAX_ORDER_ATTEMPTS = 10

/** Remove campos que o cliente não pode forçar no pagamento. */
function sanitizeBrickPayload(raw: Record<string, unknown>) {
  const blocked = new Set([
    'orderId',
    'amount',
    'transaction_amount',
    'total_amount',
    'external_reference',
    'description',
    'notification_url',
    'additional_info',
  ])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (blocked.has(k)) continue
    out[k] = v
  }
  return out
}

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

    const formData = sanitizeBrickPayload(body as Record<string, unknown>)

    const supabase = await createRouteClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Faça login para pagar.' }, { status: 401 })
    }

    const ip = clientIpFromRequest(request)
    const ipLimit = await consumeRateLimit(`pay:ip:${ip}`, PAYMENT_POLICY, { recordFail: false })
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: formatRetryMessage(ipLimit.retryAfterSec) },
        { status: 429 },
      )
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(
        'id,user_id,order_number,total_price,payment_status,customer_email,customer_name,status',
      )
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: 'Pedido não pertence a esta conta.' }, { status: 403 })
    }
    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Este pedido foi cancelado.' }, { status: 400 })
    }
    if (order.payment_status === 'paid') {
      return NextResponse.json({
        id: order.id,
        status: 'approved',
        alreadyPaid: true,
      })
    }

    const amount = Number(order.total_price)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valor do pedido inválido.' }, { status: 400 })
    }

    const isPix =
      String(formData.payment_method_id || '') === 'pix' ||
      formData.mode === 'pix' ||
      String(formData.payment_type_id || '') === 'bank_transfer'

    if (!isPix && !formData.token) {
      return NextResponse.json(
        { error: 'Dados do cartão incompletos. Tente novamente.' },
        { status: 400 },
      )
    }

    const db = createServiceClient() || supabase

    if (!isPix) {
      const orderLimit = await consumeRateLimit(`pay:order:${order.id}`, PAYMENT_POLICY)
      if (!orderLimit.allowed) {
        return NextResponse.json(
          {
            error:
              orderLimit.locked || orderLimit.remaining === 0
                ? 'Limite de tentativas de pagamento neste pedido. Aguarde ou fale conosco pelo WhatsApp.'
                : formatRetryMessage(orderLimit.retryAfterSec),
          },
          { status: 429 },
        )
      }
      await consumeRateLimit(`pay:ip:${ip}`, PAYMENT_POLICY)

      try {
        const { data: attemptRow } = await db
          .from('orders')
          .select('payment_attempt_count')
          .eq('id', order.id)
          .maybeSingle()
        const attempts = Number(attemptRow?.payment_attempt_count || 0)
        if (attempts >= MAX_ORDER_ATTEMPTS) {
          return NextResponse.json(
            {
              error:
                'Limite de tentativas de pagamento neste pedido. Entre em contato pelo WhatsApp se precisar de ajuda.',
            },
            { status: 429 },
          )
        }
        await db
          .from('orders')
          .update({
            payment_attempt_count: attempts + 1,
            payment_last_attempt_at: new Date().toISOString(),
          })
          .eq('id', order.id)
      } catch {
        /* coluna ainda não migrada — rate limit em memória/db cobre */
      }
    }

    const payment = await createTransparentPayment({
      orderId: order.id,
      orderNumber: order.order_number || order.id.slice(0, 8),
      amount,
      payerEmail: order.customer_email || user.email || '',
      formData: isPix
        ? { ...formData, payment_method_id: 'pix', payment_type_id: 'bank_transfer' }
        : formData,
      idempotencyKey: isPix ? `pix-${order.id}` : undefined,
    })

    const patch: Record<string, string> = {
      mp_payment_id: payment.id,
      mp_status: payment.status,
    }
    if (payment.orderId) {
      patch.mp_preference_id = payment.orderId
    }

    if (payment.status === 'approved') {
      patch.payment_status = 'paid'
      patch.status = order.status === 'pending' ? 'paid' : order.status
      if (!isPix) {
        await consumeRateLimit(`pay:order:${order.id}`, PAYMENT_POLICY, { clearOnSuccess: true })
      }
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      patch.payment_status = 'failed'
    }

    await db.from('orders').update(patch).eq('id', order.id)

    if (payment.status === 'approved') {
      try {
        const { markOrderProductsSold } = await import('@/lib/stock')
        await markOrderProductsSold(order.id, db)
      } catch {
        /* opcional */
      }
      try {
        const { sendPaymentApprovedEmail } = await import('@/lib/email')
        await sendPaymentApprovedEmail({
          orderId: order.id,
          orderNumber: order.order_number || order.id.slice(0, 8),
          customerEmail: order.customer_email || user.email || '',
          customerName: order.customer_name || 'Cliente',
          total: amount,
        })
      } catch {
        /* opcional */
      }
    }

    return NextResponse.json(payment)
  } catch (e) {
    console.error('mp transparent payment', e)
    const err = e as {
      message?: string
      causes?: Array<{ message?: string; code?: string; description?: string }>
      cause?: { message?: string }
    }
    const causeMsg =
      err?.causes?.map((c) => c.message || c.description || c.code).filter(Boolean).join('; ') ||
      err?.cause?.message ||
      err?.message ||
      'Não foi possível processar o pagamento.'
    return NextResponse.json({ error: causeMsg }, { status: 500 })
  }
}
