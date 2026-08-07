'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function signUpErrorMessage(error: unknown): string {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }
  if (code === 'weak_password') return 'Escolha uma senha mais forte.'
  if (code === 'email_address_invalid') return 'Use um email real.'
  if (code === 'email_address_not_authorized') {
    return 'Nao podemos enviar confirmacao para esse endereco. Use outro email.'
  }
  if (code === 'validation_failed') return 'Verifique os dados digitados.'
  if (code === 'over_email_send_rate_limit' || status === 429) {
    return 'Muitas tentativas. Aguarde um momento.'
  }
  return 'Nao foi possivel completar o cadastro. Tente novamente.'
}

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError('As senhas nao coincidem.')
      setIsLoading(false)
      return
    }
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      setIsLoading(false)
      return
    }

    try {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
        },
      })
      if (err) throw err
      router.push('/auth/sign-up-success')
    } catch (err: unknown) {
      setError(signUpErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <p className="auth-eyebrow">Alianca Banhada</p>
        <h1>Criar conta</h1>
        <p className="auth-lead">Acompanhe pedidos e salve seus dados de entrega.</p>

        <form onSubmit={handleSignUp} className="auth-form">
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
            Senha
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Minimo 8 caracteres"
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
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Repita a senha"
            />
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-block" disabled={isLoading}>
            {isLoading ? 'Criando conta...' : 'Cadastrar'}
          </button>
        </form>

        <p className="auth-footer">
          Ja tem conta? <Link href="/auth/login">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
