'use client'

import { useCart } from '@/lib/cart'
import { categoryLabel, formatPrice, materialLabel, parseSizes } from '@/lib/format'
import { isAlianca, type Product } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type BuyMode = 'unit' | 'pair'

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<BuyMode>('unit')
  const [size, setSize] = useState('')
  const [size2, setSize2] = useState('')
  const [qty, setQty] = useState(1)
  const { addItem } = useCart()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
      const p = data as Product | null
      setProduct(p)
      if (p) {
        const sizes = parseSizes(p.size_range)
        const first = sizes[0] || '16'
        const second = sizes[Math.min(2, sizes.length - 1)] || first
        setSize(first)
        setSize2(second)
        setMode('unit')
        const { data: more } = await supabase
          .from('products')
          .select('*')
          .eq('in_stock', true)
          .eq('category', p.category)
          .neq('id', p.id)
          .limit(3)
        setRelated((more as Product[]) || [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  const sizes = useMemo(() => parseSizes(product?.size_range), [product])
  const canPair = product ? isAlianca(product.category) : false
  const unitPrice = product ? Number(product.price) : 0
  const displayPrice = mode === 'pair' ? unitPrice * 2 : unitPrice

  if (loading) return <p className="center-msg page-pad">Carregando peça...</p>
  if (!product) {
    return (
      <div className="container page-pad center-msg">
        <p>Peça não encontrada.</p>
        <Link href="/loja" className="btn">Voltar à loja</Link>
      </div>
    )
  }

  const addToCart = () => {
    if (!size) {
      toast.error('Escolha o tamanho')
      return
    }
    if (mode === 'pair') {
      if (!size2) {
        toast.error('Escolha o tamanho das duas alianças')
        return
      }
      addItem({
        product,
        size,
        size2,
        isPair: true,
        quantity: qty,
      })
      toast.success(`Par adicionado · tam. ${size} + ${size2}`)
      return
    }

    addItem({
      product,
      size,
      isPair: false,
      quantity: qty,
    })
    toast.success(`${product.name} adicionado ao carrinho`)
  }

  return (
    <div className="pdp">
      <div className="container">
        <nav className="pdp-breadcrumb">
          <Link href="/">Início</Link>
          <span>/</span>
          <Link href="/loja">Loja</Link>
          <span>/</span>
          <Link href={`/loja?categoria=${product.category}`}>{categoryLabel(product.category)}</Link>
          <span>/</span>
          <span>{product.name}</span>
        </nav>

        <div className="pdp-grid">
          <div className="pdp-gallery">
            <div className="pdp-frame">
              <img
                src={product.image_url || '/products/alianca-canal-escovada.png'}
                alt={product.name}
              />
              <div className="pdp-shine" aria-hidden />
            </div>
          </div>

          <div className="pdp-buybox">
            <p className="eyebrow">
              {categoryLabel(product.category)} · {materialLabel(product.material)}
            </p>
            <h1>{product.name}</h1>
            <p className="pdp-price">
              {formatPrice(displayPrice)}
              {mode === 'pair' && <span className="pdp-price-note"> par completo</span>}
            </p>
            {mode === 'pair' && (
              <p className="pdp-pair-hint">
                Preço unitário {formatPrice(unitPrice)} · par = 2 alianças
              </p>
            )}
            <p className="pdp-desc">{product.description}</p>

            {canPair && (
              <label className={`pair-upsell ${mode === 'pair' ? 'is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={mode === 'pair'}
                  onChange={(e) => setMode(e.target.checked ? 'pair' : 'unit')}
                />
                <span className="pair-upsell-copy">
                  <strong>Aproveite e compre o par</strong>
                  <small>
                    Marque para levar as 2 alianças e escolher o tamanho de cada uma agora.
                    Valor do par: {formatPrice(unitPrice * 2)}
                  </small>
                </span>
              </label>
            )}

            {mode === 'pair' ? (
              <>
                <div className="pdp-block">
                  <div className="pdp-label-row">
                    <span>Tamanho — Aliança 1</span>
                    <Link href="/contato#medidas">Guia de medidas</Link>
                  </div>
                  <p className="size-hint">Ex.: sua aliança</p>
                  <div className="size-grid">
                    {sizes.map((s) => (
                      <button
                        key={`a1-${s}`}
                        type="button"
                        className={size === s ? 'is-active' : ''}
                        onClick={() => setSize(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pdp-block">
                  <div className="pdp-label-row">
                    <span>Tamanho — Aliança 2</span>
                  </div>
                  <p className="size-hint">Ex.: aliança do(a) parceiro(a)</p>
                  <div className="size-grid">
                    {sizes.map((s) => (
                      <button
                        key={`a2-${s}`}
                        type="button"
                        className={size2 === s ? 'is-active' : ''}
                        onClick={() => setSize2(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {size && size2 && (
                  <p className="pair-summary">
                    Par selecionado: <strong>{size}</strong> + <strong>{size2}</strong>
                  </p>
                )}
              </>
            ) : (
              <div className="pdp-block">
                <div className="pdp-label-row">
                  <span>Tamanho do anel</span>
                  <Link href="/contato#medidas">Guia de medidas</Link>
                </div>
                <div className="size-grid">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={size === s ? 'is-active' : ''}
                      onClick={() => setSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pdp-block">
              <span className="field-label">{mode === 'pair' ? 'Quantidade de pares' : 'Quantidade'}</span>
              <div className="qty-control">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span>{qty}</span>
                <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
            </div>

            <div className="pdp-cta">
              {product.free_shipping ? (
                <p className="muted" style={{ marginBottom: 12 }}>Este produto tem frete grátis.</p>
              ) : null}
              <button type="button" className="btn" onClick={addToCart} disabled={!product.in_stock}>
                {product.in_stock
                  ? mode === 'pair'
                    ? 'Adicionar par ao carrinho'
                    : 'Adicionar ao carrinho'
                  : 'Indisponível'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={!product.in_stock}
                onClick={() => {
                  addToCart()
                  router.push('/carrinho')
                }}
              >
                Comprar agora
              </button>
            </div>

            <ul className="pdp-trust">
              <li>Somente alianças e solitários</li>
              <li>Material: {materialLabel(product.material)}</li>
              {canPair && <li>No par, escolha o tamanho de cada aliança</li>}
              <li>Pagamento via PIX ou transferência</li>
            </ul>
          </div>
        </div>

        {related.length > 0 && (
          <section className="pdp-related">
            <div className="section-title">
              <h2>Peças semelhantes</h2>
            </div>
            <div className="product-grid">
              {related.map((p) => (
                <Link key={p.id} href={`/produto/${p.id}`} className="product-card product-card-link">
                  <div className="product-image-container">
                    <img src={p.image_url} alt={p.name} />
                  </div>
                  <div className="product-info">
                    <p className="product-meta">{categoryLabel(p.category)} · {materialLabel(p.material)}</p>
                    <h3>{p.name}</h3>
                    <p className="product-price">{formatPrice(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
