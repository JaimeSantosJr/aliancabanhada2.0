'use client'

import { createClient } from '@/lib/supabase/client'
import { STORE } from '@/lib/store-config'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

export default function ContatoPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Duvida sobre aliancas',
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
    setForm({
      name: '',
      email: '',
      phone: '',
      subject: 'Duvida sobre aliancas',
      message: '',
      website: '',
    })
  }

  return (
    <div className="service-page">
      <div className="container">
        <section className="service-hero">
          <p className="eyebrow">Fale conosco</p>
          <h1>Contato</h1>
          <p>Duvidas sobre aliancas, tamanhos, pedidos e personalizacao.</p>
        </section>

        <div className="service-shell contact-layout">
          <form className="service-panel contact-form" onSubmit={submit}>
            <div className="panel-intro">
              <h2>Enviar mensagem</h2>
              <p>Respondemos em horario comercial, normalmente no mesmo dia util.</p>
            </div>
            <div className="form-grid">
              <label>
                Nome
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                />
              </label>
              <label>
                WhatsApp
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                />
              </label>
              <label>
                Assunto
                <input
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </label>
              <label className="span-2">
                Mensagem
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </label>
            </div>
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hp-field"
            />
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </form>

          <aside className="service-aside" id="medidas">
            <h3>Guia rapido de medidas</h3>
            <p>
              Use um anel que sirva bem e meça o diametro interno em milimetros, ou meça o contorno
              do dedo com uma fita e consulte a tabela de numeros brasileiros (geralmente 10–30).
            </p>
            <p>Na duvida, escolha um tamanho intermediario e fale conosco antes de gravar a peça.</p>
            <h3>Horario</h3>
            <p>Seg–Sex, 9h–18h</p>
            <h3>Pagamento</h3>
            <p>PIX e cartao via Mercado Pago. 1 ano de garantia nas peças.</p>
            <h3>Loja</h3>
            <p>
              <Link href="/loja">Ver colecao</Link>
              {' · '}
              <Link href="/personalizadas">Personalizadas</Link>
            </p>
            <p className="muted">{STORE.name}</p>
          </aside>
        </div>
      </div>
    </div>
  )
}
