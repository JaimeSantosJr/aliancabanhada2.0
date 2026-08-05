'use client'

import { formatPrice } from '@/lib/format'
import { STORE } from '@/lib/store-config'
import { ORDER_STATUS_LABELS } from '@/lib/types'
import type { Order, OrderItem } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const mp = search.get('mp')
    if (mp === 'success') toast.success('Pagamento em processamento/aprovado. Atualizando status...')
    if (mp === 'pending') toast.message('Pagamento pendente. Assim que confirmar, atualizamos o pedido.')
    if (mp === 'failure') toast.error('Pagamento não concluído. Você pode tentar novamente.')
  }, [search])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/auth/login?next=/pedido/${id}`)
        return
      }
      const { data: o } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
      setOrder(o as Order | null)
      if (o) {
        const { data: lines } = await supabase.from('order_items').select('*').eq('order_id', id)
        setItems((lines as OrderItem[]) || [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(STORE.pixKey)
      toast.success('Chave PIX copiada.')
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.')
    }
  }

  if (loading) return <p className="center-msg page-pad">Carregando pedido...</p>
  if (!order) {
    return (
      <div className="container page-pad center-msg">
        <p>Pedido não encontrado.</p>
        <Link href="/conta" className="btn">Minha conta</Link>
      </div>
    )
  }

  const shipping = Number(order.shipping_cost || 0)
  const discount = Number(order.discount_amount || 0)
  const subtotal = Number(order.subtotal ?? order.total_price - shipping + discount)
  const pending = order.payment_status === 'pending' || order.status === 'pending'
  const paid = order.payment_status === 'paid' || order.status === 'paid'

  return (
    <div className="container page-pad">
      <h1 className="page-title">Pedido {order.order_number || order.id.slice(0, 8)}</h1>
      <div className="order-status-banner">
        Status: <strong>{ORDER_STATUS_LABELS[order.status] || order.status}</strong>
        {order.payment_method && (
          <> · Pagamento: {order.payment_method.toUpperCase()} ({order.payment_status || 'pending'})</>
        )}
        {order.mp_status ? <> · MP: {order.mp_status}</> : null}
      </div>

      {order.tracking_code && (
        <div className="pix-box" style={{ marginBottom: 24 }}>
          <h2>Rastreio</h2>
          <p>Código: <strong>{order.tracking_code}</strong></p>
        </div>
      )}

      {paid && (
        <div className="pix-box" style={{ marginBottom: 24 }}>
          <h2>Pagamento confirmado</h2>
          <p>Recebemos seu pagamento. Em breve sua peça entra em preparo.</p>
        </div>
      )}

      {pending && (
        <div className="pix-box">
          <h2>Como pagar</h2>
          <p>
            Valor: <strong>{formatPrice(order.total_price)}</strong>
          </p>
          {order.payment_method === 'mercadopago' ? (
            <>
              <p className="muted">
                Pague com PIX ou cartão no Checkout Pro do Mercado Pago.
              </p>
              {order.mp_init_point ? (
                <a href={order.mp_init_point} className="btn">
                  Ir para o pagamento
                </a>
              ) : (
                <p className="muted">Link de pagamento indisponível. Fale conosco.</p>
              )}
            </>
          ) : order.payment_method === 'pix' ? (
            <>
              <p>Beneficiário: <strong>{STORE.pixBeneficiary}</strong></p>
              <p>
                Chave PIX ({STORE.pixKeyType}): <strong>{STORE.pixKey}</strong>
              </p>
              <button type="button" className="btn" onClick={copyPix}>
                Copiar chave PIX
              </button>
              <p className="muted" style={{ marginTop: 12 }}>
                Após pagar, envie o comprovante pelo contato da loja.
              </p>
            </>
          ) : (
            <p>
              Transferência bancária.
              {STORE.bankName ? (
                <> Banco {STORE.bankName} · Ag. {STORE.bankAgency} · Conta {STORE.bankAccount}</>
              ) : (
                <> Fale conosco para os dados bancários.</>
              )}
            </p>
          )}
          <Link href="/contato" className="btn btn-outline" style={{ marginTop: 12, display: 'inline-block' }}>
            Falar com a loja
          </Link>
        </div>
      )}

      <h2>Itens</h2>
      <ul className="order-items-list">
        {items.map((item) => (
          <li key={item.id}>
            <span>
              {item.product_name || 'Peça'}
              {item.size ? ` · ${item.size}` : ''} × {item.quantity}
            </span>
            <strong>
              {item.unit_price != null ? formatPrice(Number(item.unit_price) * item.quantity) : '—'}
            </strong>
          </li>
        ))}
      </ul>
      <div className="summary-rows" style={{ maxWidth: 420, marginBottom: 8 }}>
        <p><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></p>
        {discount > 0 && (
          <p><span>Cupom {order.coupon_code}</span><strong>− {formatPrice(discount)}</strong></p>
        )}
        <p><span>Frete</span><strong>{shipping === 0 ? 'Grátis' : formatPrice(shipping)}</strong></p>
        {(order.shipping_company || order.shipping_service_name) && (
          <p className="muted" style={{ fontSize: 13 }}>
            {order.shipping_company}
            {order.shipping_service_name ? ` · ${order.shipping_service_name}` : ''}
            {order.shipping_delivery_days ? ` · ${order.shipping_delivery_days} dias úteis` : ''}
          </p>
        )}
      </div>
      <p className="summary-total"><span>Total</span><strong>{formatPrice(order.total_price)}</strong></p>

      <h2>Entrega</h2>
      <p>
        {order.customer_name}<br />
        {order.shipping_street}, {order.shipping_number}
        {order.shipping_complement ? ` — ${order.shipping_complement}` : ''}<br />
        {order.shipping_neighborhood} · {order.shipping_city}/{order.shipping_state}<br />
        CEP {order.shipping_zip}<br />
        {order.customer_phone} · {order.customer_email}
      </p>

      <Link href="/conta" className="btn btn-outline">Voltar à conta</Link>
    </div>
  )
}
