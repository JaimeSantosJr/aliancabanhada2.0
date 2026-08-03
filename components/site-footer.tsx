'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useState } from 'react'

export function SiteFooter() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: email.trim().toLowerCase() })
    setLoading(false)
    if (error) {
      if (error.code === '23505') setMsg('Este email já está inscrito.')
      else if (error.message?.includes('newsletter') || error.code === '42P01') {
        setMsg('Newsletter ainda não configurada no banco. Rode o schema SQL.')
      } else setMsg('Não foi possível inscrever. Tente novamente.')
      return
    }
    setEmail('')
    setMsg('Inscrito! Você receberá novidades de alianças e solitários.')
  }

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <h4>Sobre</h4>
            <p>
              Especialistas em alianças e solitários — banho de ouro premium ou ouro —
              para eternizar o seu momento.
            </p>
          </div>
          <div className="footer-col">
            <h4>Atendimento</h4>
            <ul>
              <li><Link href="/contato">Fale conosco</Link></li>
              <li><Link href="/contato#medidas">Guia de medidas</Link></li>
              <li><Link href="/loja">Entrega &amp; devoluções</Link></li>
              <li><Link href="/personalizadas">Peças sob medida</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Coleções</h4>
            <ul>
              <li><Link href="/loja?categoria=alianca">Alianças</Link></li>
              <li><Link href="/loja?categoria=solitario">Solitários</Link></li>
              <li><Link href="/loja?material=Ouro+banhado">Banho de ouro</Link></li>
              <li><Link href="/loja?material=Ouro">Ouro</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Newsletter</h4>
            <p className="newsletter-label">Receba lançamentos e ofertas</p>
            <form onSubmit={subscribe} className="newsletter-form">
              <input
                type="email"
                required
                placeholder="Seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="newsletter-input"
              />
              <button type="submit" className="newsletter-submit" disabled={loading}>
                {loading ? '...' : 'Inscrever'}
              </button>
            </form>
            {msg && <p className="newsletter-msg">{msg}</p>}
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} Aliança Banhada. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}
