/** Configuração operacional da loja (valores públicos / seguros para o browser) */

export const STORE = {
  name: 'Aliança Banhada',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aliancabanhada.com.br',
  /** Chave PIX (e-mail, CPF/CNPJ, telefone ou aleatória) */
  pixKey: process.env.NEXT_PUBLIC_PIX_KEY || 'jaimegsantosj@gmail.com',
  pixKeyType: process.env.NEXT_PUBLIC_PIX_KEY_TYPE || 'email',
  pixBeneficiary: process.env.NEXT_PUBLIC_PIX_NAME || 'Aliança Banhada',
  /** Dados transferência (opcional) */
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || '',
  bankAgency: process.env.NEXT_PUBLIC_BANK_AGENCY || '',
  bankAccount: process.env.NEXT_PUBLIC_BANK_ACCOUNT || '',
  /** Frete: valor fixo nacional (R$) — ajuste depois com tabela/CEP */
  shippingFlat: Number(process.env.NEXT_PUBLIC_SHIPPING_FLAT || 24.9),
  /** Frete grátis a partir de (R$) */
  freeShippingFrom: Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_FROM || 399),
  /** Prazo estimado (dias úteis) */
  shippingDaysMin: 5,
  shippingDaysMax: 12,
} as const

export function calcShipping(subtotal: number): number {
  if (subtotal <= 0) return 0
  if (subtotal >= STORE.freeShippingFrom) return 0
  return STORE.shippingFlat
}
