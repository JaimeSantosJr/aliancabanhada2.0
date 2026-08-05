'use client'

import { useCart } from '@/lib/cart'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SearchDialog } from './search-dialog'

export function SiteHeader() {
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { count } = useCart()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle()
        setIsAdmin(Boolean(data?.is_admin))
      } else {
        setIsAdmin(false)
      }
    }
    load()
  }, [pathname])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <header className="site-header">
        <button
          type="button"
          className="site-header-menu-btn"
          aria-label="Menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? 'Fechar' : 'Menu'}
        </button>

        <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`}>
          <ul>
            <li><Link href="/loja">Loja</Link></li>
            <li><Link href="/loja?categoria=alianca">Alianças</Link></li>
            <li><Link href="/personalizadas">Personalizadas</Link></li>
            <li><Link href="/contato">Contato</Link></li>
            {isAdmin && <li><Link href="/admin">Admin</Link></li>}
          </ul>
        </nav>

        <Link href="/" className="site-logo">
          Aliança Banhada
        </Link>

        <div className="site-header-actions">
          <button type="button" className="linkish" onClick={() => setSearchOpen(true)}>
            Buscar
          </button>
          {user ? (
            <>
              <Link href="/conta">Conta</Link>
              <button type="button" className="linkish" onClick={logout}>Sair</button>
            </>
          ) : (
            <Link href="/auth/login">Conta</Link>
          )}
          <Link href="/carrinho">Carrinho ({count})</Link>
        </div>
      </header>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
