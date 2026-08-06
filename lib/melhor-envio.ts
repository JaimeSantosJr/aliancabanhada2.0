import { SHIPPING_PACKAGE, STORE } from '@/lib/store-config'

export type ShippingQuoteOption = {
  id: string
  name: string
  company: string
  price: number
  deliveryDays: number
  currency: string
}

type CalculateProduct = {
  id: string
  width: number
  height: number
  length: number
  weight: number
  insurance_value: number
  quantity: number
}

function meBaseUrl() {
  const env = (process.env.MELHOR_ENVIO_ENV || 'sandbox').toLowerCase()
  return env === 'production'
    ? 'https://melhorenvio.com.br'
    : 'https://sandbox.melhorenvio.com.br'
}

function userAgent() {
  return (
    process.env.MELHOR_ENVIO_USER_AGENT ||
    `Alianca Banhada (${process.env.ORDER_NOTIFY_EMAIL || 'contato@aliancabanhada.com.br'})`
  )
}

export function fallbackShippingOption(insuranceValue?: number): ShippingQuoteOption {
  const freeTest =
    typeof insuranceValue === 'number' && insuranceValue > 0 && insuranceValue <= 5.5
  return {
    id: 'flat',
    name: freeTest ? 'Frete grátis (pedido teste)' : 'Frete padrão',
    company: 'Aliança Banhada',
    price: freeTest ? 0 : STORE.shippingFlat,
    deliveryDays: STORE.shippingDaysMax,
    currency: 'R$',
  }
}

export async function quoteMelhorEnvio(opts: {
  destinationCep: string
  insuranceValue: number
  quantity?: number
}): Promise<{ options: ShippingQuoteOption[]; source: 'melhor_envio' | 'fallback'; error?: string }> {
  const to = opts.destinationCep.replace(/\D/g, '')
  if (to.length !== 8) {
    return { options: [], source: 'fallback', error: 'CEP inválido.' }
  }

  // Pedido de teste (produto R$1–R$5): frete grátis
  if (opts.insuranceValue > 0 && opts.insuranceValue <= 5.5) {
    return {
      options: [fallbackShippingOption(opts.insuranceValue)],
      source: 'fallback',
    }
  }

  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) {
    return {
      options: [fallbackShippingOption(opts.insuranceValue)],
      source: 'fallback',
      error: 'Melhor Envio não configurado — usando frete padrão.',
    }
  }

  const qty = Math.max(1, opts.quantity || 1)
  const products: CalculateProduct[] = [
    {
      id: 'alianca-box',
      width: SHIPPING_PACKAGE.width,
      height: SHIPPING_PACKAGE.height,
      length: SHIPPING_PACKAGE.length,
      weight: SHIPPING_PACKAGE.weight,
      insurance_value: Number(opts.insuranceValue.toFixed(2)),
      quantity: qty,
    },
  ]

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(`${meBaseUrl()}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': userAgent(),
      },
      body: JSON.stringify({
        from: { postal_code: SHIPPING_PACKAGE.originCep },
        to: { postal_code: to },
        products,
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      console.warn('melhor envio quote fail', res.status, data)
      return {
        options: [fallbackShippingOption(opts.insuranceValue)],
        source: 'fallback',
        error: 'Cotação indisponível no momento — frete padrão aplicado.',
      }
    }

    const rows = Array.isArray(data) ? data : []
    const options: ShippingQuoteOption[] = rows
      .filter((row) => row && !row.error && (row.custom_price != null || row.price != null))
      .map((row) => ({
        id: String(row.id ?? row.service_id ?? `${row.company?.name}-${row.name}`),
        name: String(row.name || row.service || 'Serviço'),
        company: String(row.company?.name || row.company || 'Transportadora'),
        price: Number(row.custom_price ?? row.price ?? 0),
        deliveryDays: Number(row.custom_delivery_time ?? row.delivery_time ?? STORE.shippingDaysMax),
        currency: String(row.currency || 'R$'),
      }))
      .filter((o) => o.price >= 0)
      .sort((a, b) => a.price - b.price)

    if (!options.length) {
      return {
        options: [fallbackShippingOption(opts.insuranceValue)],
        source: 'fallback',
        error: 'Nenhuma transportadora disponível — frete padrão aplicado.',
      }
    }

    return { options, source: 'melhor_envio' }
  } catch (e) {
    console.warn('melhor envio quote error', e)
    return {
      options: [fallbackShippingOption(opts.insuranceValue)],
      source: 'fallback',
      error: 'Falha ao consultar frete — frete padrão aplicado.',
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Revalida a opção escolhida no servidor (nunca confiar no preço do client). */
export async function resolveSelectedShipping(opts: {
  destinationCep: string
  insuranceValue: number
  selectedId?: string | null
  quantity?: number
}): Promise<ShippingQuoteOption> {
  const { options } = await quoteMelhorEnvio(opts)
  if (!options.length) return fallbackShippingOption(opts.insuranceValue)
  if (opts.selectedId) {
    const found = options.find((o) => o.id === opts.selectedId)
    if (found) return found
  }
  return options[0]
}
