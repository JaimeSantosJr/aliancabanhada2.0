'use client'

import { categoryLabel, formatPrice, materialLabel } from '@/lib/format'
import { printOrderShippingLabel } from '@/lib/print-shipping-label'
import { ORDER_STATUS_LABELS } from '@/lib/types'
import type { Coupon, Order, Product } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useAdminTheme } from './admin-root'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type Tab = 'overview' | 'products' | 'orders' | 'coupons' | 'custom' | 'messages' | 'newsletter'

type CustomOrder = {
  id: string
  name: string
  email: string
  phone: string | null
  product_type: string
  material: string
  size: string | null
  engraving: string | null
  description: string
  budget: number | null
  status: string
  created_at: string
}

type ContactMessage = {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  created_at: string
  is_read?: boolean
}

type Subscriber = { id: string; email: string; created_at: string }

type OrderItemRow = {
  id: string
  product_name?: string | null
  size?: string | null
  quantity: number
  unit_price?: number | null
}

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  image_url: '',
  category: 'alianca',
  material: 'Ouro banhado',
  size_range: '12,13,14,15,16,17,18,19,20,21,22,23,24',
  in_stock: true,
  free_shipping: false,
  stock_qty: '',
}

const STATUS_FLOW = ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'] as const

const NAV: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'products', label: 'Produtos' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'coupons', label: 'Cupons' },
  { id: 'custom', label: 'Personalizadas' },
  { id: 'messages', label: 'Mensagens' },
  { id: 'newsletter', label: 'Newsletter' },
]

const emptyCoupon = {
  code: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  min_subtotal: '0',
  max_uses: '',
  ends_at: '',
  is_active: true,
}

