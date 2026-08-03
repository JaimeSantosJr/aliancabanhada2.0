'use client'

import { useCart } from '@/lib/cart'
import { formatPrice } from '@/lib/format'
import { cartItemKey, cartUnitPrice, formatCartSize, orderSizeLabel } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type FormState = {
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_street: string
  shipping_number: string
  shipping_complement: string
  shipping_neighborhood: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  payment_method: 'pix' | 'transferencia'
  notes: string
}

type AuthMode = 'signup' | 'login'

const empty: FormState = {
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  shipping_street: '',
  shipping_number: '',
  shipping_complement: '',
  shipping_neighborhood: '',
  shipping_city: '',
  shipping_state: '',
  shipping_zip: '',
  payment_method: 'pix',
  notes: '',
}

function OrderSummary() {
  const { items, subtotal } = useCart()
  return (
    <aside className="cart-summary">
      <h2>Pedido</h2>
      <ul className="checkout-items">
        {items.map((i) => (
          <li key={cartItemKey(i)}>
            <span>
              {i.product.name}
              {i.isPair ? ' (Par)' : ''} · {formatCartSize(i)} × {i.quantity}
            </span>
            <strong>{formatPrice(cartUnitPrice(i) * i.quantity)}</strong>
          </li>
        ))}
      </ul>
      <p className="summary-total"><span>Total</span><strong>{formatPrice(subtotal)}</strong></p>
    </aside>
  )
}

