import Link from 'next/link'

export default function SignUpSuccessPage() {
  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <p className="auth-eyebrow">Alianca Banhada</p>
        <h1>Conta criada</h1>
        <p className="auth-lead">
          Verifique seu email para confirmar o cadastro antes de entrar. Confira tambem a caixa de
          spam.
        </p>
        <Link href="/auth/login" className="btn btn-block">
          Ir para o login
        </Link>
        <p className="auth-footer">
          <Link href="/loja">Continuar na loja</Link>
        </p>
      </div>
    </div>
  )
}
