'use client'

import { formatPrice } from '@/lib/format'
import { ORDER_STATUS_LABELS } from '@/lib/types'
import type { Order, OrderItem } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login')
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

  if (loading) return <p className="center-msg page-pad">Carregando pedido...</p>
  if (!order) {
    return (
      <div className="container page-pad center-msg">
        <p>Pedido não encontrado.</p>
        <Link href="/conta" className="btn">Minha conta</Link>
      </div>
    )
  }

  return (
    <div className="container page-pad">
      <h1 className="page-title">Pedido {order.order_number || order.id.slice(0, 8)}</h1>
      <div className="order-status-banner">
        Status: <strong>{ORDER_STATUS_LABELS[order.status] || order.status}</strong>
        {order.payment_method && (
          <> · Pagamento: {order.payment_method.toUpperCase()} ({order.payment_status || 'pending'})</>
        )}
      </div>

      {(order.payment_status === 'pending' || order.status === 'pending') && (
        <div className="pix-box">
          <h2>Como pagar</h2>
          <p>
            Faça o PIX ou transferência no valor de <strong>{formatPrice(order.total_price)}</strong> e
            envie o comprovante no WhatsApp informado no email de confirmação / página de contato.
          </p>
          <p className="muted">Chave PIX e dados bancários: configure com a loja (Contato).</p>
          <Link href="/contato" className="btn btn-outline">Falar com a loja</Link>
        </div>
      )}

      <h2>Itens</h2>
      <ul className="order-items-list">
        {items.map((item) => (
          <li key={item.id}>
            <span>
              {item.product_name || 'Peça'}
              {item.size ? ` · tam. ${item.size}` : ''} × {item.quantity}
            </span>
            <strong>
              {item.unit_price != null ? formatPrice(Number(item.unit_price) * item.quantity) : '—'}
            </strong>
          </li>
        ))}
      </ul>
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
