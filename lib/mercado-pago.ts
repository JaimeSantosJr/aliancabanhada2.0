import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import { createHmac, timingSafeEqual } from 'crypto'
import { STORE } from '@/lib/store-config'

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN)
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

  // Ajuste fino: se o total do pedido for menor que a soma (por desconto),
  // usa um único item consolidado para bater o valor cobrado.
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

  // Credenciais de teste atuais (APP_USR) funcionam melhor no domínio principal.
  // sandbox_init_point fica como fallback.
  const initPoint =
    process.env.MERCADO_PAGO_ENV === 'sandbox'
      ? result.init_point || result.sandbox_init_point
      : result.init_point || result.sandbox_init_point

  return {
    preferenceId: result.id || '',
    initPoint: initPoint || '',
  }
}

export async function getPayment(paymentId: string) {
  const payment = new Payment(client())
  return payment.get({ id: paymentId })
}

/** Valida assinatura x-signature do webhook Mercado Pago */
export function verifyMercadoPagoSignature(opts: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
}): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret) {
    // Em desenvolvimento sem secret, aceita com aviso (produção deve ter secret)
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
