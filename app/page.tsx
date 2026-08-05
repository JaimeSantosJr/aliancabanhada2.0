'use client'

import { BrandHero } from '@/components/brand-hero'
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
        .eq('category', 'alianca')
        .order('created_at', { ascending: false })
        .limit(9)
      setProducts((data as Product[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const tileAliancas = '/products/alianca-par-jateada.png'
  const tileBanho = '/products/alianca-canal-escovada.png'
  const tileOuro = '/products/alianca-escovada-chanfrada.png'
  const storyImg = '/products/alianca-meio-brilho-glitter.png'
  const customImg = '/products/alianca-batimentos.png'

  return (
    <>
      <BrandHero />

      <div className="container category-strip">
        <Link href="/loja?categoria=alianca" className="category-tile">
          <img src={tileAliancas} alt="Alianças" />
          <span>Alianças</span>
        </Link>
        <Link href="/loja?material=Ouro+banhado" className="category-tile">
          <img src={tileBanho} alt="Banho de ouro" />
          <span>Banho de ouro</span>
        </Link>
        <Link href="/loja?material=Ouro" className="category-tile">
          <img src={tileOuro} alt="Ouro" />
          <span>Ouro</span>
        </Link>
        <Link href="/personalizadas" className="category-tile">
          <img src={customImg} alt="Personalizadas" />
          <span>Personalizadas</span>
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
              <img src={storyImg} alt="Oficina de alianças" />
            </div>
            <div className="feature-text">
              <h2>&quot;Alianças que eternizam o sim.&quot;</h2>
              <p>
                Trabalhamos alianças em banho de ouro premium ou ouro, com acabamento
                cuidadoso e tamanhos precisos para o dia a dia e a cerimônia.
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
                criar a aliança do seu jeito.
              </p>
              <Link href="/personalizadas" className="btn">
                Solicitar agora
              </Link>
            </div>
            <div className="feature-image">
              <img src={customImg} alt="Aliança personalizada" />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
