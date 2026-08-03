import type React from 'react'
import type { Metadata } from 'next'
import { Playfair_Display, Montserrat } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from '@/lib/cart'
import { SiteShell } from '@/components/site-shell'
import { Toaster } from 'sonner'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Aliança Banhada — Alianças e Solitários',
  description:
    'Alianças e solitários em banho de ouro ou ouro. Peças para noivado e casamento com qualidade premium.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    title: 'Aliança Banhada',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${playfair.variable} ${montserrat.variable}`}>
        <CartProvider>
          <SiteShell>{children}</SiteShell>
          <Toaster position="top-center" richColors closeButton />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
