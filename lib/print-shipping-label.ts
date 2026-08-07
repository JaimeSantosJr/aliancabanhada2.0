import { formatPrice } from '@/lib/format'
import type { Order } from '@/lib/types'
import { getStoreFiscalConfig } from '@/lib/store-fiscal'

type LabelItem = {
  product_name?: string | null
  size?: string | null
  quantity: number
  unit_price?: number | null
}

/** Abre janela de impressao com etiqueta/romaneio do pedido. */
export function printOrderShippingLabel(order: Order, items: LabelItem[]) {
  const store = getStoreFiscalConfig()
  const number = order.order_number || order.id.slice(0, 8)
  const address = [
    `${order.shipping_street || ''}, ${order.shipping_number || ''}`,
    order.shipping_complement || '',
    `${order.shipping_neighborhood || ''} - ${order.shipping_city || ''}/${order.shipping_state || ''}`,
    `CEP ${order.shipping_zip || ''}`,
  ]
    .filter((l) => l && l.replace(/[\s,\-/]/g, ''))
    .join('<br/>')

  const rows = items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.product_name || 'Item')}${i.size ? ` · tam. ${escapeHtml(String(i.size))}` : ''}</td><td>${i.quantity}</td><td>${i.unit_price != null ? formatPrice(Number(i.unit_price) * i.quantity) : '—'}</td></tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${escapeHtml(number)}</title>
  <style>
    @page { size: A6 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 12px; }
    .brand { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 4px; }
    h1 { font-size: 18px; margin: 0 0 12px; letter-spacing: 0.08em; text-transform: uppercase; }
    .box { border: 2px solid #111; padding: 12px; margin-bottom: 12px; }
    .label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #555; margin-bottom: 4px; }
    .to { font-size: 15px; line-height: 1.35; }
    .meta { font-size: 12px; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #ddd; }
    th { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
    .track { font-size: 16px; font-weight: bold; letter-spacing: 0.06em; }
    .foot { margin-top: 14px; font-size: 11px; color: #444; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:8px 12px;cursor:pointer;">Imprimir</button>
  <div class="brand">${escapeHtml(store.tradeName || store.legalName || 'Alianca Banhada')}</div>
  <h1>Pedido ${escapeHtml(number)}</h1>

  <div class="box">
    <div class="label">Destinatario</div>
    <div class="to">
      <strong>${escapeHtml(order.customer_name || 'Cliente')}</strong><br/>
      ${address}
    </div>
    <div class="meta">
      ${order.customer_phone ? `Tel: ${escapeHtml(order.customer_phone)}<br/>` : ''}
      ${order.customer_email ? `Email: ${escapeHtml(order.customer_email)}` : ''}
      ${order.customer_document ? `<br/>CPF/CNPJ: ${escapeHtml(order.customer_document)}` : ''}
    </div>
  </div>

  <div class="box">
    <div class="label">Remetente</div>
    <div class="to" style="font-size:13px;">
      ${escapeHtml(store.tradeName || store.legalName)}
      ${store.cnpj ? `<br/>CNPJ ${escapeHtml(store.cnpj)}` : ''}
      ${store.street ? `<br/>${escapeHtml(store.street)}, ${escapeHtml(store.number)}` : ''}
      ${store.city ? `<br/>${escapeHtml(store.city)}/${escapeHtml(store.state)} CEP ${escapeHtml(store.zip)}` : ''}
      ${store.phone ? `<br/>${escapeHtml(store.phone)}` : ''}
    </div>
  </div>

  ${
    order.tracking_code
      ? `<div class="box"><div class="label">Rastreio</div><div class="track">${escapeHtml(order.tracking_code)}</div>
         <div class="meta">${escapeHtml([order.shipping_company, order.shipping_service_name].filter(Boolean).join(' · '))}</div></div>`
      : `<div class="box"><div class="label">Frete</div><div class="meta">${escapeHtml([order.shipping_company, order.shipping_service_name].filter(Boolean).join(' · ') || 'A definir')}</div></div>`
  }

  <table>
    <thead><tr><th>Item</th><th>Qtd</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">Total do pedido: <strong>${formatPrice(order.total_price)}</strong></div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body>
</html>`

  const w = window.open('', '_blank', 'noopener,noreferrer,width=480,height=720')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
