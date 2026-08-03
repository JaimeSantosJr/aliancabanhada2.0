'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { toast } from 'sonner'

export default function ContatoPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Dúvida sobre alianças/solitários',
    message: '',
  })
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('contact_messages').insert(form)
    setLoading(false)
    if (error) {
      toast.error(
        error.code === '42P01' || error.message.includes('contact_messages')
          ? 'Execute o schema SQL no Supabase para ativar o contato.'
          : error.message,
      )
      return
    }
    toast.success('Mensagem enviada! Retornaremos em breve.')
    setForm({ name: '', email: '', phone: '', subject: 'Dúvida sobre alianças/solitários', message: '' })
  }

  return (
    <div className="container page-pad">
      <div className="section-title">
        <h2>Contato</h2>
        <p className="section-sub">Dúvidas sobre alianças, solitários, tamanhos e pedidos personalizados.</p>
      </div>

      <div className="contact-layout">
        <form className="contact-form" onSubmit={submit}>
          <label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Telefone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Assunto<input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label>Mensagem<textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
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
          <p>Seg–Sex, 9h–18h · WhatsApp comercial (defina no painel / atendimento)</p>
        </aside>
      </div>
    </div>
  )
}
