'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/forgot-password')
        return
      }
      setReady(true)
    }
    check()
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Use uma senha com pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('A confirmação não confere com a nova senha.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError('Não foi possível salvar a nova senha. Peça um novo link se este expirou.')
      return
    }

    setDone(true)
    setTimeout(() => router.push('/conta'), 1500)
  }

  if (!ready && !done) {
    return <p className="center-msg page-pad">Validando link...</p>
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <p className="auth-eyebrow">Aliança Banhada</p>
        <h1>Nova senha</h1>
        <p className="auth-lead">
          {done
            ? 'Senha atualizada. Redirecionando...'
            : 'Defina uma senha nova para acessar sua conta com segurança.'}
        </p>

        {!done && (
          <form onSubmit={submit} className="auth-form">
            <label>
              Nova senha
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
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
              Confirmar senha
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Repita a senha"
              />
            </label>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button type="submit" className="btn btn-block" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
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
