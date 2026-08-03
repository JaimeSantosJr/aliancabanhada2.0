import Link from 'next/link'

export default function SetupPage() {
  return (
    <div className="container page-pad">
      <div className="setup-box">
        <h1 className="page-title">Configuração do banco</h1>
        <p>
          Para checkout, pedidos, newsletter, contato, personalizadas e admin funcionarem,
          execute o SQL no painel do Supabase.
        </p>
        <ol style={{ lineHeight: 1.9, paddingLeft: 20, margin: '20px 0' }}>
          <li>
            Abra{' '}
            <a href="https://supabase.com/dashboard/project/lcbbsmgmdhxqsnwtlghu/sql/new" target="_blank" rel="noreferrer">
              SQL Editor do projeto
            </a>
          </li>
          <li>Se ainda não rodou, cole <code>supabase/schema.sql</code> e execute</li>
          <li>
            Cole e execute <code>supabase/create-admin.sql</code> (já deve estar na área de transferência)
            para confirmar o admin <strong>jaimegsantosj@gmail.com</strong>
          </li>
          <li>
            Entre em <Link href="/auth/login">/auth/login</Link> com a senha provisória{' '}
            <strong>190106</strong>
          </li>
          <li>
            Troque a senha em <Link href="/conta">Minha conta → Trocar senha</Link>
          </li>
        </ol>
        <p className="muted">
          Sem o create-admin.sql o login fica bloqueado por “email não confirmado”.
        </p>
        <Link href="/loja" className="btn">Ir à loja</Link>
      </div>
    </div>
  )
}
