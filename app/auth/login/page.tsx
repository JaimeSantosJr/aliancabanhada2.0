'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

const REMEMBER_KEY = 'alianca-banhada-remember-email'

function loginErrorMessage(error: unknown): string {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }
  if (code === 'email_not_confirmed') {
    return 'Confirme seu email antes de entrar.'
  }
  if (code === 'over_request_rate_limit' || status === 429) {
    return 'Muitas tentativas. Aguarde um momento.'
  }
  if (code === 'invalid_credentials') {
    return 'Email ou senha inválida.'
  }
  return 'Email ou senha inválida.'
}

async function rateLimit(action: string, email: string) {
  try {
    const res = await fetch('/api/auth/rate-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, email }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok && data.allowed !== false, error: data.error as string | undefined }
  } catch {
    return { ok: true }
  }
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      if (saved) {
        setEmail(saved)
        setRemember(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    const normalizedEmail = email.trim().toLowerCase()

    try {
      const gate = await rateLimit('login_check', normalizedEmail)
      if (!gate.ok) {
        setError(gate.error || 'Muitas tentativas. Aguarde um momento.')
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error) {
        await rateLimit('login_fail', normalizedEmail)
        throw error
      }

      await rateLimit('login_success', normalizedEmail)

      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, normalizedEmail)
        else localStorage.removeItem(REMEMBER_KEY)
      } catch {
        /* ignore */
      }

      const userId = data.user?.id
      let destination = next || '/'

      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', userId)
          .maybeSingle()

        if (profile?.is_admin && (!next || next === '/' || next === '/conta')) {
          destination = '/admin'
        }
      }

      router.push(destination)
      router.refresh()
    } catch (error: unknown) {
      setError(loginErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <p className="auth-eyebrow">Aliança Banhada</p>
        <h1>Entrar</h1>
        <p className="auth-lead">Acesse pedidos, medidas e o acompanhamento das suas peças.</p>

        <form onSubmit={handleLogin} className="auth-form">
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

          <label>
            <span className="auth-label-row">
              Senha
              <Link href="/auth/forgot-password" className="auth-help">
                Esqueci a senha
              </Link>
            </span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Sua senha"
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

          <div className="auth-row">
            <label className="remember-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Lembrar meu email
            </label>
            <Link href="/contato" className="auth-help">
              Precisa de ajuda?
            </Link>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-block" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="auth-footer">
          Não tem conta? <Link href="/auth/sign-up">Cadastre-se</Link>
        </p>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<p className="center-msg page-pad">Carregando...</p>}>
      <LoginForm />
    </Suspense>
  )
}
