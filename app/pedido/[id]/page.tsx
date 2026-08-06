'use client'

import { formatPrice } from '@/lib/format'
import { STORE } from '@/lib/store-config'
import {
  ORDER_STATUS_LABELS,
  ORDER_TRACK_STEPS,
  orderTrackIndex,
} from '@/lib/types'
import type { Order, OrderItem } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const MpPaymentBrick = dynamic(() => import('@/components/mp-payment-brick'), {
  ssr: false,
  loading: () => <p className="muted">Carregando formulário seguro...</p>,
})

const MpPixQr = dynamic(() => import('@/components/mp-pix-qr'), {
  ssr: false,
  loading: () => <p className="muted">Gerando QR Code PIX...</p>,
})

function OrderTimeline({ status, paymentStatus }: { status: string; paymentStatus?: string | null }) {
  const effective =
    status === 'pending' && paymentStatus === 'paid' ? 'paid' : status
  if (effective === 'cancelled') {
    return (
      <div className="order-timeline order-timeline--cancelled">
        <p>Pedido cancelado</p>
      </div>
    )
  }
  const current = orderTrackIndex(effective)

  return (
    <ol className="order-timeline">
      {ORDER_TRACK_STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={step.key}
            className={`order-timeline__step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
          >
            <span className="order-timeline__dot" aria-hidden />
            <div>
              <strong>{step.label}</strong>
              <small>{step.hint}</small>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [payTab, setPayTab] = useState<'pix' | 'card'>('pix')
  const router = useRouter()
  const orderRef = useRef<Order | null>(null)
  orderRef.current = order

  const loadOrder = useCallback(
    async (opts?: { silent?: boolean }) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/auth/login?next=/pedido/${id}`)
        return null
      }
      const { data: o } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
      const next = o as Order | null

      if (opts?.silent && orderRef.current && next) {
        const prev = orderRef.current
        const same =
          prev.payment_status === next.payment_status &&
          prev.status === next.status &&
          prev.mp_status === next.mp_status &&
          prev.tracking_code === next.tracking_code
        if (same) {
          setLoading(false)
          return next
        }
      }

      setOrder(next)
      if (next) {
        const { data: lines } = await supabase.from('order_items').select('*').eq('order_id', id)
        setItems((lines as OrderItem[]) || [])
      }
      setLoading(false)
      return next
    },
    [id, router],
  )

  const onPaid = useCallback(() => {
    loadOrder()
  }, [loadOrder])

  useEffect(() => {
    const mp = search.get('mp')
    if (mp === 'success') toast.success('Pagamento em processamento. Atualizando...')
    if (mp === 'pending') toast.message('Pagamento pendente.')
    if (mp === 'failure') toast.error('Pagamento não concluído.')
  }, [search])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  useEffect(() => {
    if (!order) return
    const waitingPay =
      (order.payment_status === 'pending' || order.status === 'pending') &&
      order.payment_method === 'mercadopago'
    const waitingShip = ['paid', 'preparing', 'shipped'].includes(order.status)
    if (!waitingPay && !waitingShip) return

    const t = setInterval(() => loadOrder({ silent: true }), 12000)
    return () => clearInterval(t)
  }, [order?.id, order?.payment_status, order?.status, order?.payment_method, loadOrder])

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(STORE.pixKey)
      toast.success('Chave PIX copiada.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  const copyTracking = async () => {
    if (!order?.tracking_code) return
    try {
      await navigator.clipboard.writeText(order.tracking_code)
      toast.success('Código de rastreio copiado.')
    } catch {
      toast.error('Não foi possível copiar.')
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
  const awaitingPayment =
    (order.payment_status === 'pending' || order.status === 'pending') &&
    order.payment_status !== 'paid'
  const failed = order.payment_status === 'failed'
  const showPayment = awaitingPayment || failed
  const afterPay =
    order.payment_status === 'paid' ||
    ['paid', 'preparing', 'shipped', 'delivered'].includes(order.status)
  const payAmount = Number(order.total_price)
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status
  const etaDays = order.shipping_delivery_days || STORE.shippingDaysMax

  return (
    <div className="container page-pad order-page">
      <header className="order-hero">
        <p className="order-hero__kicker">Acompanhe seu pedido</p>
        <h1 className="page-title">Pedido {order.order_number || order.id.slice(0, 8)}</h1>
        <p className="order-hero__status">
          Situação atual: <strong>{statusLabel}</strong>
        </p>
      </header>

      <OrderTimeline status={order.status} paymentStatus={order.payment_status} />

      {afterPay && (
        <section className="order-panel order-panel--success">
          <h2>
            {order.status === 'delivered'
              ? 'Pedido entregue'
              : order.status === 'shipped'
                ? 'Seu pedido foi enviado'
                : order.status === 'preparing'
                  ? 'Em separação'
                  : 'Pagamento confirmado'}
          </h2>
          <p>
            {order.status === 'paid' &&
              'Recebemos seu pagamento. Em breve sua peça entra em separação na oficina.'}
            {order.status === 'preparing' &&
              'Estamos preparando sua peça com cuidado. Você verá o rastreio aqui quando enviarmos.'}
            {order.status === 'shipped' &&
              'O pedido saiu para entrega. Use o código de rastreio abaixo para acompanhar.'}
            {order.status === 'delivered' &&
              'Esperamos que você ame sua peça. Qualquer dúvida, fale conosco.'}
          </p>

          <div className="order-ship-grid">
            <div>
              <h3>Entrega</h3>
              <p>
                {order.shipping_company || 'Transportadora'}
                {order.shipping_service_name ? ` · ${order.shipping_service_name}` : ''}
              </p>
              <p className="muted">
                Prazo estimado: até <strong>{etaDays} dias úteis</strong> após a confirmação do pagamento
              </p>
            </div>
            <div>
              <h3>Rastreio</h3>
              {order.tracking_code ? (
                <>
                  <p className="order-tracking-code">{order.tracking_code}</p>
                  <button type="button" className="btn btn-outline btn-sm" onClick={copyTracking}>
                    Copiar código
                  </button>
                </>
              ) : (
                <p className="muted">
                  Ainda sem código. Assim que enviarmos, aparece aqui automaticamente.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {showPayment && (
        <section className="order-panel order-panel--pay">
          <div className="order-pay-head">
            <div>
              <h2>{failed ? 'Tentar pagar novamente' : 'Finalize o pagamento'}</h2>
              <p className="muted">
                Total a pagar: <strong>{formatPrice(order.total_price)}</strong>
              </p>
            </div>
          </div>

          {(order.payment_method === 'mercadopago' || order.payment_method === 'pix') && (
            <>
              <div className="order-pay-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={payTab === 'pix' ? 'is-active' : ''}
                  onClick={() => setPayTab('pix')}
                >
                  PIX (QR Code)
                </button>
                {order.payment_method === 'mercadopago' && (
                  <button
                    type="button"
                    role="tab"
                    className={payTab === 'card' ? 'is-active' : ''}
                    onClick={() => setPayTab('card')}
                  >
                    Cartão
                  </button>
                )}
              </div>

              {payTab === 'pix' || order.payment_method === 'pix' ? (
                <div className="order-pay-body">
                  <MpPixQr orderId={order.id} onPaid={onPaid} />
                  {order.payment_method === 'pix' && (
                    <p className="muted order-pay-alt">
                      Alternativa — chave da loja: <strong>{STORE.pixKey}</strong>{' '}
                      <button type="button" className="btn btn-outline btn-sm" onClick={copyPix}>
                        Copiar
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <div className="order-pay-body">
                  <MpPaymentBrick
                    orderId={order.id}
                    amount={payAmount}
                    payerEmail={order.customer_email}
                    payerName={order.customer_name}
                    onPaid={onPaid}
                  />
                </div>
              )}
            </>
          )}

          {order.payment_method === 'transferencia' && (
            <p>
              Transferência bancária.
              {STORE.bankName ? (
                <> Banco {STORE.bankName} · Ag. {STORE.bankAgency} · Conta {STORE.bankAccount}</>
              ) : (
                <> Fale conosco para os dados bancários.</>
              )}
            </p>
          )}

          <Link href="/contato" className="btn btn-outline" style={{ marginTop: 16, display: 'inline-block' }}>
            Falar com a loja
          </Link>
        </section>
      )}

      <div className="order-layout">
        <section className="order-panel">
          <h2>Itens</h2>
          <ul className="order-items-list">
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.product_name || 'Peça'}
                  {item.size ? ` · ${item.size}` : ''} × {item.quantity}
                </span>
                <strong>
                  {item.unit_price != null
                    ? formatPrice(Number(item.unit_price) * item.quantity)
                    : '—'}
                </strong>
              </li>
            ))}
          </ul>
          <div className="summary-rows">
            <p><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></p>
            {discount > 0 && (
              <p><span>Cupom {order.coupon_code}</span><strong>− {formatPrice(discount)}</strong></p>
            )}
            <p>
              <span>Frete</span>
              <strong>{shipping === 0 ? 'Grátis' : formatPrice(shipping)}</strong>
            </p>
          </div>
          <p className="summary-total">
            <span>Total</span>
            <strong>{formatPrice(order.total_price)}</strong>
          </p>
        </section>

        <section className="order-panel">
          <h2>Endereço de entrega</h2>
          <p className="order-address">
            <strong>{order.customer_name}</strong><br />
            {order.shipping_street}, {order.shipping_number}
            {order.shipping_complement ? ` — ${order.shipping_complement}` : ''}<br />
            {order.shipping_neighborhood}<br />
            {order.shipping_city}/{order.shipping_state} · CEP {order.shipping_zip}<br />
            <span className="muted">
              {order.customer_phone}<br />
              {order.customer_email}
            </span>
          </p>
          {(order.shipping_company || order.shipping_service_name) && (
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              Modalidade: {order.shipping_company}
              {order.shipping_service_name ? ` · ${order.shipping_service_name}` : ''}
            </p>
          )}
        </section>
      </div>

      <div className="order-footer-actions">
        <Link href="/conta" className="btn btn-outline">Minha conta</Link>
        <Link href="/loja" className="btn">Continuar comprando</Link>
      </div>
    </div>
  )
}
