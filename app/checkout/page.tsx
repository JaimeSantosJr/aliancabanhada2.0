'use client'

import { useCart } from '@/lib/cart'
import { formatPrice } from '@/lib/format'
import { STORE } from '@/lib/store-config'
import { cartItemKey, cartUnitPrice, formatCartSize } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { fetchAddressByCep, formatCep } from '@/lib/viacep'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
  payment_method: 'mercadopago' | 'pix' | 'transferencia'
  notes: string
  website: string
}

type AuthMode = 'signup' | 'login'

type QuoteOption = {
  id: string
  name: string
  company: string
  price: number
  deliveryDays: number
}

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
  payment_method: 'mercadopago',
  notes: '',
  website: '',
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
  const [cepLoading, setCepLoading] = useState(false)
  const [quotes, setQuotes] = useState<QuoteOption[]>([])
  const [quoteSource, setQuoteSource] = useState<string>('')
  const [quoteNote, setQuoteNote] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [selectedShippingId, setSelectedShippingId] = useState<string>('')
  const [couponInput, setCouponInput] = useState('')
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [discount, setDiscount] = useState(0)
  const [couponLoading, setCouponLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const selectedShipping = useMemo(
    () => quotes.find((q) => q.id === selectedShippingId) || null,
    [quotes, selectedShippingId],
  )
  const shippingCost = selectedShipping?.price ?? 0
  const total = Math.max(0, subtotal - discount) + shippingCost

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

  const loadQuotes = async (cepRaw: string) => {
    const cep = cepRaw.replace(/\D/g, '')
    if (cep.length !== 8) return
    setQuoteLoading(true)
    setQuoteNote(null)
    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cep,
          insuranceValue: Math.max(0, subtotal - discount),
          quantity: items.reduce((s, i) => s + i.quantity, 0),
        }),
      })
      const data = await res.json()
      const options = (data.options || []) as QuoteOption[]
      setQuotes(options)
      setQuoteSource(data.source || '')
      setQuoteNote(data.error || null)
      if (options.length) {
        setSelectedShippingId((prev) =>
          options.some((o) => o.id === prev) ? prev : options[0].id,
        )
      } else {
        setSelectedShippingId('')
      }
    } catch {
      setQuotes([])
      setQuoteNote('Não foi possível cotar o frete agora.')
    } finally {
      setQuoteLoading(false)
    }
  }

  useEffect(() => {
    const cep = form.shipping_zip.replace(/\D/g, '')
    if (cep.length === 8 && userId) {
      loadQuotes(cep)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, discount, userId])

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const onCepBlur = async () => {
    const cep = form.shipping_zip.replace(/\D/g, '')
    if (cep.length !== 8) return
    setCepLoading(true)
    const data = await fetchAddressByCep(cep)
    setCepLoading(false)
    if (!data) {
      toast.error('CEP não encontrado.')
      return
    }
    setForm((f) => ({
      ...f,
      shipping_street: data.logradouro || f.shipping_street,
      shipping_neighborhood: data.bairro || f.shipping_neighborhood,
      shipping_city: data.localidade || f.shipping_city,
      shipping_state: data.uf || f.shipping_state,
      shipping_zip: formatCep(data.cep),
    }))
    await loadQuotes(cep)
  }

  const applyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponLoading(true)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput, subtotal }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCouponCode(null)
        setDiscount(0)
        toast.error(data.error || 'Cupom inválido.')
        return
      }
      setCouponCode(data.code)
      setDiscount(Number(data.discount || 0))
      toast.success(`Cupom ${data.code} aplicado.`)
    } catch {
      toast.error('Não foi possível validar o cupom.')
    } finally {
      setCouponLoading(false)
    }
  }

  const clearCoupon = () => {
    setCouponInput('')
    setCouponCode(null)
    setDiscount(0)
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
    if (form.website) return
    if (!selectedShippingId) {
      toast.error('Selecione uma opção de frete.')
      return
    }
    setLoading(true)

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        shipping_street: form.shipping_street,
        shipping_number: form.shipping_number,
        shipping_complement: form.shipping_complement,
        shipping_neighborhood: form.shipping_neighborhood,
        shipping_city: form.shipping_city,
        shipping_state: form.shipping_state,
        shipping_zip: form.shipping_zip,
        payment_method: form.payment_method,
        notes: form.notes,
        coupon_code: couponCode || undefined,
        shipping_service_id: selectedShippingId,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          size: i.size,
          size2: i.size2,
          isPair: i.isPair,
        })),
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error || 'Não foi possível criar o pedido.')
      return
    }

    clear()
    toast.success(
      form.payment_method === 'mercadopago'
        ? 'Pedido criado! Finalize o pagamento abaixo.'
        : 'Pedido realizado!',
    )
    router.push(`/pedido/${data.id}`)
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
                    />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      required
                      value={form.customer_phone}
                      onChange={(e) => set('customer_phone', e.target.value)}
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
              <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                <Link href="/auth/forgot-password">Esqueci a senha</Link>
              </p>
            </form>
          </section>

          <aside className="cart-summary">
            <h2>Pedido</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              Frete calculado no checkout após informar o CEP.
            </p>
            <p className="summary-total"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></p>
          </aside>
        </div>
      </div>
    )
  }

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
            <label>
              CEP {cepLoading || quoteLoading ? '(buscando...)' : ''}
              <input
                required
                value={form.shipping_zip}
                onChange={(e) => set('shipping_zip', formatCep(e.target.value))}
                onBlur={onCepBlur}
                inputMode="numeric"
              />
            </label>
            <label className="span-2">Rua<input required value={form.shipping_street} onChange={(e) => set('shipping_street', e.target.value)} /></label>
            <label>Número<input required value={form.shipping_number} onChange={(e) => set('shipping_number', e.target.value)} /></label>
            <label>Complemento<input value={form.shipping_complement} onChange={(e) => set('shipping_complement', e.target.value)} /></label>
            <label>Bairro<input required value={form.shipping_neighborhood} onChange={(e) => set('shipping_neighborhood', e.target.value)} /></label>
            <label>Cidade<input required value={form.shipping_city} onChange={(e) => set('shipping_city', e.target.value)} /></label>
            <label>Estado<input required maxLength={2} value={form.shipping_state} onChange={(e) => set('shipping_state', e.target.value.toUpperCase())} /></label>
          </div>

          <h2>Frete</h2>
          {quoteNote && <p className="muted" style={{ fontSize: 13 }}>{quoteNote}</p>}
          <div className="shipping-options">
            {quotes.map((q) => (
              <label key={q.id} className={selectedShippingId === q.id ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="shipping"
                  checked={selectedShippingId === q.id}
                  onChange={() => setSelectedShippingId(q.id)}
                />
                <span>
                  <strong>{q.company}</strong> · {q.name}
                  <small>
                    {q.deliveryDays} dias úteis
                    {quoteSource === 'fallback' ? ' · padrão' : ''}
                  </small>
                </span>
                <em>{formatPrice(q.price)}</em>
              </label>
            ))}
            {!quotes.length && !quoteLoading && (
              <p className="muted">Informe um CEP válido para ver as opções de frete.</p>
            )}
          </div>

          <input
            type="text"
            name="website"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0 }}
            aria-hidden="true"
          />

          <h2>Pagamento</h2>
          <div className="payment-options">
            <label className={form.payment_method === 'mercadopago' ? 'is-active' : ''}>
              <input
                type="radio"
                name="pay"
                checked={form.payment_method === 'mercadopago'}
                onChange={() => set('payment_method', 'mercadopago')}
              />
              Mercado Pago (PIX / cartão)
            </label>
            <label className={form.payment_method === 'pix' ? 'is-active' : ''}>
              <input
                type="radio"
                name="pay"
                checked={form.payment_method === 'pix'}
                onChange={() => set('payment_method', 'pix')}
              />
              PIX manual
            </label>
            <label className={form.payment_method === 'transferencia' ? 'is-active' : ''}>
              <input
                type="radio"
                name="pay"
                checked={form.payment_method === 'transferencia'}
                onChange={() => set('payment_method', 'transferencia')}
              />
              Transferência
            </label>
          </div>
          <p className="muted">
            Com Mercado Pago você paga com PIX ou cartão nesta loja (Checkout Transparente).
            Prazo estimado após confirmação: {selectedShipping?.deliveryDays || STORE.shippingDaysMax} dias úteis.
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

          <div className="coupon-row">
            <input
              placeholder="Cupom"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              disabled={Boolean(couponCode)}
            />
            {couponCode ? (
              <button type="button" className="btn btn-outline" onClick={clearCoupon}>
                Remover
              </button>
            ) : (
              <button type="button" className="btn btn-outline" onClick={applyCoupon} disabled={couponLoading}>
                {couponLoading ? '...' : 'Aplicar'}
              </button>
            )}
          </div>

          <div className="summary-rows" style={{ marginBottom: 12 }}>
            <p><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></p>
            {discount > 0 && (
              <p><span>Cupom {couponCode}</span><strong>− {formatPrice(discount)}</strong></p>
            )}
            <p>
              <span>Frete</span>
              <strong>
                {!selectedShipping
                  ? '—'
                  : shippingCost === 0
                    ? 'Grátis'
                    : formatPrice(shippingCost)}
              </strong>
            </p>
          </div>
          <p className="summary-total"><span>Total</span><strong>{formatPrice(total)}</strong></p>
          <button type="submit" className="btn btn-block" disabled={loading || !selectedShippingId}>
            {loading
              ? 'Enviando...'
              : form.payment_method === 'mercadopago'
                ? 'Criar pedido e pagar'
                : 'Confirmar pedido'}
          </button>
        </aside>
      </form>
    </div>
  )
}
