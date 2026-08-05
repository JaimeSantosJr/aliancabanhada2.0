import type React from 'react'
import type { Metadata } from 'next'
import { Cormorant_Garamond, Montserrat, Playfair_Display } from 'next/font/google'
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

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aliancabanhada.com.br',
  ),
  title: 'Aliança Banhada — Alianças',
  description:
    'Alianças em banho de ouro ou ouro. Peças para noivado e casamento com qualidade premium. 1 ano de garantia.',
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
  openGraph: {
    title: 'Aliança Banhada',
    description:
      'Alianças em banho de ouro ou ouro. Peças para noivado e casamento com qualidade premium.',
    url: 'https://www.aliancabanhada.com.br',
    siteName: 'Aliança Banhada',
    locale: 'pt_BR',
    type: 'website',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${playfair.variable} ${cormorant.variable} ${montserrat.variable}`}>
        <CartProvider>
          <SiteShell>{children}</SiteShell>
          <Toaster position="top-center" richColors closeButton />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
