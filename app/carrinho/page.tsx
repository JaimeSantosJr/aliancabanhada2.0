'use client'

import { useCart } from '@/lib/cart'
import { categoryLabel, formatPrice, materialLabel } from '@/lib/format'
import { cartItemKey, cartUnitPrice, formatCartSize } from '@/lib/types'
import Link from 'next/link'

export default function CarrinhoPage() {
  const { items, subtotal, updateQuantity, removeItem, count, clear } = useCart()

  if (count === 0) {
    return (
      <div className="cart-page">
        <div className="container page-pad">
          <div className="cart-empty">
            <p className="eyebrow">Carrinho</p>
            <h1>Sua sacola esta vazia</h1>
            <p>Escolha aliancas em banho de ouro ou ouro para comecar.</p>
            <div className="cart-empty__actions">
              <Link href="/loja" className="btn">
                Explorar colecao
              </Link>
              <Link href="/personalizadas" className="btn btn-outline">
                Pedido personalizado
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="container page-pad">
        <section className="cart-hero">
          <div>
            <p className="eyebrow">Sacola</p>
            <h1>Carrinho</h1>
            <p>
              {count} {count === 1 ? 'item selecionado' : 'itens selecionados'}
            </p>
          </div>
          <button type="button" className="linkish" onClick={() => clear()}>
            Limpar carrinho
          </button>
        </section>

        <div className="cart-layout-v2">
          <ul className="cart-list-v2">
            {items.map((item) => {
              const key = cartItemKey(item)
              const linePrice = cartUnitPrice(item)
              return (
                <li key={key}>
                  <Link href={`/produto/${item.product.id}`} className="cart-thumb">
                    <img src={item.product.image_url} alt={item.product.name} />
                  </Link>
                  <div className="cart-info">
                    <p className="product-meta">
                      {categoryLabel(item.product.category)} · {materialLabel(item.product.material)}
                      {item.isPair ? ' · Par' : ''}
                    </p>
                    <Link href={`/produto/${item.product.id}`}>{item.product.name}</Link>
                    <p>{formatCartSize(item)}</p>
                    <p className="cart-unit">
                      {formatPrice(linePrice)}
                      {item.isPair ? ' o par' : ' cada'}
                    </p>
                  </div>
                  <div className="qty-control">
                    <button type="button" onClick={() => updateQuantity(key, item.quantity - 1)}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(key, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                  <div className="cart-side">
                    <strong>{formatPrice(linePrice * item.quantity)}</strong>
                    <button type="button" className="linkish" onClick={() => removeItem(key)}>
                      Remover
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <aside className="cart-summary-v2">
            <h2>Resumo</h2>
            <div className="summary-rows">
              <p>
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </p>
              <p>
                <span>Frete</span>
                <strong>No checkout</strong>
              </p>
            </div>
            <div className="summary-total-row">
              <span>Total parcial</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            <p className="cart-summary-note">Frete cotado por CEP no checkout (Melhor Envio).</p>
            <Link href="/checkout" className="btn btn-block">
              Finalizar compra
            </Link>
            <Link href="/loja" className="btn btn-outline btn-block">
              Continuar comprando
            </Link>
            <ul className="cart-notes">
              <li>Par de aliancas: informe os 2 tamanhos</li>
              <li>Pagamento via Mercado Pago (PIX/cartao)</li>
              <li>1 ano de garantia</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}
