import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = process.env.ADMIN_EMAIL || 'jaimegsantosj@gmail.com'
const password = process.env.ADMIN_PASSWORD || '190106'

const SIZES = '12,13,14,15,16,17,18,19,20,21,22,23,24'

/** Catálogo de teste — descrições fiéis às fotos enviadas */
const PRODUCTS = [
  {
    slug: 'alianca-canal-escovada',
    name: 'Aliança Canal Escovada',
    description:
      'Aliança em tom de ouro com face externa escovada (acetinada), canal central polido e brilhante, e bordas chanfradas espelhadas. Interior liso e polido. Perfil flat com chanfro.',
    price: 189.9,
    image_url: '/products/alianca-canal-escovada.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
  {
    slug: 'alianca-flat-pedra',
    name: 'Aliança Flat com Pedra',
    description:
      'Aliança em tom de ouro com perfil flat e acabamento polido. Uma pedra redonda clara (estilo solitário) cravada no centro da face externa. Bordas levemente chanfradas. Interior liso e polido.',
    price: 219.9,
    image_url: '/products/alianca-flat-pedra.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
  {
    slug: 'alianca-fosca-floral-pedra',
    name: 'Aliança Fosca Floral com Pedra',
    description:
      'Aliança em tom de ouro com face externa fosca/jateada e gravura orgânica floral sutil. Pedra redonda clara cravada no centro. Bordas arredondadas (comfort fit). Interior liso e polido.',
    price: 229.9,
    image_url: '/products/alianca-fosca-floral-pedra.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
  {
    slug: 'alianca-bicolor-diagonais',
    name: 'Aliança Bicolor Diagonais',
    description:
      'Aliança bicolor: interior e bordas chanfradas em tom de ouro polido; face central em tom prata/aço escovado. Detalhes diagonais em ouro com textura em linhas paralelas (estilo grão). Perfil flat com chanfro.',
    price: 249.9,
    image_url: '/products/alianca-bicolor-diagonais.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
  {
    slug: 'alianca-bicolor-canal',
    name: 'Aliança Bicolor com Canal',
    description:
      'Aliança bicolor: interior e bordas em ouro polido; duas faixas laterais em tom prata escovado; canal central fino em ouro polido. Perfil flat com bordas chanfradas.',
    price: 239.9,
    image_url: '/products/alianca-bicolor-canal.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
  {
    slug: 'alianca-escovada-chanfrada',
    name: 'Aliança Escovada Chanfrada',
    description:
      'Aliança lisa em tom de ouro, sem pedras. Faixa central escovada (acetinada) e bordas chanfradas altamente polidas. Interior liso e polido. Perfil flat moderno.',
    price: 179.9,
    image_url: '/products/alianca-escovada-chanfrada.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
  {
    slug: 'alianca-par-jateada',
    name: 'Aliança Jateada (par)',
    description:
      'Modelo de aliança em tom de ouro com centro jateado/fosco cintilante e bordas chanfradas polidas. Foto de referência mostra o par. Preço unitário; use a opção de par no produto para comprar as duas.',
    price: 199.9,
    image_url: '/products/alianca-par-jateada.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
  {
    slug: 'alianca-meio-brilho-glitter',
    name: 'Aliança Meio Brilho Meio Glitter',
    description:
      'Aliança em tom de ouro com face dividida: metade superior polida espelhada e metade inferior com textura glitter/jateada. Separadas por um filete/canal horizontal fino. Interior liso.',
    price: 209.9,
    image_url: '/products/alianca-meio-brilho-glitter.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
  {
    slug: 'alianca-batimentos',
    name: 'Aliança Batimentos',
    description:
      'Aliança em tom de ouro com centro jateado/cintilante, bordas polidas e gravura de batimentos cardíacos (ECG) na face externa e também no interior. Interior liso e polido.',
    price: 259.9,
    image_url: '/products/alianca-batimentos.png',
    category: 'alianca',
    material: 'Ouro banhado',
  },
]

const sb = createClient(url, anon)

async function main() {
  console.log('Login admin…')
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password })
  if (authErr) throw authErr
  console.log('OK', auth.user.email)

  const { data: existing, error: listErr } = await sb.from('products').select('id,slug,name')
  if (listErr) throw listErr
  console.log('Produtos atuais:', existing?.length ?? 0)

  if (existing?.length) {
    const ids = existing.map((p) => p.id)
    const { error: delErr } = await sb.from('products').delete().in('id', ids)
    if (delErr) {
      console.warn('Delete parcial falhou, tentando um a um…', delErr.message)
      for (const id of ids) {
        const { error } = await sb.from('products').delete().eq('id', id)
        if (error) console.warn('fail', id, error.message)
      }
    } else {
      console.log('Removidos', ids.length)
    }
  }

  const rows = PRODUCTS.map((p) => ({
    ...p,
    size_range: SIZES,
    in_stock: true,
  }))

  const { data: inserted, error: insErr } = await sb.from('products').insert(rows).select('id,name,slug')
  if (insErr) throw insErr
  console.log('Inseridos:', inserted.length)
  for (const p of inserted) console.log(' -', p.name)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
