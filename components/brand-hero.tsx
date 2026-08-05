'use client'

import Link from 'next/link'

export function BrandHero() {
  return (
    <section className="brand-hero" aria-label="Aliança Banhada">
      <img
        src="/products/hero/hero-backdrop.png"
        alt=""
        className="brand-hero-media"
        draggable={false}
      />
      <div className="brand-hero-scrim" aria-hidden="true" />

      <div className="brand-hero-panel">
        <p className="brand-hero-kicker">Coleção de alianças</p>
        <h1 className="brand-hero-mark">Aliança Banhada</h1>
        <p className="brand-hero-warranty">1 ano de garantia</p>
        <span className="brand-hero-rule" aria-hidden="true" />
        <p className="brand-hero-line">Para o sim que permanece.</p>
        <Link href="/loja" className="btn">
          Ver coleção
        </Link>
      </div>
    </section>
  )
}
