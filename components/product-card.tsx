import { categoryLabel, formatPrice, materialLabel, productHref } from '@/lib/format'
import type { Product } from '@/lib/types'
import Link from 'next/link'

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={productHref(product)} className="product-card product-card-link">
      <div className="product-image-container">
        <img
          src={product.image_url || '/products/alianca-canal-escovada.png'}
          alt={product.name}
        />
      </div>
      <div className="product-info">
        <p className="product-meta">
          {categoryLabel(product.category)} · {materialLabel(product.material)}
        </p>
        <h3>{product.name}</h3>
        <p className="product-price">{formatPrice(product.price)}</p>
      </div>
    </Link>
  )
}
