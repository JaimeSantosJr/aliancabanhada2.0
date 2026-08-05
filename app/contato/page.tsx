'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { toast } from 'sonner'

export default function ContatoPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Dúvida sobre alianças',
    message: '',
    website: '',
  })
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.website) return
    setLoading(true)
    const supabase = createClient()
    const { website: _hp, ...payload } = form
    const { error } = await supabase.from('contact_messages').insert(payload)
    setLoading(false)
    if (error) {
      toast.error(
        error.code === '42P01' || error.message.includes('contact_messages')
          ? 'Execute o schema SQL no Supabase para ativar o contato.'
          : error.message,
      )
      return
    }
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          name: form.name,
          email: form.email,
          subject: form.subject,
        }),
      })
    } catch {
      /* optional */
    }
    toast.success('Mensagem enviada! Retornaremos em breve.')
    setForm({ name: '', email: '', phone: '', subject: 'Dúvida sobre alianças', message: '', website: '' })
  }

  return (
    <div className="container page-pad">
      <div className="section-title">
        <h2>Contato</h2>
        <p className="section-sub">Dúvidas sobre alianças, tamanhos e pedidos personalizados.</p>
      </div>

      <div className="contact-layout">
        <form className="contact-form" onSubmit={submit}>
          <label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Telefone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Assunto<input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label>Mensagem<textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
          />
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Enviando...' : 'Enviar'}</button>
        </form>

        <aside className="contact-aside" id="medidas">
          <h3>Guia rápido de medidas</h3>
          <p>
            Use um anel que sirva bem e meça o diâmetro interno em milímetros, ou meça o
            contorno do dedo com uma fita e consulte a tabela de números brasileiros (geralmente 10–30).
          </p>
          <p>
            Na dúvida, escolha um tamanho intermediário e fale conosco antes de gravar a peça.
          </p>
          <h3>Horário</h3>
          <p>Seg–Sex, 9h–18h</p>
          <h3>Pagamento</h3>
          <p>PIX e transferência. 1 ano de garantia nas peças.</p>
        </aside>
      </div>
    </div>
  )
}
