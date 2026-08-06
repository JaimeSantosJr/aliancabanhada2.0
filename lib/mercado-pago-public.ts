/** Chave pública — segura para o browser (somente leitura de pagamentos). */
export function getMercadoPagoPublicKey() {
  return process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || ''
}
