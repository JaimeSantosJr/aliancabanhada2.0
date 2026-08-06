/**
 * Teste: cria pedido + paga com cartão de teste (Orders API).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { chromium } from 'playwright'
import { resolve } from 'path'

function loadEnv() {
  let raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
loadEnv()

const BASE = 'http://localhost:3000'
const EMAIL = process.env.AB_SITE_EMAIL || 'jaimegsantosj@gmail.com'
const PASSWORD = process.env.AB_SITE_PASSWORD || '190106'
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error(`Supabase env ausente url=${!!SUPABASE_URL} anon=${!!SUPABASE_ANON}`)
}

const sb = createClient(SUPABASE_URL, SUPABASE_ANON)

async function createCardToken() {
  const res = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(PUBLIC_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_number: '5480832801033311',
        expiration_month: 11,
        expiration_year: 2030,
        security_code: '123',
        cardholder: {
          name: 'APRO',
          identification: { type: 'CPF', number: '12345678909' },
        },
      }),
    },
  )
  const data = await res.json()
  if (!data.id) throw new Error(`token: ${JSON.stringify(data)}`)
  return data
}

const { data: products } = await sb
  .from('products')
  .select('id,name')
  .eq('in_stock', true)
  .limit(1)
const productId = products?.[0]?.id
if (!productId) throw new Error('Nenhum produto em estoque')
console.log('PRODUCT', products[0])

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
})
if (authErr || !auth.session) throw new Error(authErr?.message || 'login falhou')
console.log('USER', auth.user.id)

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage()

// injeta sessão no browser (cookies do Supabase SSR)
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate(
  async ({ url, key, session }) => {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1')
    const client = createClient(url, key)
    await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
  },
  {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    session: {
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
    },
  },
)

await page.goto(`${BASE}/produto/${productId}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: '18', exact: true }).first().click()
await page.waitForTimeout(400)
const buy = page.getByRole('button', { name: 'Comprar agora', exact: true })
if (await buy.isDisabled()) {
  await page.getByRole('button', { name: '16', exact: true }).first().click()
  await page.waitForTimeout(400)
}
await buy.click()
await page.waitForTimeout(1200)
const fin = page.getByRole('link', { name: 'Finalizar compra' })
if (await fin.count()) await fin.click()
else await page.goto(`${BASE}/checkout`)
await page.waitForTimeout(2000)

// se ainda pedir login no checkout
if (await page.getByRole('button', { name: 'Já tenho conta' }).count()) {
  await page.getByRole('button', { name: 'Já tenho conta' }).click()
  await page.locator('input[type=email]').first().fill(EMAIL)
  await page.locator('input[type=password]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar e continuar', exact: true }).click()
  await page.waitForTimeout(3000)
}

const fill = async (label, value) => {
  const input = page.locator('label').filter({ hasText: label }).locator('input').first()
  if (await input.count()) {
    const cur = await input.inputValue()
    if (!cur) await input.fill(value)
  }
}
await fill('Nome completo', 'Jaime Teste')
await fill('Telefone', '48999999999')
await fill('WhatsApp', '48999999999')
const cep = page.locator('label').filter({ hasText: 'CEP' }).locator('input').first()
await cep.fill('88010000')
await cep.blur()
await page.waitForTimeout(4000)
const ship = page.locator('input[name=shipping]').first()
if (await ship.count()) await ship.check({ force: true })
await fill('Rua', 'Rua Teste')
await fill('Número', '100')
await fill('Bairro', 'Centro')
await fill('Cidade', 'Florianópolis')
await fill('Estado', 'SC')
const mp = page.locator('label').filter({ hasText: /Mercado Pago/i }).first()
if (await mp.count()) await mp.click()

page.on('response', async (r) => {
  if (r.url().includes('/api/orders') || r.url().includes('/api/payments')) {
    console.log('API', r.status(), r.url().replace(BASE, ''), (await r.text()).slice(0, 250))
  }
})

await page.getByRole('button', { name: /Criar pedido e pagar|Confirmar pedido/i }).click()
await page.waitForURL(/\/pedido\//, { timeout: 45000 })
const orderId = page.url().split('/pedido/')[1].split('?')[0]
console.log('ORDER_ID', orderId)

const token = await createCardToken()
const paymentResult = await page.evaluate(
  async ({ orderId, tokenId }) => {
    const res = await fetch('/api/payments/mercadopago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        token: tokenId,
        payment_method_id: 'master',
        payment_type_id: 'credit_card',
        installments: 1,
        payer: {
          email: 'test_user_buyer@testuser.com',
          identification: { type: 'CPF', number: '12345678909' },
        },
      }),
    })
    return { status: res.status, data: await res.json() }
  },
  { orderId, tokenId: token.id },
)

console.log('PAYMENT_RESULT', JSON.stringify(paymentResult, null, 2))
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const body = await page.locator('body').innerText()
console.log('PAID_UI', /pagamento confirmado/i.test(body))
console.log('BANNER', body.match(/Status:.*$/m)?.[0] || '')

await browser.close()
if (paymentResult.status >= 400 || paymentResult.data?.status !== 'approved') process.exit(1)
console.log('OK — compra teste aprovada')
