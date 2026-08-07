'use client'

import { useEffect, useState, createContext, useContext } from 'react'

type Theme = 'dark' | 'light'

type AdminThemeCtx = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const Ctx = createContext<AdminThemeCtx>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
})

export function useAdminTheme() {
  return useContext(Ctx)
}

const KEY = 'ab-admin-theme'

export function AdminRoot({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') setThemeState(saved)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(KEY, theme)
  }, [theme, ready])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <Ctx.Provider value={{ theme, toggleTheme, setTheme }}>
      <div className="admin-root" data-theme={theme}>
        {children}
      </div>
    </Ctx.Provider>
  )
}
