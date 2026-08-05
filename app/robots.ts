import type { MetadataRoute } from 'next'

const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aliancabanhada.com.br'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/conta', '/checkout', '/api'] },
    sitemap: `${site}/sitemap.xml`,
  }
}
