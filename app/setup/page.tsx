import Link from 'next/link'

/** Página de setup removida por segurança. Use os scripts SQL no Supabase. */
export default function SetupPage() {
  return (
    <div className="container page-pad">
      <div className="setup-box">
        <h1 className="page-title">Configuração</h1>
        <p>
          Esta página pública foi desativada. Execute os arquivos SQL no painel do Supabase, nesta ordem:
        </p>
        <ul style={{ lineHeight: 1.9, paddingLeft: 20, margin: '20px 0' }}>
          <li><code>supabase/schema.sql</code></li>
          <li><code>supabase/hardening.sql</code></li>
          <li><code>supabase/commerce-integrations.sql</code></li>
          <li><code>supabase/security.sql</code></li>
          <li><code>supabase/fiscal.sql</code></li>
          <li><code>supabase/create-admin.sql</code> (somente no SQL Editor, nunca em página pública)</li>
        </ul>
        <Link href="/" className="btn">Voltar à loja</Link>
      </div>
    </div>
  )
}
