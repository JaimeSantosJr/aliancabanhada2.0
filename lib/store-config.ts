/** Configuração operacional da loja (valores públicos / seguros para o browser) */

export const STORE = {
  name: 'Aliança Banhada',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aliancabanhada.com.br',
  /** Chave PIX manual (fallback se Mercado Pago não estiver configurado) */
  pixKey: process.env.NEXT_PUBLIC_PIX_KEY || 'jaimegsantosj@gmail.com',
  pixKeyType: process.env.NEXT_PUBLIC_PIX_KEY_TYPE || 'email',
  pixBeneficiary: process.env.NEXT_PUBLIC_PIX_NAME || 'Aliança Banhada',
  /** Dados transferência (opcional) */
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || '',
  bankAgency: process.env.NEXT_PUBLIC_BANK_AGENCY || '',
  bankAccount: process.env.NEXT_PUBLIC_BANK_ACCOUNT || '',
  /**
   * Fallback de frete (R$) quando Melhor Envio estiver indisponível.
   * Sem frete grátis automático — cotação real no checkout.
   */
  shippingFlat: Number(process.env.NEXT_PUBLIC_SHIPPING_FLAT || 24.9),
  /** Prazo estimado fallback (dias úteis) */
  shippingDaysMin: 5,
  shippingDaysMax: 12,
} as const

/** Embalagem padrão (caixinha de aliança) — server-side também em lib/melhor-envio */
export const SHIPPING_PACKAGE = {
  originCep: (process.env.MELHOR_ENVIO_ORIGIN_CEP || '88047022').replace(/\D/g, ''),
  width: Number(process.env.MELHOR_ENVIO_WIDTH_CM || 16),
  height: Number(process.env.MELHOR_ENVIO_HEIGHT_CM || 4),
  length: Number(process.env.MELHOR_ENVIO_LENGTH_CM || 11),
  weight: Number(process.env.MELHOR_ENVIO_WEIGHT_KG || 0.3),
} as const

/** @deprecated frete grátis removido — mantido só como fallback fixo */
export function calcShipping(subtotal: number): number {
  if (subtotal <= 0) return 0
  return STORE.shippingFlat
}

export function isMercadoPagoEnabled() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN)
}

export function isMelhorEnvioEnabled() {
  return Boolean(process.env.MELHOR_ENVIO_TOKEN)
}