export default function AdminPage() {
  const [ok, setOk] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [customs, setCustoms] = useState<CustomOrder[]>([])
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponForm, setCouponForm] = useState(emptyCoupon)
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [form, setForm] = useState(emptyProduct)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [trackingDraft, setTrackingDraft] = useState('')
  const [documentDraft, setDocumentDraft] = useState('')
  const [nfeLoading, setNfeLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [orderQuery, setOrderQuery] = useState('')
  const [orderFilter, setOrderFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([])
  const [adminEmail, setAdminEmail] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useAdminTheme()

  const reload = useCallback(async () => {
    setLoadingData(true)
    try {
      const [p, o, c, m, n, cp] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('custom_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
        supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      ])

      if (p.error) toast.error(`Produtos: ${p.error.message}`)
      if (o.error) toast.error(`Pedidos: ${o.error.message}`)
      if (cp.error && !cp.error.message.includes('coupons')) toast.error(`Cupons: ${cp.error.message}`)

      setProducts((p.data as Product[]) || [])
      setOrders((o.data as Order[]) || [])
      setCustoms((c.data as CustomOrder[]) || [])
      setMessages((m.data as ContactMessage[]) || [])
      setSubscribers((n.data as Subscriber[]) || [])
      setCoupons((cp.data as Coupon[]) || [])
    } finally {
      setLoadingData(false)
    }
  }, [supabase])

  useEffect(() => {
    let mounted = true
    const gate = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login?next=/admin')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, email')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.is_admin) {
        toast.error('Acesso restrito a administradores')
        router.replace('/conta')
        return
      }
      if (!mounted) return
      setAdminEmail(profile.email || user.email || '')
      setOk(true)
      await reload()
    }
    gate()
    return () => { mounted = false }
  }, [])

  const stats = useMemo(() => {
    const revenue = orders
      .filter((o) => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status) || o.payment_status === 'paid')
      .reduce((s, o) => s + Number(o.total_price || 0), 0)
    const pending = orders.filter((o) => o.status === 'pending').length
    const customNew = customs.filter((c) => !c.status || c.status === 'novo').length
    return {
      revenue,
      orders: orders.length,
      pending,
      products: products.length,
      inStock: products.filter((p) => p.in_stock).length,
      customs: customNew,
      messages: messages.length,
      subscribers: subscribers.length,
    }
  }, [orders, products, customs, messages, subscribers])

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      `${p.name} ${p.category} ${p.material} ${p.description}`.toLowerCase().includes(q),
    )
  }, [products, query])

  const filteredOrders = useMemo(() => {
    let list = [...orders]
    if (orderFilter !== 'all') list = list.filter((o) => o.status === orderFilter)
    const q = orderQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((o) =>
        `${o.order_number} ${o.customer_name} ${o.customer_email} ${o.status}`.toLowerCase().includes(q),
      )
    }
    return list
  }, [orders, orderFilter, orderQuery])

  const goTab = (id: Tab) => {
    setTab(id)
    setSidebarOpen(false)
  }

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.price) {
      toast.error('Preencha nome e preço')
      return
    }
    setSavingProduct(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      image_url: form.image_url || '/products/alianca-canal-escovada.png',
      category: form.category,
      material: form.material,
      size_range: form.size_range,
      in_stock: form.in_stock,
      free_shipping: form.free_shipping,
      stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty),
    }
    const { error } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert(payload)
    setSavingProduct(false)
    if (error) return toast.error(error.message)
    toast.success(editingId ? 'Produto atualizado' : 'Produto publicado')
    setForm(emptyProduct)
    setEditingId(null)
    await reload()
  }

  const editProduct = (p: Product) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      image_url: p.image_url || '',
      category: p.category,
      material: p.material,
      size_range: p.size_range || '',
      in_stock: p.in_stock,
      free_shipping: Boolean(p.free_shipping),
      stock_qty: p.stock_qty != null ? String(p.stock_qty) : '',
    })
    goTab('products')
  }

  const removeProduct = async (id: string) => {
    if (!confirm('Remover este produto do catálogo?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Produto removido')
      if (editingId === id) {
        setEditingId(null)
        setForm(emptyProduct)
      }
      await reload()
    }
  }

  const toggleStock = async (p: Product) => {
    const { error } = await supabase.from('products').update({ in_stock: !p.in_stock }).eq('id', p.id)
    if (error) toast.error(error.message)
    else await reload()
  }

  const openOrder = async (order: Order) => {
    setSelectedOrder(order)
    setTrackingDraft(order.tracking_code || '')
    setDocumentDraft(order.customer_document || '')
    const { data, error } = await supabase.from('order_items').select('*').eq('order_id', order.id)
    if (error) toast.error(error.message)
    setOrderItems((data as OrderItemRow[]) || [])
  }

  const saveTracking = async () => {
    if (!selectedOrder) return
    const { error } = await supabase
      .from('orders')
      .update({ tracking_code: trackingDraft.trim() || null })
      .eq('id', selectedOrder.id)
    if (error) return toast.error(error.message)
    toast.success('Rastreio salvo')
    setSelectedOrder({ ...selectedOrder, tracking_code: trackingDraft.trim() || null })
    await reload()
  }

  const saveDocument = async () => {
    if (!selectedOrder) return
    const { error } = await supabase
      .from('orders')
      .update({ customer_document: documentDraft.replace(/\D/g, '') || null })
      .eq('id', selectedOrder.id)
    if (error) {
      toast.error(
        error.message.includes('customer_document')
          ? 'Execute supabase/fiscal.sql no Supabase.'
          : error.message,
      )
      return
    }
    toast.success('Documento salvo')
    setSelectedOrder({ ...selectedOrder, customer_document: documentDraft.replace(/\D/g, '') || null })
  }

  const printLabel = () => {
    if (!selectedOrder) return
    const okPrint = printOrderShippingLabel(selectedOrder, orderItems)
    if (!okPrint) toast.error('Permita pop-ups para imprimir a etiqueta.')
  }

  const requestNfe = async () => {
    if (!selectedOrder) return
    setNfeLoading(true)
    try {
      const res = await fetch('/api/admin/nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Nao foi possivel solicitar NF-e.')
        if (data.nfe_status) {
          setSelectedOrder({ ...selectedOrder, nfe_status: data.nfe_status })
        }
        return
      }
      toast.success('NF-e solicitada.')
      await reload()
    } catch {
      toast.error('Falha ao falar com a API de NF-e.')
    } finally {
      setNfeLoading(false)
    }
  }

  const uploadProductImage = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem.')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) {
      setUploading(false)
      toast.error(
        error.message.includes('Bucket') || error.message.includes('not found')
          ? 'Execute supabase/hardening.sql (bucket product-images).'
          : error.message,
      )
      return
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    setForm((f) => ({ ...f, image_url: data.publicUrl }))
    setUploading(false)
    toast.success('Imagem enviada')
  }

  const markMessageRead = async (id: string) => {
    const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', id)
    if (error) toast.error(error.message)
    else {
      setMessages((list) => list.map((m) => (m.id === id ? { ...m, is_read: true } : m)))
    }
  }

  const setOrderStatus = async (id: string, status: string) => {
    const patch: Record<string, string> = { status }
    if (status === 'paid') patch.payment_status = 'paid'
    if (status === 'pending') patch.payment_status = 'pending'
    const { error } = await supabase.from('orders').update(patch).eq('id', id)
    if (error) return toast.error(error.message)

    if (status === 'paid') {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id')
        .eq('order_id', id)
      const ids = [...new Set((items || []).map((i) => i.product_id).filter(Boolean))]
      if (ids.length) {
        await supabase.rpc('mark_products_sold', { p_ids: ids })
      }
    }

    toast.success('Status atualizado')
    await reload()
    setSelectedOrder((prev) => (prev?.id === id ? { ...prev, ...patch } : prev))
  }

  const setCustomStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('custom_orders').update({ status }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Solicitação atualizada')
    await reload()
  }

  const saveCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = couponForm.code.trim().toUpperCase()
    const discount_value = Number(couponForm.discount_value)
    if (!code || !discount_value || discount_value <= 0) {
      toast.error('Informe código e valor do desconto.')
      return
    }
    setSavingCoupon(true)
    const payload = {
      code,
      discount_type: couponForm.discount_type,
      discount_value,
      min_subtotal: Number(couponForm.min_subtotal || 0),
      max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : null,
      ends_at: couponForm.ends_at ? new Date(couponForm.ends_at).toISOString() : null,
      is_active: couponForm.is_active,
    }
    const { error } = await supabase.from('coupons').insert(payload)
    setSavingCoupon(false)
    if (error) {
      toast.error(
        error.message.includes('coupons') || error.code === '42P01'
          ? 'Execute supabase/commerce-integrations.sql no Supabase.'
          : error.message,
      )
      return
    }
    toast.success('Cupom criado')
    setCouponForm(emptyCoupon)
    await reload()
  }

  const toggleCoupon = async (c: Coupon) => {
    const { error } = await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id)
    if (error) toast.error(error.message)
    else await reload()
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!ok) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Preparando painel...</p>
      </div>
    )
  }

  return (
    <div className={`admin-app ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <button type="button" className="admin-menu-fab" onClick={() => setSidebarOpen((v) => !v)}>
        {sidebarOpen ? 'Fechar' : 'Menu'}
      </button>

      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>Aliança Banhada</span>
          <small>Console</small>
        </div>
        <div className="admin-user-chip">
          <strong>Admin</strong>
          <span>{adminEmail}</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'is-active' : ''}
              onClick={() => goTab(item.id)}
            >
              {item.label}
              {item.id === 'orders' && stats.pending > 0 && <em>{stats.pending}</em>}
              {item.id === 'custom' && stats.customs > 0 && <em>{stats.customs}</em>}
              {item.id === 'messages' && stats.messages > 0 && <em>{stats.messages}</em>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <button type="button" className="admin-theme-toggle" onClick={toggleTheme}>
            Tema: {theme === 'dark' ? 'Escuro' : 'Claro'} (alternar)
          </button>
          <button type="button" onClick={() => reload()} disabled={loadingData}>
            {loadingData ? 'Atualizando...' : 'Atualizar dados'}
          </button>
          <Link href="/">Ver loja</Link>
          <Link href="/conta">Minha conta</Link>
          <button type="button" onClick={logout}>Sair</button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <div>
            <p className="admin-kicker">Operação da loja</p>
            <h1>{NAV.find((n) => n.id === tab)?.label}</h1>
            <p>Somente alianças e solitários · banho de ouro ou ouro</p>
          </div>
          <div className="admin-topbar-actions">
            {tab === 'products' && (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  setEditingId(null)
                  setForm(emptyProduct)
                }}
              >
                Nova peça
              </button>
            )}
          </div>
        </div>

        {tab === 'overview' && (
          <section className="admin-section">
            <div className="admin-kpi-grid">
              <article>
                <span>Receita confirmada</span>
                <strong>{formatPrice(stats.revenue)}</strong>
              </article>
              <article>
                <span>Pedidos</span>
                <strong>{stats.orders}</strong>
                <small>{stats.pending} aguardando pagamento</small>
              </article>
              <article>
                <span>Catálogo</span>
                <strong>{stats.products}</strong>
                <small>{stats.inStock} disponíveis</small>
              </article>
              <article>
                <span>Inbox</span>
                <strong>{stats.messages + stats.customs}</strong>
                <small>{stats.subscribers} na newsletter</small>
              </article>
            </div>

            <div className="admin-split">
              <div className="admin-card">
                <div className="admin-card-head">
                  <h2>Pedidos recentes</h2>
                  <button type="button" className="linkish" onClick={() => goTab('orders')}>Ver todos</button>
                </div>
                <ul className="admin-table">
                  {orders.slice(0, 6).map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => { goTab('orders'); openOrder(o) }}>
                        <strong>{o.order_number || o.id.slice(0, 8)}</strong>
                        <span>{o.customer_name || '—'}</span>
                        <span>{ORDER_STATUS_LABELS[o.status] || o.status}</span>
                        <span>{formatPrice(o.total_price)}</span>
                      </button>
                    </li>
                  ))}
                  {orders.length === 0 && <li className="empty">Nenhum pedido ainda.</li>}
                </ul>
              </div>
              <div className="admin-card">
                <div className="admin-card-head">
                  <h2>Personalizadas</h2>
                  <button type="button" className="linkish" onClick={() => goTab('custom')}>Ver todas</button>
                </div>
                <ul className="admin-table">
                  {customs.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <div>
                        <strong>{c.name}</strong>
                        <span>{categoryLabel(c.product_type)} · {materialLabel(c.material)}</span>
                        <span>{c.status || 'novo'}</span>
                      </div>
                    </li>
                  ))}
                  {customs.length === 0 && <li className="empty">Nenhuma solicitação.</li>}
                </ul>
              </div>
            </div>
          </section>
        )}

        {tab === 'products' && (
          <section className="admin-section admin-products">
            <form className="admin-card admin-form" onSubmit={saveProduct}>
              <h2>{editingId ? 'Editar peça' : 'Nova peça'}</h2>
              <div className="admin-form-grid">
                <label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label>Preço (R$)<input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
                <label className="span-2">Descrição<textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                <label className="span-2">URL da imagem<input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://... ou faça upload" /></label>
                <label className="span-2">
                  Upload da imagem
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => uploadProductImage(e.target.files?.[0] || null)}
                  />
                  {uploading ? <small>Enviando...</small> : null}
                </label>
                <label>
                  Categoria
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="alianca">Aliança</option>
                    <option value="solitario">Solitário</option>
                  </select>
                </label>
                <label>
                  Material
                  <select value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })}>
                    <option value="Ouro banhado">Banho de ouro</option>
                    <option value="Ouro">Ouro</option>
                  </select>
                </label>
                <label className="span-2">Tamanhos<input value={form.size_range} onChange={(e) => setForm({ ...form, size_range: e.target.value })} /></label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={form.in_stock} onChange={(e) => setForm({ ...form, in_stock: e.target.checked })} />
                  Em estoque
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.free_shipping}
                    onChange={(e) => setForm({ ...form, free_shipping: e.target.checked })}
                  />
                  Frete grátis
                </label>
                <label>
                  Estoque (qtd)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock_qty}
                    onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                    placeholder="Opcional"
                  />
                </label>
              </div>
              {form.image_url ? (
                <div className="admin-preview"><img src={form.image_url} alt="Prévia" /></div>
              ) : null}
              <div className="admin-form-actions">
                <button type="submit" className="admin-btn" disabled={savingProduct}>
                  {savingProduct ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Publicar produto'}
                </button>
                {editingId && (
                  <button type="button" className="admin-btn ghost" onClick={() => { setEditingId(null); setForm(emptyProduct) }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="admin-card">
              <div className="admin-card-head">
                <h2>Catálogo ({filteredProducts.length})</h2>
                <input className="admin-search" placeholder="Buscar peça..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <ul className="admin-product-grid">
                {filteredProducts.map((p) => (
                  <li key={p.id}>
                    <img src={p.image_url} alt="" />
                    <div>
                      <strong>{p.name}</strong>
                      <p>{categoryLabel(p.category)} · {materialLabel(p.material)}</p>
                      <p>{formatPrice(p.price)}</p>
                      <span className={`stock-pill ${p.in_stock ? 'on' : 'off'}`}>
                        {p.in_stock ? 'Em estoque' : 'Indisponível'}
                        {p.stock_qty != null ? ` · ${p.stock_qty}` : ''}
                      </span>
                      {p.free_shipping ? <span className="stock-pill on">Frete grátis</span> : null}
                    </div>
                    <div className="admin-row-actions">
                      <button type="button" onClick={() => editProduct(p)}>Editar</button>
                      <button type="button" onClick={() => toggleStock(p)}>{p.in_stock ? 'Esgotar' : 'Reativar'}</button>
                      <Link href={`/produto/${p.id}`} target="_blank">Ver</Link>
                      <button type="button" className="danger" onClick={() => removeProduct(p.id)}>Excluir</button>
                    </div>
                  </li>
                ))}
                {filteredProducts.length === 0 && <li className="empty">Nenhuma peça encontrada.</li>}
              </ul>
            </div>
          </section>
        )}

        {tab === 'orders' && (
          <section className="admin-section admin-orders-layout">
            <div className="admin-card">
              <div className="admin-card-head stacked">
                <h2>Pedidos ({filteredOrders.length})</h2>
                <div className="admin-filters">
                  <input
                    className="admin-search"
                    placeholder="Buscar cliente ou nº..."
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                  />
                  <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
                    <option value="all">Todos os status</option>
                    {STATUS_FLOW.map((s) => (
                      <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <ul className="admin-table dense">
                {filteredOrders.map((o) => (
                  <li key={o.id} className={selectedOrder?.id === o.id ? 'is-selected' : ''}>
                    <button type="button" onClick={() => openOrder(o)}>
                      <strong>{o.order_number || o.id.slice(0, 8)}</strong>
                      <span>{o.customer_name || '—'}</span>
                      <span>{ORDER_STATUS_LABELS[o.status] || o.status}</span>
                      <span>{formatPrice(o.total_price)}</span>
                      <span>{new Date(o.created_at).toLocaleDateString('pt-BR')}</span>
                    </button>
                  </li>
                ))}
                {filteredOrders.length === 0 && <li className="empty">Nenhum pedido neste filtro.</li>}
              </ul>
            </div>

            <div className="admin-card order-detail-panel">
              {!selectedOrder ? (
                <div className="admin-empty-panel">
                  <p>Selecione um pedido à esquerda para ver detalhes e atualizar o status.</p>
                </div>
              ) : (
                <>
                  <div className="admin-card-head">
                    <h2>{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}</h2>
                    <Link href={`/pedido/${selectedOrder.id}`}>Abrir página</Link>
                  </div>
                  <p className="admin-meta">
                    {ORDER_STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                    {' · '}
                    {(selectedOrder.payment_method || 'pix').toUpperCase()}
                    {' · '}
                    {selectedOrder.payment_status || 'pending'}
                  </p>
                  <div className="admin-detail-block">
                    <strong>{selectedOrder.customer_name}</strong>
                    <span>{selectedOrder.customer_email}</span>
                    <span>{selectedOrder.customer_phone}</span>
                  </div>
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    CPF/CNPJ (NF-e)
                    <input
                      value={documentDraft}
                      onChange={(e) => setDocumentDraft(e.target.value)}
                      placeholder="Somente numeros"
                      style={{ width: '100%', marginTop: 6 }}
                    />
                  </label>
                  <button type="button" className="admin-btn ghost" onClick={saveDocument} style={{ marginBottom: 12 }}>
                    Salvar documento
                  </button>
                  <div className="admin-detail-block">
                    <span>
                      {selectedOrder.shipping_street}, {selectedOrder.shipping_number}
                      {selectedOrder.shipping_complement ? ` — ${selectedOrder.shipping_complement}` : ''}
                    </span>
                    <span>
                      {selectedOrder.shipping_neighborhood} · {selectedOrder.shipping_city}/{selectedOrder.shipping_state}
                    </span>
                    <span>CEP {selectedOrder.shipping_zip}</span>
                  </div>
                  <ul className="admin-lines">
                    {orderItems.map((item) => (
                      <li key={item.id}>
                        <span>{item.product_name} · tam. {item.size} × {item.quantity}</span>
                        <strong>
                          {item.unit_price != null ? formatPrice(Number(item.unit_price) * item.quantity) : '—'}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  {(selectedOrder.discount_amount || 0) > 0 && (
                    <p className="admin-meta">
                      Cupom {selectedOrder.coupon_code}: − {formatPrice(Number(selectedOrder.discount_amount))}
                    </p>
                  )}
                  {(selectedOrder.shipping_company || selectedOrder.shipping_service_name) && (
                    <p className="admin-meta">
                      Frete: {selectedOrder.shipping_company}
                      {selectedOrder.shipping_service_name ? ` · ${selectedOrder.shipping_service_name}` : ''}
                      {' · '}
                      {formatPrice(Number(selectedOrder.shipping_cost || 0))}
                    </p>
                  )}
                  {selectedOrder.mp_payment_id && (
                    <p className="admin-meta">MP payment: {selectedOrder.mp_payment_id}</p>
                  )}
                  <p className="summary-total">
                    <span>Total</span>
                    <strong>{formatPrice(selectedOrder.total_price)}</strong>
                  </p>
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    Código de rastreio
                    <input
                      value={trackingDraft}
                      onChange={(e) => setTrackingDraft(e.target.value)}
                      placeholder="BR123456789BR"
                      style={{ width: '100%', marginTop: 6 }}
                    />
                  </label>
                  <div className="admin-row-actions" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" className="admin-btn" onClick={saveTracking}>
                      Salvar rastreio
                    </button>
                    <button type="button" className="admin-btn" onClick={printLabel}>
                      Imprimir etiqueta
                    </button>
                    <button type="button" className="admin-btn ghost" onClick={requestNfe} disabled={nfeLoading}>
                      {nfeLoading ? 'NF-e...' : 'Solicitar NF-e'}
                    </button>
                  </div>
                  {(selectedOrder.nfe_status || selectedOrder.nfe_number) && (
                    <p className="admin-meta">
                      NF-e: {selectedOrder.nfe_status || '—'}
                      {selectedOrder.nfe_number ? ` · nº ${selectedOrder.nfe_number}` : ''}
                      {selectedOrder.nfe_error ? ` · ${selectedOrder.nfe_error}` : ''}
                    </p>
                  )}
                  <div className="admin-status-actions">
                    {STATUS_FLOW.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={selectedOrder.status === s ? 'is-active' : ''}
                        onClick={() => setOrderStatus(selectedOrder.id, s)}
                      >
                        {ORDER_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {tab === 'coupons' && (
          <section className="admin-section admin-products">
            <form className="admin-card admin-form" onSubmit={saveCoupon}>
              <h2>Novo cupom</h2>
              <div className="admin-form-grid">
                <label>
                  Código
                  <input
                    required
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    placeholder="ALIANCA10"
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        discount_type: e.target.value as 'percent' | 'fixed',
                      })
                    }
                  >
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </label>
                <label>
                  Valor
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={couponForm.discount_value}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                  />
                </label>
                <label>
                  Pedido mínimo (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={couponForm.min_subtotal}
                    onChange={(e) => setCouponForm({ ...couponForm, min_subtotal: e.target.value })}
                  />
                </label>
                <label>
                  Limite de usos
                  <input
                    type="number"
                    min="1"
                    placeholder="Ilimitado"
                    value={couponForm.max_uses}
                    onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                  />
                </label>
                <label>
                  Validade
                  <input
                    type="date"
                    value={couponForm.ends_at}
                    onChange={(e) => setCouponForm({ ...couponForm, ends_at: e.target.value })}
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={couponForm.is_active}
                    onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })}
                  />
                  Ativo
                </label>
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="admin-btn" disabled={savingCoupon}>
                  {savingCoupon ? 'Salvando...' : 'Criar cupom'}
                </button>
              </div>
            </form>

            <div className="admin-card">
              <div className="admin-card-head">
                <h2>Cupons ({coupons.length})</h2>
              </div>
              <ul className="admin-table dense">
                {coupons.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.code}</strong>
                      <span>
                        {c.discount_type === 'percent'
                          ? `${c.discount_value}%`
                          : formatPrice(Number(c.discount_value))}
                        {' · '}
                        mín. {formatPrice(Number(c.min_subtotal || 0))}
                        {' · '}
                        usos {c.used_count}{c.max_uses != null ? `/${c.max_uses}` : ''}
                      </span>
                      <span className={`stock-pill ${c.is_active ? 'on' : 'off'}`}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="admin-row-actions">
                      <button type="button" onClick={() => toggleCoupon(c)}>
                        {c.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </li>
                ))}
                {coupons.length === 0 && (
                  <li className="empty">Nenhum cupom. Execute commerce-integrations.sql se a tabela não existir.</li>
                )}
              </ul>
            </div>
          </section>
        )}

        {tab === 'custom' && (
          <section className="admin-section">
            <div className="admin-card">
              <ul className="admin-inbox">
                {customs.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.name}</strong>
                      <span>{c.email}{c.phone ? ` · ${c.phone}` : ''}</span>
                      <p>{categoryLabel(c.product_type)} · {materialLabel(c.material)} · tam. {c.size || '—'} · gravação: {c.engraving || '—'}</p>
                      <p>{c.description}</p>
                      {c.budget != null && <p>Orçamento: {formatPrice(c.budget)}</p>}
                    </div>
                    <div className="admin-row-actions">
                      <select value={c.status || 'novo'} onChange={(e) => setCustomStatus(c.id, e.target.value)}>
                        <option value="novo">Novo</option>
                        <option value="em_analise">Em análise</option>
                        <option value="orcamento_enviado">Orçamento enviado</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="recusado">Recusado</option>
                      </select>
                    </div>
                  </li>
                ))}
                {customs.length === 0 && <li className="empty">Nenhuma solicitação personalizada.</li>}
              </ul>
            </div>
          </section>
        )}

        {tab === 'messages' && (
          <section className="admin-section">
            <div className="admin-card">
              <ul className="admin-inbox">
                {messages.map((m) => (
                  <li key={m.id} style={{ opacity: m.is_read ? 0.7 : 1 }}>
                    <div>
                      <strong>{m.name}{!m.is_read ? ' · Nova' : ''}</strong>
                      <span>{m.email}{m.phone ? ` · ${m.phone}` : ''}</span>
                      <p><em>{m.subject || 'Sem assunto'}</em></p>
                      <p>{m.message}</p>
                      <small>{new Date(m.created_at).toLocaleString('pt-BR')}</small>
                    </div>
                    {!m.is_read && (
                      <div className="admin-row-actions">
                        <button type="button" onClick={() => markMessageRead(m.id)}>Marcar lida</button>
                      </div>
                    )}
                  </li>
                ))}
                {messages.length === 0 && <li className="empty">Nenhuma mensagem.</li>}
              </ul>
            </div>
          </section>
        )}

        {tab === 'newsletter' && (
          <section className="admin-section">
            <div className="admin-card">
              <div className="admin-card-head">
                <h2>{subscribers.length} inscritos</h2>
              </div>
              <ul className="admin-table">
                {subscribers.map((s) => (
                  <li key={s.id}>
                    <div>
                      <strong>{s.email}</strong>
                      <span>{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </li>
                ))}
                {subscribers.length === 0 && <li className="empty">Nenhum inscrito ainda.</li>}
              </ul>
            </div>
          </section>
        )}
      </div>

      {sidebarOpen && <button type="button" className="admin-backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}
