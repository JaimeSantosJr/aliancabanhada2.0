import { MercadoPagoConfig, Order, Payment, Preference } from 'mercadopago'
import { createHmac, timingSafeEqual, randomUUID } from 'crypto'
import { STORE } from '@/lib/store-config'

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN)
}

export function getMercadoPagoPublicKey() {
  return process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || ''
}

function client() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) throw new Error('MERCADO_PAGO_ACCESS_TOKEN ausente')
  return new MercadoPagoConfig({ accessToken })
}

export type PreferenceInput = {
  orderId: string
  orderNumber: string
  total: number
  items: Array<{ title: string; quantity: number; unit_price: number }>
  payerEmail: string
  payerName: string
  shippingCost: number
}

export async function createCheckoutPreference(input: PreferenceInput) {
  const preference = new Preference(client())
  const site = STORE.siteUrl.replace(/\/$/, '')

  const items = input.items.map((i) => ({
    id: i.title.slice(0, 40),
    title: i.title.slice(0, 250),
    quantity: i.quantity,
    unit_price: Number(i.unit_price.toFixed(2)),
    currency_id: 'BRL' as const,
  }))

  if (input.shippingCost > 0) {
    items.push({
      id: 'frete',
      title: 'Frete',
      quantity: 1,
      unit_price: Number(input.shippingCost.toFixed(2)),
      currency_id: 'BRL',
    })
  }

  const itemsSum = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const finalItems =
    Math.abs(itemsSum - input.total) > 0.02
      ? [
          {
            id: input.orderNumber,
            title: `Pedido ${input.orderNumber} — ${STORE.name}`,
            quantity: 1,
            unit_price: Number(input.total.toFixed(2)),
            currency_id: 'BRL' as const,
          },
        ]
      : items

  const result = await preference.create({
    body: {
      external_reference: input.orderId,
      statement_descriptor: 'ALIANCA BANHADA',
      items: finalItems,
      payer: {
        email: input.payerEmail,
        name: input.payerName,
      },
      back_urls: {
        success: `${site}/pedido/${input.orderId}?mp=success`,
        pending: `${site}/pedido/${input.orderId}?mp=pending`,
        failure: `${site}/pedido/${input.orderId}?mp=failure`,
      },
      auto_return: 'approved',
      notification_url: `${site}/api/webhooks/mercado-pago`,
      metadata: {
        order_id: input.orderId,
        order_number: input.orderNumber,
      },
    },
  })

  const initPoint =
    process.env.MERCADO_PAGO_ENV === 'sandbox'
      ? result.init_point || result.sandbox_init_point
      : result.init_point || result.sandbox_init_point

  return {
    preferenceId: result.id || '',
    initPoint: initPoint || '',
  }
}

type BrickFormData = Record<string, unknown>

function mapPaymentMethodType(formData: BrickFormData): string {
  const explicit = String(
    formData.payment_type_id || formData.paymentTypeId || '',
  ).toLowerCase()
  if (explicit) return explicit

  const method = String(formData.payment_method_id || '').toLowerCase()
  if (method === 'pix') return 'bank_transfer'
  if (method.startsWith('bol') || method === 'pec' || method === 'paycash') return 'ticket'
  if (method.includes('deb')) return 'debit_card'
  if (formData.token) return 'credit_card'
  return 'credit_card'
}

function mapOrderStatus(orderStatus: string, statusDetail: string): string {
  const s = orderStatus.toLowerCase()
  const d = statusDetail.toLowerCase()
  if (s === 'processed' && (d === 'accredited' || d === 'partially_refunded')) return 'approved'
  if (s === 'processed') return 'approved'
  if (s === 'action_required' || s === 'created' || s === 'processing') return 'pending'
  if (s === 'cancelled' || s === 'expired') return 'cancelled'
  if (s === 'failed' || d.includes('rejected') || d.includes('cc_rejected')) return 'rejected'
  return s || 'pending'
}

