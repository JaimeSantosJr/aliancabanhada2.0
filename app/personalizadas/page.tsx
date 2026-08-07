'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function PersonalizadasPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    product_type: 'alianca' as 'alianca' | 'solitario',
    material: 'Ouro banhado' as 'Ouro banhado' | 'Ouro',
    size: '',
    engraving: '',
    description: '',
    budget: '',
  })
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setForm((f) => ({ ...f, email: user.email || f.email }))
      }
    }
    load()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('custom_orders').insert({
      user_id: userId,
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      product_type: form.product_type,
      material: form.material,
      size: form.size || null,
      engraving: form.engraving || null,
      description: form.description,
      budget: form.budget ? Number(form.budget) : null,
    })
    setLoading(false)
    if (error) {
      toast.error(
        error.code === '42P01' || error.message.includes('custom_orders')
          ? 'Execute o schema SQL no Supabase para ativar pedidos personalizados.'
          : error.message,
      )
      return
    }
    toast.success('Solicitacao enviada! Entraremos em contato.')
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'custom', name: form.name, email: form.email }),
      })
    } catch {
      /* optional */
    }
    setForm((f) => ({
      ...f,
      phone: '',
      size: '',
      engraving: '',
      description: '',
      budget: '',
    }))
  }

  return (
    <div className="service-page">
      <div className="container">
        <section className="service-hero">
          <p className="eyebrow">Sob medida</p>
          <h1>Personalizadas</h1>
          <p>
            Alianca ou solitario sob consulta — banho de ouro ou ouro — com gravacao e medidas
            especiais.
          </p>
        </section>

        <div className="service-shell service-shell--single">
          <form className="service-panel custom-form" onSubmit={submit}>
            <div className="panel-intro">
              <h2>Solicitar orcamento</h2>
              <p>
                Conte o que deseja. Retornamos com prazo e valor.{' '}
                <Link href="/contato">Prefere so tirar duvida?</Link>
              </p>
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
                />
              </label>
              <label>
                Tipo
                <select
                  value={form.product_type}
                  onChange={(e) =>
                    setForm({ ...form, product_type: e.target.value as 'alianca' | 'solitario' })
                  }
                >
                  <option value="alianca">Alianca</option>
                  <option value="solitario">Solitario</option>
                </select>
              </label>
              <label>
                Material
                <select
                  value={form.material}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      material: e.target.value as 'Ouro banhado' | 'Ouro',
                    })
                  }
                >
                  <option value="Ouro banhado">Banho de ouro</option>
                  <option value="Ouro">Ouro</option>
                </select>
              </label>
              <label>
                Tamanho desejado
                <input
                  value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  placeholder="Ex: 16"
                />
              </label>
              <label>
                Gravacao
                <input
                  value={form.engraving}
                  onChange={(e) => setForm({ ...form, engraving: e.target.value })}
                  placeholder="Iniciais, data..."
                />
              </label>
              <label>
                Orcamento estimado (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                />
              </label>
              <label className="span-2">
                Descreva o que deseja
                <textarea
                  required
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Enviando...' : 'Solicitar orcamento'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
