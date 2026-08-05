import type { MetadataRoute } from 'next'

const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aliancabanhada.com.br'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const paths = ['', '/loja', '/personalizadas', '/contato', '/auth/login', '/auth/sign-up']
  return paths.map((path) => ({
    url: `${site}${path}`,
    lastModified: now,
    changeFrequency: path === '/loja' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }))
}