/** Checkout Transparente via Orders API (compatível com credenciais de teste). */
export async function createTransparentPayment(opts: {
  orderId: string
  orderNumber: string
  amount: number
  payerEmail: string
  formData: BrickFormData
  idempotencyKey?: string
}) {
  const orderClient = new Order(client())
  const amount = Number(opts.amount.toFixed(2)).toFixed(2)
  const methodId = String(opts.formData.payment_method_id || '')
  const methodType = mapPaymentMethodType(opts.formData)
  const payerFromBrick =
    opts.formData.payer && typeof opts.formData.payer === 'object'
      ? (opts.formData.payer as Record<string, unknown>)
      : {}

  const paymentMethod: Record<string, unknown> = {
    id: methodId || 'pix',
    type: methodType || (methodId === 'pix' || opts.formData.mode === 'pix' ? 'bank_transfer' : 'credit_card'),
  }
  if (opts.formData.token) {
    paymentMethod.token = opts.formData.token
    paymentMethod.installments = Number(opts.formData.installments || 1)
  }

  const payerEmail =
    process.env.MERCADO_PAGO_ENV === 'sandbox'
      ? 'test_user_buyer@testuser.com'
      : opts.payerEmail

  const result = await orderClient.create({
    body: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: amount,
      external_reference: opts.orderId,
      description: `Pedido ${opts.orderNumber} — ${STORE.name}`,
      payer: {
        email: payerEmail,
        ...(payerFromBrick.identification
          ? { identification: payerFromBrick.identification as never }
          : {}),
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: paymentMethod as never,
          },
        ],
      },
    } as never,
    requestOptions: {
      idempotencyKey: opts.idempotencyKey || randomUUID(),
    },
  })

  const pay = result.transactions?.payments?.[0] as
    | {
        id?: string
        status?: string
        status_detail?: string
        payment_method?: {
          id?: string
          qr_code?: string
          qr_code_base64?: string
          ticket_url?: string
        }
      }
    | undefined

  const status = mapOrderStatus(
    String(result.status || ''),
    String(result.status_detail || pay?.status_detail || ''),
  )

  const pm = pay?.payment_method
  return {
    id: String(pay?.id || result.id || ''),
    orderId: String(result.id || ''),
    status,
    statusDetail: String(result.status_detail || pay?.status_detail || ''),
    paymentMethodId: String(pm?.id || methodId),
    pixQrCode: pm?.qr_code || null,
    pixQrBase64: pm?.qr_code_base64 || null,
    ticketUrl: pm?.ticket_url || null,
  }
}

export async function getPayment(paymentId: string) {
  const payment = new Payment(client())
  return payment.get({ id: paymentId })
}

export async function getOrder(orderId: string) {
  const order = new Order(client())
  return order.get({ id: orderId })
}

/** Normaliza status de Order MP para o fluxo da loja. */
export function normalizeOrderPayment(order: Awaited<ReturnType<typeof getOrder>>) {
  const pay = order.transactions?.payments?.[0] as
    | {
        id?: string
        status?: string
        status_detail?: string
        amount?: string
        paid_amount?: string
        payment_method?: { id?: string }
      }
    | undefined

  const status = mapOrderStatus(
    String(order.status || ''),
    String(order.status_detail || pay?.status_detail || ''),
  )

  return {
    id: String(pay?.id || order.id || ''),
    orderId: String(order.id || ''),
    externalReference: String(order.external_reference || ''),
    status,
    amount: Number(pay?.paid_amount || pay?.amount || order.total_paid_amount || order.total_amount || 0),
    paymentMethodId: String(pay?.payment_method?.id || ''),
  }
}

/** Valida assinatura x-signature do webhook Mercado Pago */
export function verifyMercadoPagoSignature(opts: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
}): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }
  if (!opts.xSignature || !opts.dataId) return false

  const parts = Object.fromEntries(
    opts.xSignature.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k?.trim(), v?.trim()]
    }),
  ) as Record<string, string>

  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false

  let manifest = `id:${opts.dataId};`
  if (opts.xRequestId) manifest += `request-id:${opts.xRequestId};`
  manifest += `ts:${ts};`

  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(v1, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
