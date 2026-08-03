'use client'

import { ProductCard } from '@/components/product-card'
import type { Product } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('in_stock', true)
        .order('created_at', { ascending: false })
        .limit(6)
      setProducts((data as Product[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      <section className="hero">
        <img
          src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=2070"
          alt="Alianças e solitários Aliança Banhada"
          className="hero-img"
        />
        <div className="hero-content reveal">
          <p>Alianças &amp; Solitários</p>
          <h1>Aliança Banhada</h1>
          <p className="hero-sub">Banho de ouro ou ouro — para o sim que permanece.</p>
          <Link href="/loja" className="btn">
            Ver coleção
          </Link>
        </div>
      </section>

      <div className="container category-strip">
        <Link href="/loja?categoria=alianca" className="category-tile">
          <img src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=900" alt="Alianças" />
          <span>Alianças</span>
        </Link>
        <Link href="/loja?categoria=solitario" className="category-tile">
          <img src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=900" alt="Solitários" />
          <span>Solitários</span>
        </Link>
        <Link href="/loja?material=Ouro+banhado" className="category-tile">
          <img src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=900" alt="Banho de ouro" />
          <span>Banho de ouro</span>
        </Link>
        <Link href="/loja?material=Ouro" className="category-tile">
          <img src="https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=900" alt="Ouro" />
          <span>Ouro</span>
        </Link>
      </div>

      <div className="container" id="collection">
        <div className="section-title">
          <h2>Destaques</h2>
        </div>
        {loading ? (
          <p className="center-msg">Carregando peças...</p>
        ) : products.length > 0 ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="center-msg">Nenhuma peça disponível no momento.</p>
        )}
        <div className="center-cta">
          <Link href="/loja" className="btn">
            Ver toda a loja
          </Link>
        </div>
      </div>

      <section className="story-section">
        <div className="container">
          <div className="feature-block">
            <div className="feature-image">
              <img
                src="https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1200"
                alt="Oficina de alianças"
              />
            </div>
            <div className="feature-text">
              <h2>&quot;Alianças que eternizam o sim.&quot;</h2>
              <p>
                Trabalhamos apenas alianças e solitários — em banho de ouro premium ou ouro —
                com acabamento cuidadoso e tamanhos precisos para o dia a dia e a cerimônia.
              </p>
              <Link href="/contato" className="btn btn-outline">
                Nossa história
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="personalizadas-teaser">
        <div className="container">
          <div className="feature-block">
            <div className="feature-text">
              <h2>Personalizadas</h2>
              <p>
                Grave iniciais, escolha o material e o tamanho. Contamos com artesãos para
                criar a aliança ou o solitário do seu jeito.
              </p>
              <Link href="/personalizadas" className="btn">
                Solicitar agora
              </Link>
            </div>
            <div className="feature-image">
              <img
                src="https://images.unsplash.com/photo-1512163143273-bde0e3cc7407?q=80&w=1200"
                alt="Aliança personalizada"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
