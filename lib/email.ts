import { STORE } from '@/lib/store-config'

type OrderMailItem = {
  product_name: string
  quantity: number
  unit_price: number
  size?: string
}

type OrderMail = {
  orderId: string
  orderNumber: string
  customerEmail: string
  customerName: string
  total: number
  paymentMethod: string
  subtotal?: number
  shippingCost?: number
  discountAmount?: number
  couponCode?: string | null
  shippingLabel?: string
  deliveryDays?: number
  items?: OrderMailItem[]
  address?: {
    street: string
    number: string
    complement?: string | null
    neighborhood: string
    city: string
    state: string
    zip: string
  }
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mailMeta() {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'Aliança Banhada <contato@aliancabanhada.com.br>'
  const adminTo = process.env.ORDER_NOTIFY_EMAIL || 'jaimegsantosjroficial@gmail.com'
  const replyTo = process.env.RESEND_REPLY_TO || adminTo
  return { key, from, adminTo, replyTo }
}

const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const CREAM = '#faf6ee'
const INK = '#1a1410'
const GOLD = '#c4a05a'
const MUTED = '#8a7350'

/** Envelope com o visual do site: fundo creme, serifada em caixa alta, fio dourado. */
function layout(opts: { kicker: string; heading: string; body: string; footNote?: string }) {
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#efe9df;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe9df;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${CREAM};border:1px solid #e4d9c4;">
          <tr>
            <td align="center" style="padding:40px 32px 8px;">
              <div style="font-family:${SERIF};font-size:22px;letter-spacing:6px;text-transform:uppercase;color:${INK};">
                Aliança Banhada
              </div>
              <div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};padding-top:10px;">
                1 ano de garantia
              </div>
              <div style="height:1px;width:56px;background:${GOLD};margin:22px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <div style="font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};">
                ${opts.kicker}
              </div>
              <h1 style="margin:12px 0 0;font-family:${SERIF};font-weight:400;font-size:24px;line-height:1.3;color:${INK};">
                ${opts.heading}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 36px;font-family:${SANS};font-size:14px;line-height:1.7;color:#3d352c;">
              ${opts.body}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 36px;">
              <div style="height:1px;background:#e4d9c4;margin-bottom:20px;"></div>
              <div style="font-family:${SANS};font-size:11px;line-height:1.8;color:${MUTED};letter-spacing:1px;text-transform:uppercase;">
                ${opts.footNote || 'Para o sim que permanece.'}
              </div>
              <div style="font-family:${SANS};font-size:11px;color:#a99b84;padding-top:10px;">
                <a href="${STORE.siteUrl}" style="color:${MUTED};text-decoration:none;">${STORE.siteUrl.replace(/^https?:\/\//, '')}</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;">
    <tr><td style="background:${INK};">
      <a href="${href}" style="display:inline-block;padding:16px 34px;font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${CREAM};text-decoration:none;">${label}</a>
    </td></tr>
  </table>`
}

function infoRow(label: string, value: string, strong = false) {
  return `<tr>
    <td style="padding:9px 0;font-family:${SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${label}</td>
    <td align="right" style="padding:9px 0;font-family:${SANS};font-size:${strong ? '16px' : '13px'};color:${INK};${strong ? 'font-weight:600;' : ''}">${value}</td>
  </tr>`
}

function itemsBlock(items: OrderMailItem[]) {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #ece3d2;font-family:${SANS};font-size:13px;color:${INK};">
          ${i.product_name}
          ${i.size ? `<div style="font-size:11px;color:${MUTED};padding-top:4px;letter-spacing:1px;text-transform:uppercase;">${i.size}</div>` : ''}
          <div style="font-size:11px;color:${MUTED};padding-top:4px;">Qtd. ${i.quantity}</div>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #ece3d2;font-family:${SANS};font-size:13px;color:${INK};white-space:nowrap;">
          ${formatBRL(i.unit_price * i.quantity)}
        </td>
      </tr>`,
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;">${rows}</table>`
}

function addressBlock(a: NonNullable<OrderMail['address']>) {
  const zip = a.zip.replace(/^(\d{5})(\d{3})$/, '$1-$2')
  return `<div style="margin:22px 0 0;padding:18px;background:#f4ecdd;border:1px solid #e4d9c4;">
    <div style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};padding-bottom:8px;">Entrega</div>
    <div style="font-family:${SANS};font-size:13px;line-height:1.7;color:${INK};">
      ${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ''}<br />
      ${a.neighborhood} · ${a.city}/${a.state}<br />
      CEP ${zip}
    </div>
  </div>`
}

async function send(payload: Record<string, unknown>, key: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return res.ok
}

/** Envia e-mails via Resend se RESEND_API_KEY estiver configurada. */
export async function sendOrderEmails(data: OrderMail) {
  const { key, from, adminTo, replyTo } = mailMeta()
  if (!key) return { skipped: true }

  const subtotal = data.subtotal ?? data.total
  const shipping = data.shippingCost ?? 0
  const discount = data.discountAmount ?? 0
  const orderUrl = `${STORE.siteUrl}/pedido/${data.orderId}`

  const paymentLabel =
    data.paymentMethod === 'mercadopago'
      ? 'Mercado Pago'
      : data.paymentMethod === 'pix'
        ? 'PIX'
        : 'Transferência'

  const paymentBlock =
    data.paymentMethod === 'mercadopago'
      ? `<div style="margin:22px 0 0;padding:20px;background:#f4ecdd;border:1px solid #e4d9c4;">
          <div style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};padding-bottom:10px;">Pagamento Mercado Pago</div>
          <div style="font-family:${SANS};font-size:13px;color:${INK};line-height:1.7;">Finalize o pagamento na página do pedido (PIX ou cartão, Checkout Transparente). O status será atualizado automaticamente.</div>
        </div>`
      : data.paymentMethod === 'pix'
        ? `<div style="margin:22px 0 0;padding:20px;background:#f4ecdd;border:1px solid #e4d9c4;">
          <div style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};padding-bottom:10px;">Pagamento via PIX</div>
          <div style="font-family:${SERIF};font-size:17px;color:${INK};word-break:break-all;">${STORE.pixKey}</div>
          <div style="font-family:${SANS};font-size:12px;color:${MUTED};padding-top:8px;">Favorecido: ${STORE.pixBeneficiary}</div>
          <div style="font-family:${SANS};font-size:12px;color:${MUTED};padding-top:10px;line-height:1.6;">Após o pagamento, envie o comprovante respondendo este e-mail para agilizarmos a produção.</div>
        </div>`
        : `<div style="margin:22px 0 0;padding:20px;background:#f4ecdd;border:1px solid #e4d9c4;">
          <div style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};padding-bottom:10px;">Transferência bancária</div>
          <div style="font-family:${SANS};font-size:13px;color:${INK};line-height:1.7;">Responderemos este e-mail com os dados bancários para concluir o pagamento.</div>
        </div>`

  const totalsRows = `
      ${infoRow('Pedido', data.orderNumber)}
      ${infoRow('Subtotal', formatBRL(subtotal))}
      ${discount > 0 ? infoRow(`Cupom${data.couponCode ? ` ${data.couponCode}` : ''}`, `− ${formatBRL(discount)}`) : ''}
      ${infoRow('Frete', shipping === 0 ? 'Grátis' : formatBRL(shipping))}
      ${data.shippingLabel ? infoRow('Entrega', data.shippingLabel) : ''}
      ${data.deliveryDays ? infoRow('Prazo', `${data.deliveryDays} dias úteis`) : ''}
      ${infoRow('Total', formatBRL(data.total), true)}
  `

  const customerBody = `
    <p style="margin:0 0 18px;">Olá, ${data.customerName}. Recebemos o seu pedido e ele já está reservado.</p>
    ${data.items?.length ? itemsBlock(data.items) : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
      ${totalsRows}
    </table>
    ${paymentBlock}
    ${data.address ? addressBlock(data.address) : ''}
    ${button(orderUrl, 'Acompanhar pedido')}
  `

  const adminBody = `
    <p style="margin:0 0 18px;">Novo pedido registrado na loja.</p>
    ${data.items?.length ? itemsBlock(data.items) : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
      ${infoRow('Pedido', data.orderNumber)}
      ${infoRow('Cliente', data.customerName)}
      ${infoRow('E-mail', data.customerEmail)}
      ${infoRow('Pagamento', paymentLabel)}
      ${discount > 0 ? infoRow('Desconto', formatBRL(discount)) : ''}
      ${infoRow('Frete', shipping === 0 ? 'Grátis' : formatBRL(shipping))}
      ${infoRow('Total', formatBRL(data.total), true)}
    </table>
    ${data.address ? addressBlock(data.address) : ''}
    ${button(`${STORE.siteUrl}/admin`, 'Abrir painel')}
  `

  await Promise.all([
    send(
      {
        from,
        to: [data.customerEmail],
        reply_to: replyTo,
        subject: `Pedido ${data.orderNumber} confirmado — ${STORE.name}`,
        html: layout({
          kicker: 'Pedido recebido',
          heading: `Seu pedido ${data.orderNumber} foi registrado`,
          body: customerBody,
          footNote: 'Dúvidas? Basta responder este e-mail.',
        }),
      },
      key,
    ),
    send(
      {
        from,
        to: [adminTo],
        reply_to: data.customerEmail,
        subject: `[Loja] Novo pedido ${data.orderNumber} · ${formatBRL(data.total)}`,
        html: layout({
          kicker: 'Painel da loja',
          heading: `Novo pedido ${data.orderNumber}`,
          body: adminBody,
          footNote: 'Responda este e-mail para falar direto com o cliente.',
        }),
      },
      key,
    ),
  ])

  return { skipped: false }
}

export async function sendSimpleNotify(subject: string, html: string) {
  const { key, from, adminTo, replyTo } = mailMeta()
  if (!key) return
  await send(
    {
      from,
      to: [adminTo],
      reply_to: replyTo,
      subject,
      html: layout({ kicker: 'Painel da loja', heading: subject, body: html }),
    },
    key,
  )
}

export async function sendPaymentApprovedEmail(data: {
  orderId: string
  orderNumber: string
  customerEmail: string
  customerName: string
  total: number
}) {
  const { key, from, replyTo } = mailMeta()
  if (!key) return
  const orderUrl = `${STORE.siteUrl}/pedido/${data.orderId}`
  await send(
    {
      from,
      to: [data.customerEmail],
      reply_to: replyTo,
      subject: `Pagamento confirmado — pedido ${data.orderNumber}`,
      html: layout({
        kicker: 'Pagamento aprovado',
        heading: `Recebemos o pagamento do pedido ${data.orderNumber}`,
        body: `
          <p style="margin:0 0 18px;">Olá, ${data.customerName}. Seu pagamento de <strong>${formatBRL(data.total)}</strong> foi confirmado.</p>
          <p style="margin:0 0 18px;">Já vamos preparar sua peça com carinho.</p>
          ${button(orderUrl, 'Ver pedido')}
        `,
        footNote: 'Obrigada por escolher a Aliança Banhada.',
      }),
    },
    key,
  )
}
