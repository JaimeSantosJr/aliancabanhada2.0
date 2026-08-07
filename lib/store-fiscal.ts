/** Dados fiscais / empresa — preencha via env (publicos no admin + tokens so no servidor). */

export type StoreFiscalConfig = {
  legalName: string
  tradeName: string
  cnpj: string
  ie: string
  im: string
  phone: string
  email: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zip: string
  /** Provedor: focusnfe | nfeio | manual | none */
  provider: string
  configured: boolean
}

function env(...keys: string[]) {
  for (const key of keys) {
    const v = (process.env[key] || '').trim()
    if (v) return v
  }
  return ''
}

/** Seguro para browser (so le NEXT_PUBLIC_* e defaults). */
export function getStoreFiscalConfig(): StoreFiscalConfig {
  const cnpj = env('NEXT_PUBLIC_STORE_CNPJ', 'STORE_CNPJ')
  const legalName = env(
    'NEXT_PUBLIC_STORE_LEGAL_NAME',
    'STORE_LEGAL_NAME',
    'NEXT_PUBLIC_PIX_NAME',
  ) || 'Alianca Banhada'

  return {
    legalName,
    tradeName: env('NEXT_PUBLIC_STORE_TRADE_NAME', 'STORE_TRADE_NAME') || legalName,
    cnpj,
    ie: env('NEXT_PUBLIC_STORE_IE', 'STORE_IE'),
    im: env('NEXT_PUBLIC_STORE_IM', 'STORE_IM'),
    phone: env('NEXT_PUBLIC_STORE_PHONE', 'STORE_PHONE'),
    email: env('NEXT_PUBLIC_STORE_EMAIL', 'STORE_EMAIL', 'ORDER_NOTIFY_EMAIL'),
    street: env('NEXT_PUBLIC_STORE_STREET', 'STORE_STREET'),
    number: env('NEXT_PUBLIC_STORE_NUMBER', 'STORE_NUMBER'),
    complement: env('NEXT_PUBLIC_STORE_COMPLEMENT', 'STORE_COMPLEMENT'),
    neighborhood: env('NEXT_PUBLIC_STORE_NEIGHBORHOOD', 'STORE_NEIGHBORHOOD'),
    city: env('NEXT_PUBLIC_STORE_CITY', 'STORE_CITY'),
    state: env('NEXT_PUBLIC_STORE_STATE', 'STORE_STATE'),
    zip: env('NEXT_PUBLIC_STORE_ZIP', 'STORE_ZIP'),
    provider: env('NFE_PROVIDER', 'NEXT_PUBLIC_NFE_PROVIDER') || (cnpj ? 'manual' : 'none'),
    configured: Boolean(cnpj && legalName),
  }
}

/** So no servidor — tokens de API NFe. */
export function isNfeApiConfigured() {
  const provider = (process.env.NFE_PROVIDER || 'none').toLowerCase()
  if (provider === 'focusnfe') return Boolean(process.env.FOCUSNFE_TOKEN)
  if (provider === 'nfeio') return Boolean(process.env.NFEIO_API_KEY)
  return false
}

export function formatCnpj(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length !== 14) return raw
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function formatCpf(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length !== 11) return raw
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}
