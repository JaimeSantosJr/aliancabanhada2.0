'use client'

import { formatPrice } from '@/lib/format'
import { ORDER_STATUS_LABELS } from '@/lib/types'
import type { Order, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function ContaPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [section, setSection] = useState<'dados' | 'senha' | 'pedidos'>('dados')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login?next=/conta')
        return
      }

      let { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      phone: profile.phone,
      street: profile.street,
      number: profile.number,
      complement: profile.complement,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      zip_code: profile.zip_code,
    }).eq('id', profile.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Dados salvos')
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.email) return
    if (newPassword.length < 6) {
      toast.error('A nova senha precisa ter pelo menos 6 caracteres.')
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

  if (loading) return <p className="center-msg page-pad">Carregando conta...</p>
  if (!profile) return null

  const initials = (profile.full_name || profile.email || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className="account-page">
      <div className="container">
        <header className="account-hero">
          <div className="account-avatar" aria-hidden>{initials || 'AB'}</div>
          <div>
            <p className="eyebrow">Área do cliente</p>
            <h1>{profile.full_name || 'Sua conta'}</h1>
            <p>{profile.email}</p>
          </div>
          <div className="account-hero-actions">
            {profile.is_admin && <Link href="/admin" className="btn">Painel admin</Link>}
            <Link href="/loja" className="btn btn-outline">Continuar comprando</Link>
          </div>
        </header>

        <div className="account-shell">
          <nav className="account-nav">
            <button type="button" className={section === 'dados' ? 'is-active' : ''} onClick={() => setSection('dados')}>
              Dados e entrega
            </button>
            <button type="button" className={section === 'pedidos' ? 'is-active' : ''} onClick={() => setSection('pedidos')}>
              Pedidos ({orders.length})
            </button>
            <button type="button" className={section === 'senha' ? 'is-active' : ''} onClick={() => setSection('senha')}>
              Trocar senha
            </button>
          </nav>

          <div className="account-panel">
            {section === 'dados' && (
              <form onSubmit={save} className="account-form-v2">
                <div className="panel-intro">
                  <h2>Dados pessoais</h2>
                  <p>Usados no checkout e no envio das suas alianças e solitários.</p>
                </div>
                <div className="form-grid">
                  <label>Nome completo<input value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></label>
                  <label>Email<input value={profile.email || ''} disabled /></label>
                  <label>Telefone / WhatsApp<input value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
                  <label>CEP<input value={profile.zip_code || ''} onChange={(e) => setProfile({ ...profile, zip_code: e.target.value })} /></label>
                  <label className="span-2">Rua<input value={profile.street || ''} onChange={(e) => setProfile({ ...profile, street: e.target.value })} /></label>
                  <label>Número<input value={profile.number || ''} onChange={(e) => setProfile({ ...profile, number: e.target.value })} /></label>
                  <label>Complemento<input value={profile.complement || ''} onChange={(e) => setProfile({ ...profile, complement: e.target.value })} /></label>
                  <label>Bairro<input value={profile.neighborhood || ''} onChange={(e) => setProfile({ ...profile, neighborhood: e.target.value })} /></label>
                  <label>Cidade<input value={profile.city || ''} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></label>
                  <label>Estado<input maxLength={2} value={profile.state || ''} onChange={(e) => setProfile({ ...profile, state: e.target.value.toUpperCase() })} /></label>
                </div>
                <button type="submit" className="btn" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button>
              </form>
            )}

            {section === 'senha' && (
              <form onSubmit={changePassword} className="account-form-v2">
                <div className="panel-intro">
                  <h2>Trocar senha</h2>
                  <p>Recomendado após o primeiro acesso com a senha provisória.</p>
                </div>
                <div className="form-grid single">
                  <label>Senha atual<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
                  <label>Nova senha<input type="password" required minLength={6} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
                  <label>Confirmar nova senha<input type="password" required minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
                </div>
                <button type="submit" className="btn" disabled={changingPassword}>
                  {changingPassword ? 'Alterando...' : 'Alterar senha'}
                </button>
              </form>
            )}

            {section === 'pedidos' && (
              <div>
                <div className="panel-intro">
                  <h2>Seus pedidos</h2>
                  <p>Acompanhe pagamento, preparo e envio.</p>
                </div>
                {orders.length === 0 ? (
                  <div className="empty-state">
                    <p>Você ainda não fez pedidos.</p>
                    <Link href="/loja" className="btn">Ver coleção</Link>
                  </div>
                ) : (
                  <ul className="order-cards">
                    {orders.map((o) => (
                      <li key={o.id}>
                        <div>
                          <strong>{o.order_number || o.id.slice(0, 8)}</strong>
                          <span className="status-chip">{ORDER_STATUS_LABELS[o.status] || o.status}</span>
                        </div>
                        <p>{new Date(o.created_at).toLocaleDateString('pt-BR')} · {formatPrice(o.total_price)}</p>
                        <Link href={`/pedido/${o.id}`}>Ver detalhes</Link>
                      </li>
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
