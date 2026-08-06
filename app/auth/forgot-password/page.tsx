'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const normalized = email.trim().toLowerCase()

    try {
      const gateRes = await fetch('/api/auth/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_check', email: normalized }),
      })
      const gate = await gateRes.json().catch(() => ({}))
      if (!gateRes.ok || gate.allowed === false) {
        setError(gate.error || 'Muitas solicitações. Aguarde um pouco.')
        setLoading(false)
        return
      }

      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      })

      await fetch('/api/auth/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_consume', email: normalized }),
      })

      // Sempre mensagem genérica (não revela se o email existe)
      setDone(true)
    } catch {
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <p className="auth-eyebrow">Aliança Banhada</p>
        <h1>Esqueci a senha</h1>
        <p className="auth-lead">
          Enviamos um link seguro para redefinir a senha, se houver conta com esse email.
        </p>

        {done ? (
          <p>
            Se existir conta com esse email, enviamos um link. Confira a caixa de entrada e o spam.
            O link expira em pouco tempo.
          </p>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="seu@email.com"
              />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-block" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        )}

        <p className="auth-footer">
          <Link href="/auth/login">Voltar ao login</Link>
        </p>
      </div>
    </div>
  )
}
