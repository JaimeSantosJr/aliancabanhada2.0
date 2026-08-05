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
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/conta`,
    })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setDone(true)
  }

  return (
    <div className="container page-pad" style={{ maxWidth: 480 }}>
      <h1 className="page-title">Esqueci a senha</h1>
      {done ? (
        <p>
          Se existir conta com esse email, enviamos um link para redefinir a senha.
          Confira a caixa de entrada e o spam.
        </p>
      ) : (
        <form onSubmit={submit} className="custom-form">
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-block" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>
      )}
      <p style={{ marginTop: 24 }}>
        <Link href="/auth/login">Voltar ao login</Link>
      </p>
    </div>
  )
}