export default function CheckoutPage() {
  const { items, subtotal, clear, count } = useCart()
  const [form, setForm] = useState<FormState>(empty)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const fillFromUser = async (userIdValue: string, email?: string | null) => {
    setUserId(userIdValue)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userIdValue).maybeSingle()
    setForm((f) => ({
      ...f,
      customer_name: profile?.full_name || f.customer_name,
      customer_email: profile?.email || email || f.customer_email,
      customer_phone: profile?.phone || f.customer_phone,
      shipping_street: profile?.street || f.shipping_street,
      shipping_number: profile?.number || f.shipping_number,
      shipping_complement: profile?.complement || f.shipping_complement,
      shipping_neighborhood: profile?.neighborhood || f.shipping_neighborhood,
      shipping_city: profile?.city || f.shipping_city,
      shipping_state: profile?.state || f.shipping_state,
      shipping_zip: profile?.zip_code || f.shipping_zip,
    }))
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await fillFromUser(user.id, user.email)
      setCheckingAuth(false)
    }
    load()
  }, [])

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const ensureProfile = async (
    id: string,
    data: { email: string; full_name: string; phone: string },
  ) => {
    await supabase.from('profiles').upsert({
      id,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
    })
  }

  const handleQuickAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)

    const email = form.customer_email.trim().toLowerCase()
    const phone = form.customer_phone.trim()
    const name = form.customer_name.trim()

    try {
      if (authMode === 'signup') {
        if (!name || !email || !phone || password.length < 6) {
          setAuthError('Preencha nome, email, WhatsApp e uma senha com pelo menos 6 caracteres.')
          setAuthLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, phone },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/checkout`,
          },
        })
        if (error) throw error

        let sessionUser = data.user
        if (!data.session) {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (loginError) {
            setAuthError(
              'Conta criada. Se pedir confirmação de email, confirme e entre pela aba “Já tenho conta”.',
            )
            setAuthMode('login')
            setAuthLoading(false)
            return
          }
          sessionUser = loginData.user
        }

        if (!sessionUser) throw new Error('Não foi possível iniciar a sessão.')

        await ensureProfile(sessionUser.id, { email, full_name: name, phone })
        await fillFromUser(sessionUser.id, email)
        toast.success('Conta pronta! Continue o checkout.')
      } else {
        if (!email || !password) {
          setAuthError('Informe email e senha.')
          setAuthLoading(false)
          return
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (!data.user) throw new Error('Falha ao entrar.')
        await fillFromUser(data.user.id, data.user.email)
        toast.success('Bem-vindo de volta!')
      }
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Não foi possível continuar.'
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('registered')) {
        setAuthError('Este email já tem conta. Use a aba “Já tenho conta”.')
        setAuthMode('login')
      } else {
        setAuthError(message)
      }
    } finally {
      setAuthLoading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || items.length === 0) return
    setLoading(true)

    const orderPayload = {
      user_id: userId,
      status: 'pending',
      total_price: subtotal,
      customer_name: form.customer_name,
      customer_email: form.customer_email,
      customer_phone: form.customer_phone,
      shipping_street: form.shipping_street,
      shipping_number: form.shipping_number,
      shipping_complement: form.shipping_complement || null,
      shipping_neighborhood: form.shipping_neighborhood,
      shipping_city: form.shipping_city,
      shipping_state: form.shipping_state,
      shipping_zip: form.shipping_zip,
      payment_method: form.payment_method,
      payment_status: 'pending',
      notes: form.notes || null,
      order_number: `AB-${Date.now().toString().slice(-8)}`,
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('*')
      .single()

    if (error || !order) {
      setLoading(false)
      console.error(error)
      if (error?.message?.includes('column') || error?.code === 'PGRST204') {
        toast.error('Banco desatualizado. Execute supabase/schema.sql no Supabase.')
      } else {
        toast.error(error?.message || 'Não foi possível criar o pedido.')
      }
      return
    }

    const lines = items.map((i) => ({
      order_id: order.id,
      product_id: i.product.id,
      quantity: i.quantity,
      unit_price: cartUnitPrice(i),
      size: orderSizeLabel(i),
      product_name: i.isPair ? `${i.product.name} (Par)` : i.product.name,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(lines)
    setLoading(false)

    if (itemsError) {
      console.error(itemsError)
      toast.error('Pedido criado, mas itens falharam. Contate o suporte com o nº do pedido.')
      router.push(`/pedido/${order.id}`)
      return
    }

    await supabase.from('profiles').update({
      full_name: form.customer_name,
      phone: form.customer_phone,
      email: form.customer_email,
      street: form.shipping_street,
      number: form.shipping_number,
      complement: form.shipping_complement || null,
      neighborhood: form.shipping_neighborhood,
      city: form.shipping_city,
      state: form.shipping_state,
      zip_code: form.shipping_zip,
    }).eq('id', userId)

    clear()
    toast.success('Pedido realizado!')
    router.push(`/pedido/${order.id}`)
  }

  if (checkingAuth) return <p className="center-msg page-pad">Carregando checkout...</p>

  if (count === 0) {
    return (
      <div className="container page-pad center-msg">
        <p>Seu carrinho está vazio.</p>
        <Link href="/loja" className="btn">Ir à loja</Link>
      </div>
    )
  }

  // Etapa 1: conta rápida sem sair do checkout
  if (!userId) {
    return (
      <div className="container page-pad">
        <h1 className="page-title">Finalizar compra</h1>
        <div className="checkout-layout">
          <section className="checkout-auth-card">
            <p className="eyebrow">Quase lá</p>
            <h2>Para concluir, crie sua conta em 1 minuto</h2>
            <p className="muted">
              Assim você acompanha o pedido e fica com os dados salvos para a próxima compra.
              O carrinho continua aqui — sem ir para outra página.
            </p>

            <div className="checkout-auth-tabs">
              <button
                type="button"
                className={authMode === 'signup' ? 'is-active' : ''}
                onClick={() => { setAuthMode('signup'); setAuthError(null) }}
              >
                Criar conta
              </button>
              <button
                type="button"
                className={authMode === 'login' ? 'is-active' : ''}
                onClick={() => { setAuthMode('login'); setAuthError(null) }}
              >
                Já tenho conta
              </button>
            </div>

            <form className="checkout-auth-form" onSubmit={handleQuickAuth}>
              {authMode === 'signup' && (
                <>
                  <label>
                    Nome completo
                    <input
                      required
                      value={form.customer_name}
                      onChange={(e) => set('customer_name', e.target.value)}
                      placeholder="Como no documento"
                    />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      required
                      value={form.customer_phone}
                      onChange={(e) => set('customer_phone', e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                </>
              )}

              <label>
                Email
                <input
                  type="email"
                  required
                  value={form.customer_email}
                  onChange={(e) => set('customer_email', e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </label>

              <label>
                Senha
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={authMode === 'signup' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </label>

              {authError && <p className="auth-error" role="alert">{authError}</p>}

              <button type="submit" className="btn btn-block" disabled={authLoading}>
                {authLoading
                  ? 'Aguarde...'
                  : authMode === 'signup'
                    ? 'Criar conta e continuar'
                    : 'Entrar e continuar'}
              </button>
            </form>
          </section>

          <OrderSummary />
        </div>
      </div>
    )
  }

  // Etapa 2: entrega + pagamento (já autenticado)
  return (
    <div className="container page-pad">
      <h1 className="page-title">Checkout</h1>
      <p className="checkout-logged-as muted">
        Conta: <strong>{form.customer_email}</strong>
      </p>
      <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-form">
          <h2>Dados e entrega</h2>
          <div className="form-grid">
            <label>Nome completo<input required value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} /></label>
            <label>Email<input type="email" required value={form.customer_email} onChange={(e) => set('customer_email', e.target.value)} /></label>
            <label>Telefone / WhatsApp<input required value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} /></label>
            <label>CEP<input required value={form.shipping_zip} onChange={(e) => set('shipping_zip', e.target.value)} /></label>
            <label className="span-2">Rua<input required value={form.shipping_street} onChange={(e) => set('shipping_street', e.target.value)} /></label>
            <label>Número<input required value={form.shipping_number} onChange={(e) => set('shipping_number', e.target.value)} /></label>
            <label>Complemento<input value={form.shipping_complement} onChange={(e) => set('shipping_complement', e.target.value)} /></label>
            <label>Bairro<input required value={form.shipping_neighborhood} onChange={(e) => set('shipping_neighborhood', e.target.value)} /></label>
            <label>Cidade<input required value={form.shipping_city} onChange={(e) => set('shipping_city', e.target.value)} /></label>
            <label>Estado<input required maxLength={2} value={form.shipping_state} onChange={(e) => set('shipping_state', e.target.value.toUpperCase())} /></label>
          </div>

          <h2>Pagamento</h2>
          <div className="payment-options">
            <label className={form.payment_method === 'pix' ? 'is-active' : ''}>
              <input type="radio" name="pay" checked={form.payment_method === 'pix'} onChange={() => set('payment_method', 'pix')} />
              PIX
            </label>
            <label className={form.payment_method === 'transferencia' ? 'is-active' : ''}>
              <input type="radio" name="pay" checked={form.payment_method === 'transferencia'} onChange={() => set('payment_method', 'transferencia')} />
              Transferência
            </label>
          </div>
          <p className="muted">
            Após o pedido, você recebe as instruções de pagamento. Confirmamos o PIX/transferência
            e iniciamos o preparo da sua aliança ou solitário.
          </p>
          <label>Observações<textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} /></label>
        </div>

        <aside className="cart-summary">
          <h2>Pedido</h2>
          <ul className="checkout-items">
            {items.map((i) => (
              <li key={cartItemKey(i)}>
                <span>
                  {i.product.name}
                  {i.isPair ? ' (Par)' : ''} · {formatCartSize(i)} × {i.quantity}
                </span>
                <strong>{formatPrice(cartUnitPrice(i) * i.quantity)}</strong>
              </li>
            ))}
          </ul>
          <p className="summary-total"><span>Total</span><strong>{formatPrice(subtotal)}</strong></p>
          <button type="submit" className="btn btn-block" disabled={loading}>
            {loading ? 'Enviando...' : 'Confirmar pedido'}
          </button>
        </aside>
      </form>
    </div>
  )
}
