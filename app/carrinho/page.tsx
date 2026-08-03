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
            <h1>Seu carrinho está vazio</h1>
            <p>Escolha alianças e solitários em banho de ouro ou ouro para começar.</p>
            <Link href="/loja" className="btn">Explorar coleção</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <div className="container page-pad">
        <header className="cart-header">
          <div>
            <p className="eyebrow">Sacola</p>
            <h1>Carrinho</h1>
            <p>{count} {count === 1 ? 'item' : 'itens'} selecionados</p>
          </div>
          <button type="button" className="linkish" onClick={() => clear()}>
            Limpar carrinho
          </button>
        </header>

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
                    <button type="button" onClick={() => updateQuantity(key, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(key, item.quantity + 1)}>+</button>
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
            <h2>Resumo do pedido</h2>
            <div className="summary-rows">
              <p><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></p>
              <p><span>Frete</span><span>Calculado no checkout</span></p>
            </div>
            <div className="summary-total-row">
              <span>Total estimado</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            <Link href="/checkout" className="btn btn-block">Finalizar compra</Link>
            <Link href="/loja" className="btn btn-outline btn-block">Continuar comprando</Link>
            <ul className="cart-notes">
              <li>Par de alianças: informe os 2 tamanhos</li>
              <li>Pagamento por PIX ou transferência</li>
              <li>Confirmação manual após comprovante</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}
