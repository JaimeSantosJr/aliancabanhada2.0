'use client'

import Header from '@/components/header'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type React from 'react'
import { useEffect, useState } from 'react'

interface Product {
  id: string
  name: string
  description: string
  price: number
  image_url: string
  category: string
}

export default function Home() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
        
        if (error) {
          console.error('Erro ao carregar produtos:', error)
        } else {
          setProducts(data || [])
        }
      } catch (err) {
        console.error('Erro:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  const scrollToCollection = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const collectionSection = document.getElementById('collection')
    if (collectionSection) {
      collectionSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const openSearch = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setIsSearchOpen(true)
  }

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchQuery('')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Pesquisando por:', searchQuery)
  }

  return (
    <>
      <Header />
      
      {isSearchOpen && (
        <div
          className="search-overlay"
          onClick={closeSearch}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 1000,
          }}
        >
          <div
            className="search-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '600px',
            }}
          >
            <button
              className="search-close"
              onClick={closeSearch}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '28px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
            <form onSubmit={handleSearchSubmit}>
              <input
                type="text"
                placeholder="Buscar alianças e solitários..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: 'none',
                  borderBottom: '1px solid #000',
                  outline: 'none',
                }}
                autoFocus
              />
            </form>
            <div className="search-suggestions" style={{ marginTop: '20px' }}>
              <p>Buscas populares:</p>
              <div
                className="search-tags"
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  marginTop: '10px',
                }}
              >
                <button onClick={() => setSearchQuery('alianças')} style={{ cursor: 'pointer' }}>
                  Alianças
                </button>
                <button onClick={() => setSearchQuery('solitários')} style={{ cursor: 'pointer' }}>
                  Solitários
                </button>
                <button onClick={() => setSearchQuery('ouro')} style={{ cursor: 'pointer' }}>
                  Ouro
                </button>
                <button onClick={() => setSearchQuery('diamantes')} style={{ cursor: 'pointer' }}>
                  Diamantes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="hero">
        <img
          src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=2070"
          alt="Alianças e Solitários"
          className="hero-img"
        />
        <div className="hero-content reveal">
          <p>Coleção Premium</p>
          <h1>Alianças Especiais</h1>
          <a href="#collection" className="btn" onClick={scrollToCollection}>
            Conheça a coleção
          </a>
        </div>
      </section>

      <div className="container" id="collection">
        <div className="section-title">
          <h2>Nossa Coleção</h2>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px' }}>Carregando produtos...</p>
        ) : products.length > 0 ? (
          <div className="product-grid">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-image-container">
                  <img
                    src={product.image_url || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=800'}
                    alt={product.name}
                  />
                </div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="product-price">R$ {parseFloat(product.price.toString()).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', padding: '40px' }}>
            Nenhum produto disponível no momento.
          </p>
        )}
      </div>

      <section className="story-section">
        <div className="container">
          <div className="feature-block">
            <div className="feature-image">
              <img
                src="https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1200"
                alt="Artesanato"
              />
            </div>
            <div className="feature-text">
              <h2>&quot;Alianças que eternizam momentos especiais.&quot;</h2>
              <p>
                Cada peça Aliança Banhada é cuidadosamente confeccionada com ouro banhado premium e
                diamantes selecionados. Acreditamos na arte de criar alianças que representam o amor
                eterno, onde cada detalhe é intencional e pensado para ser transmitido através das
                gerações.
              </p>
              <a
                href="#"
                className="btn"
                style={{ background: 'transparent', color: 'black', border: '1px solid black' }}
              >
                Nossa História
              </a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: '#fcfcfc', padding: '120px 0' }}>
        <div className="container">
          <div className="feature-block">
            <div className="feature-text">
              <h2 style={{ fontStyle: 'normal', textTransform: 'uppercase', fontSize: '28px' }}>
                Personalizadas
              </h2>
              <p>
                Colabore com nossos mestres artesãos para dar vida à sua visão única. Desde o primeiro
                esboço até o polimento final, garantimos que sua história pessoal seja gravada em cada
                detalhe de sua aliança personalizada.
              </p>
              <a href="#" className="btn">
                Solicite Agora
              </a>
            </div>
            <div className="feature-image">
              <img
                src="https://images.unsplash.com/photo-1512163143273-bde0e3cc7407?q=80&w=1200"
                alt="Processo de Design"
              />
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <h4>Sobre</h4>
              <p style={{ fontSize: '13px', color: '#777', lineHeight: '1.8' }}>
                Aliança Banhada é especializada em alianças e solitários banhados em ouro premium.
                Oferecemos qualidade, elegância e autenticidade para seus momentos mais especiais.
              </p>
            </div>
            <div className="footer-col">
              <h4>Atendimento</h4>
              <ul>
                <li>
                  <a href="#">Fale Conosco</a>
                </li>
                <li>
                  <a href="#">Entrega &amp; Devoluções</a>
                </li>
                <li>
                  <a href="#">Guia de Medidas</a>
                </li>
                <li>
                  <a href="#">Garantia</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Coleções</h4>
              <ul>
                <li>
                  <a href="#">Alianças</a>
                </li>
                <li>
                  <a href="#">Solitários</a>
                </li>
                <li>
                  <a href="#">Premium</a>
                </li>
                <li>
                  <a href="#">Personalizadas</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Newsletter</h4>
              <p
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '15px',
                  color: '#999',
                }}
              >
                Receba nossas novidades
              </p>
              <input type="email" placeholder="Seu Email" className="newsletter-input" />
              <a
                href="#"
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  color: 'black',
                  textDecoration: 'none',
                  borderBottom: '1px solid black',
                }}
              >
                Inscrever
              </a>
            </div>
          </div>
          <div className="footer-bottom">© 2025 ALIANÇA BANHADA. TODOS OS DIREITOS RESERVADOS.</div>
        </div>
      </footer>
    </>
  )
}
