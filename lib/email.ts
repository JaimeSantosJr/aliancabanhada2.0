import { STORE } from '@/lib/store-config'

type OrderMail = {
  orderId: string
  orderNumber: string
  customerEmail: string
  customerName: string
  total: number
  paymentMethod: string
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mailMeta() {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'Aliança Banhada <onboarding@resend.dev>'
  const adminTo = process.env.ORDER_NOTIFY_EMAIL || 'jaimegsantosjroficial@gmail.com'
  const replyTo = process.env.RESEND_REPLY_TO || adminTo
  return { key, from, adminTo, replyTo }
}

/** Envia e-mails via Resend se RESEND_API_KEY estiver configurada. */
export async function sendOrderEmails(data: OrderMail) {
  const { key, from, adminTo, replyTo } = mailMeta()
  if (!key) return { skipped: true }

  const payHint =
    data.paymentMethod === 'pix'
      ? `PIX: ${STORE.pixKey} (${STORE.pixBeneficiary})`
      : 'Transferência bancária — aguardar dados/confirmação da loja.'

  const customerHtml = `
    <p>Olá, ${data.customerName}!</p>
    <p>Recebemos seu pedido <strong>${data.orderNumber}</strong>.</p>
    <p>Total: <strong>${formatBRL(data.total)}</strong></p>
    <p>${payHint}</p>
    <p>Acompanhe em: <a href="${STORE.siteUrl}/pedido/${data.orderId}">${STORE.siteUrl}/pedido/${data.orderId}</a></p>
    <p>— ${STORE.name}</p>
  `

  const adminHtml = `
    <p>Novo pedido <strong>${data.orderNumber}</strong></p>
    <p>Cliente: ${data.customerName} (${data.customerEmail})</p>
    <p>Total: ${formatBRL(data.total)} · ${data.paymentMethod}</p>
    <p><a href="${STORE.siteUrl}/admin">Abrir admin</a></p>
  `

  await Promise.all([
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [data.customerEmail],
        reply_to: replyTo,
        subject: `Pedido ${data.orderNumber} — ${STORE.name}`,
        html: customerHtml,
      }),
    }),
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [adminTo],
        reply_to: data.customerEmail,
        subject: `[Loja] Novo pedido ${data.orderNumber}`,
        html: adminHtml,
      }),
    }),
  ])

  return { skipped: false }
}

export async function sendSimpleNotify(subject: string, html: string) {
  const { key, from, adminTo, replyTo } = mailMeta()
  if (!key) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [adminTo], reply_to: replyTo, subject, html }),
  })
}
