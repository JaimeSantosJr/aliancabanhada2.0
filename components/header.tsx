'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    checkUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
    router.refresh()
  }

  const openSearch = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setIsSearchOpen(true)
  }

  return (
    <>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '30px 40px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: 'white',
        }}
      >
        <nav>
          <ul style={{ display: 'flex', gap: '40px', listStyle: 'none', margin: 0, padding: 0 }}>
            <li>
              <a href="#" style={{ textDecoration: 'none', color: 'black', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'var(--sans)' }}>
                Loja
              </a>
            </li>
            <li>
              <a href="#" style={{ textDecoration: 'none', color: 'black', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'var(--sans)' }}>
                Coleções
              </a>
            </li>
            <li>
              <a href="#" style={{ textDecoration: 'none', color: 'black', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'var(--sans)' }}>
                Contato
              </a>
            </li>
          </ul>
        </nav>

        <a href="/" style={{ textDecoration: 'none', color: 'black', fontSize: '28px', fontWeight: '400', margin: '0 auto', fontFamily: 'var(--serif)', letterSpacing: '8px', textTransform: 'uppercase' }}>
          Aliança Banhada
        </a>

        <div
          style={{
            display: 'flex',
            gap: '25px',
            alignItems: 'center',
            fontSize: '14px',
          }}
        >
          <a
            href="#"
            style={{ textDecoration: 'none', color: 'black' }}
            onClick={openSearch}
          >
            Buscar
          </a>
          {!loading && (
            <>
              {user ? (
                <>
                  <a
                    href="#"
                    style={{ textDecoration: 'none', color: 'black' }}
                    onClick={() => router.push('/protected')}
                  >
                    Conta
                  </a>
                  <a
                    href="#"
                    style={{ textDecoration: 'none', color: 'black' }}
                    onClick={(e) => {
                      e.preventDefault()
                      handleLogout()
                    }}
                  >
                    Sair
                  </a>
                </>
              ) : (
                <>
                  <a
                    href="/auth/login"
                    style={{ textDecoration: 'none', color: 'black' }}
                  >
                    Conta
                  </a>
                </>
              )}
            </>
          )}
          <a href="#" style={{ textDecoration: 'none', color: 'black' }}>
            Carrinho (0)
          </a>
        </div>
      </header>

      {isSearchOpen && (
        <div
          onClick={() => setIsSearchOpen(false)}
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
              onClick={() => setIsSearchOpen(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
            <form onSubmit={(e) => { e.preventDefault() }}>
              <input
                type="text"
                placeholder="Buscar alianças e solitários..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </form>
            <div style={{ marginTop: '20px' }}>
              <p style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Buscas populares:</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                <button style={{ background: 'none', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Alianças</button>
                <button style={{ background: 'none', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Solitários</button>
                <button style={{ background: 'none', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Ouro</button>
                <button style={{ background: 'none', border: '1px solid #ddd', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Diamantes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
