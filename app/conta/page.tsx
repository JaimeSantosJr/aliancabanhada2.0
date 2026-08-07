'use client'

import { formatPrice } from '@/lib/format'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/types'
import type { Order, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { fetchAddressByCep, formatCep } from '@/lib/viacep'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Section = 'inicio' | 'dados' | 'senha' | 'pedidos'

function statusTone(status: string) {
  if (status === 'cancelled') return 'is-cancelled'
  if (status === 'delivered') return 'is-done'
  if (status === 'shipped' || status === 'preparing' || status === 'paid') return 'is-progress'
  return 'is-pending'
}

function paymentTone(paymentStatus?: string | null) {
  if (paymentStatus === 'paid') return 'is-done'
  if (paymentStatus === 'failed' || paymentStatus === 'refunded') return 'is-cancelled'
  return 'is-pending'
}

function needsPayment(order: Order) {
  return (
    order.status !== 'cancelled' &&
    order.payment_status !== 'paid' &&
    (order.payment_status === 'pending' ||
      order.payment_status === 'failed' ||
      order.status === 'pending')
  )
}

function OrderCard({ order, featured }: { order: Order; featured?: boolean }) {
  const payLabel =
    PAYMENT_STATUS_LABELS[order.payment_status || ''] ||
    (order.payment_status ? order.payment_status : '—')
  const pendingPay = needsPayment(order)

  return (
    <li className={`account-order-card${featured ? ' is-featured' : ''}`}>
      <div className="account-order-card__top">
        <div>
          <p className="account-order-card__kicker">
            {new Date(order.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <strong className="account-order-card__number">
            {order.order_number || order.id.slice(0, 8)}
          </strong>
        </div>
        <p className="account-order-card__total">{formatPrice(order.total_price)}</p>
      </div>

      <div className="account-order-card__chips">
        <span className={`status-chip ${statusTone(order.status)}`}>
          {ORDER_STATUS_LABELS[order.status] || order.status}
        </span>
        <span className={`status-chip ${paymentTone(order.payment_status)}`}>{payLabel}</span>
      </div>

      {(order.shipping_service_name || order.tracking_code) && (
        <div className="account-order-card__meta">
          {order.shipping_company || order.shipping_service_name ? (
            <p>
              Frete:{' '}
              {[order.shipping_company, order.shipping_service_name].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {order.tracking_code ? (
            <p>
              Rastreio: <code>{order.tracking_code}</code>
            </p>
          ) : order.payment_status === 'paid' && order.status !== 'delivered' ? (
            <p className="muted">Rastreio disponível após o envio.</p>
          ) : null}
        </div>
      )}

      <div className="account-order-card__actions">
        <Link href={`/pedido/${order.id}`} className={pendingPay ? 'btn' : 'btn btn-outline'}>
          {pendingPay ? 'Pagar agora' : featured ? 'Acompanhar pedido' : 'Ver detalhes'}
        </Link>
      </div>
    </li>
  )
}

export default function ContaPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [section, setSection] = useState<Section>('inicio')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login?next=/conta')
        return
      }

      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (!profileData) {
        await supabase.from('profiles').insert({ id: user.id, email: user.email, full_name: '' })
        const res = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        profileData = res.data
      }

      setProfile(profileData as Profile)
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setOrders((orderData as Order[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8 || !profile) return
    setCepLoading(true)
    try {
      const addr = await fetchAddressByCep(digits)
      if (!addr) {
        toast.error('CEP não encontrado.')
        return
      }
      setProfile({
        ...profile,
        zip_code: formatCep(digits),
        street: addr.logradouro || profile.street,
        neighborhood: addr.bairro || profile.neighborhood,
        city: addr.localidade || profile.city,
        state: addr.uf || profile.state,
        complement: profile.complement || addr.complemento || '',
      })
    } finally {
      setCepLoading(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        street: profile.street,
        number: profile.number,
        complement: profile.complement,
        neighborhood: profile.neighborhood,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zip_code,
      })
      .eq('id', profile.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Dados salvos')
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.email) return
    if (newPassword.length < 8) {
      toast.error('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação não confere com a nova senha.')
      return
    }

    setChangingPassword(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    })
    if (signInError) {
      setChangingPassword(false)
      toast.error('Senha atual incorreta.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) {
      toast.error(error.message || 'Não foi possível alterar a senha.')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Senha alterada com sucesso.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  if (loading) return <p className="center-msg page-pad">Carregando conta...</p>
  if (!profile) return null

  const initials = (profile.full_name || profile.email || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  const latestOrder = orders[0] || null
  const pendingOrders = orders.filter(needsPayment)

  return (
    <div className="account-page">
      <div className="container">
        <section className="account-hero">
          <div className="account-avatar" aria-hidden>
            {initials || 'AB'}
          </div>
          <div className="account-hero__copy">
            <p className="eyebrow">Área do cliente</p>
            <h1>{profile.full_name || 'Sua conta'}</h1>
            <p>{profile.email}</p>
          </div>
          <div className="account-hero-actions">
            {profile.is_admin && (
              <Link href="/admin" className="btn">
                Painel admin
              </Link>
            )}
            <Link href="/loja" className="btn btn-outline">
              Continuar comprando
            </Link>
            <button type="button" className="account-signout" onClick={signOut}>
              Sair
            </button>
          </div>
        </section>

        <div className="account-shell">
          <nav className="account-nav" aria-label="Seções da conta">
            <button
              type="button"
              className={section === 'inicio' ? 'is-active' : ''}
              onClick={() => setSection('inicio')}
            >
              Início
            </button>
            <button
              type="button"
              className={section === 'dados' ? 'is-active' : ''}
              onClick={() => setSection('dados')}
            >
              Dados e entrega
            </button>
            <button
              type="button"
              className={section === 'pedidos' ? 'is-active' : ''}
              onClick={() => setSection('pedidos')}
            >
              Pedidos ({orders.length})
            </button>
            <button
              type="button"
              className={section === 'senha' ? 'is-active' : ''}
              onClick={() => setSection('senha')}
            >
              Trocar senha
            </button>
          </nav>

          <div className="account-panel" key={section}>
            {section === 'inicio' && (
              <div className="account-home">
                <div className="panel-intro">
                  <h2>Bem-vindo{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h2>
                  <p>Acompanhe pedidos, atualize o endereço de entrega e cuide do acesso à conta.</p>
                </div>

                {latestOrder ? (
                  <div className="account-home__latest">
                    <p className="account-section-label">Último pedido</p>
                    <ul className="account-order-list">
                      <OrderCard order={latestOrder} featured />
                    </ul>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>Você ainda não fez pedidos.</p>
                    <p className="muted">Explore a coleção e escolha a peça certa para o momento.</p>
                    <Link href="/loja" className="btn">
                      Ver coleção
                    </Link>
                  </div>
                )}

                {pendingOrders.length > 1 && (
                  <p className="account-home__hint">
                    Você tem {pendingOrders.length} pedidos aguardando pagamento.{' '}
                    <button type="button" className="linkish" onClick={() => setSection('pedidos')}>
                      Ver todos
                    </button>
                  </p>
                )}

                <div className="account-shortcuts">
                  <button type="button" onClick={() => setSection('dados')}>
                    Editar dados e entrega
                  </button>
                  <button type="button" onClick={() => setSection('pedidos')}>
                    Ver todos os pedidos
                  </button>
                  <button type="button" onClick={() => setSection('senha')}>
                    Trocar senha
                  </button>
                </div>
              </div>
            )}

            {section === 'dados' && (
              <form onSubmit={save} className="account-form-v2">
                <div className="panel-intro">
                  <h2>Dados pessoais</h2>
                  <p>Usados no checkout e no envio das suas alianças e solitários.</p>
                </div>
                <div className="form-grid">
                  <label>
                    Nome completo
                    <input
                      value={profile.full_name || ''}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Email
                    <input value={profile.email || ''} disabled />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      value={profile.phone || ''}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      autoComplete="tel"
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                  <label>
                    CEP
                    <input
                      value={profile.zip_code || ''}
                      onChange={(e) => {
                        const formatted = formatCep(e.target.value)
                        setProfile({ ...profile, zip_code: formatted })
                        if (formatted.replace(/\D/g, '').length === 8) {
                          void lookupCep(formatted)
                        }
                      }}
                      onBlur={(e) => void lookupCep(e.target.value)}
                      autoComplete="postal-code"
                      inputMode="numeric"
                    />
                    {cepLoading ? <small className="muted">Buscando endereço...</small> : null}
                  </label>
                  <label className="span-2">
                    Rua
                    <input
                      value={profile.street || ''}
                      onChange={(e) => setProfile({ ...profile, street: e.target.value })}
                      autoComplete="address-line1"
                    />
                  </label>
                  <label>
                    Número
                    <input
                      value={profile.number || ''}
                      onChange={(e) => setProfile({ ...profile, number: e.target.value })}
                    />
                  </label>
                  <label>
                    Complemento
                    <input
                      value={profile.complement || ''}
                      onChange={(e) => setProfile({ ...profile, complement: e.target.value })}
                    />
                  </label>
                  <label>
                    Bairro
                    <input
                      value={profile.neighborhood || ''}
                      onChange={(e) => setProfile({ ...profile, neighborhood: e.target.value })}
                    />
                  </label>
                  <label>
                    Cidade
                    <input
                      value={profile.city || ''}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      autoComplete="address-level2"
                    />
                  </label>
                  <label>
                    Estado
                    <input
                      maxLength={2}
                      value={profile.state || ''}
                      onChange={(e) =>
                        setProfile({ ...profile, state: e.target.value.toUpperCase() })
                      }
                      autoComplete="address-level1"
                    />
                  </label>
                </div>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </form>
            )}

            {section === 'senha' && (
              <form onSubmit={changePassword} className="account-form-v2">
                <div className="panel-intro">
                  <h2>Trocar senha</h2>
                  <p>Use pelo menos 8 caracteres. Guarde a nova senha em local seguro.</p>
                </div>
                <div className="form-grid single">
                  <label>
                    Senha atual
                    <div className="password-field">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? 'Ocultar' : 'Ver'}
                      </button>
                    </div>
                  </label>
                  <label>
                    Nova senha
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </label>
                  <label>
                    Confirmar nova senha
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </label>
                </div>
                <div className="account-form-footer">
                  <button type="submit" className="btn" disabled={changingPassword}>
                    {changingPassword ? 'Alterando...' : 'Alterar senha'}
                  </button>
                  <Link href="/auth/forgot-password" className="auth-help">
                    Esqueci a senha
                  </Link>
                </div>
              </form>
            )}

            {section === 'pedidos' && (
              <div>
                <div className="panel-intro">
                  <h2>Seus pedidos</h2>
                  <p>Acompanhe pagamento, preparo, envio e rastreio.</p>
                </div>
                {orders.length === 0 ? (
                  <div className="empty-state">
                    <p>Você ainda não fez pedidos.</p>
                    <p className="muted">Quando comprar, o histórico aparece aqui.</p>
                    <Link href="/loja" className="btn">
                      Ver coleção
                    </Link>
                  </div>
                ) : (
                  <ul className="account-order-list">
                    {orders.map((o) => (
                      <OrderCard key={o.id} order={o} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
