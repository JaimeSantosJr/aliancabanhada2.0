/**
 * Teste E2E: compra com Checkout Transparente (sandbox).
 * Uso: node scripts/test-transparent-checkout.mjs [baseUrl]
 */
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { chromium } from 'playwright'
import { resolve } from 'path'

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch {
    /* ignore */
  }
}

loadEnv()

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = process.env.AB_SITE_EMAIL || 'jaimegsantosj@gmail.com'
const PASSWORD = process.env.AB_SITE_PASSWORD || '190106'
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || ''
const CHROME =
  process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe'

const PRODUCT_PATH = '/produto/0ee99298-6e36-4d3e-aa82-c7b596604eb1'

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
  if (!res.ok || !data.id) {
    throw new Error(`Falha ao tokenizar cartão: ${JSON.stringify(data)}`)
  }
  return data
}

async function main() {
  console.log('BASE', BASE)
  if (!PUBLIC_KEY) throw new Error('NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ausente')

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
  })
  const page = await browser.newPage()
  const logs = []
  page.on('response', async (r) => {
    const u = r.url()
    if (u.includes('/api/orders') || u.includes('/api/payments') || u.includes('/api/shipping')) {
      let body = ''
      try {
        body = await r.text()
      } catch {
        body = ''
      }
      logs.push({ url: u, status: r.status(), body: body.slice(0, 800) })
      console.log('API', r.status(), u.replace(BASE, ''), body.slice(0, 200))
    }
  })

  try {
    // 1) Produto → carrinho → checkout
    await page.goto(`${BASE}${PRODUCT_PATH}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2000)
    const sizeBtn = page.getByRole('button', { name: '18', exact: true }).first()
    await sizeBtn.click()
    const buy = page.getByRole('button', { name: 'Comprar agora', exact: true })
    await buy.waitFor({ state: 'visible', timeout: 15000 })
    // se ainda disabled, tenta tamanho default
    if (await buy.isDisabled()) {
      await page.getByRole('button', { name: '16', exact: true }).first().click()
      await page.waitForTimeout(500)
    }
    await buy.click({ timeout: 15000 })
    await page.waitForTimeout(1500)

    const finalizar = page.getByRole('link', { name: 'Finalizar compra' })
    if (await finalizar.count()) await finalizar.click()
    else await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' })

    await page.waitForTimeout(2000)

    // 2) Login se necessário
    const jaTenho = page.getByRole('button', { name: 'Já tenho conta' })
    if (await jaTenho.count()) {
      await jaTenho.click()
      await page.locator('input[type=email]').first().fill(EMAIL)
      await page.locator('input[type=password]').fill(PASSWORD)
      await page.getByRole('button', { name: 'Entrar e continuar', exact: true }).click()
      await page.waitForTimeout(3000)
    }

    // 3) Preenche checkout
    const fillIfEmpty = async (label, value) => {
      const input = page.locator('label').filter({ hasText: label }).locator('input').first()
      if (!(await input.count())) return
      const current = await input.inputValue()
      if (!current) await input.fill(value)
    }

    await fillIfEmpty('Nome completo', 'Jaime Teste')
    await fillIfEmpty('Telefone', '48999999999')
    await fillIfEmpty('WhatsApp', '48999999999')

    const cep = page.locator('label').filter({ hasText: 'CEP' }).locator('input').first()
    await cep.fill('88010000')
    await cep.blur()
    await page.waitForTimeout(500)

    // dispara cotação
    const quoteBtn = page.getByRole('button', { name: /Calcular|Cotação|Buscar frete|CEP/i })
    if (await quoteBtn.count()) {
      await quoteBtn.first().click().catch(() => {})
    }
    // tecla Enter no CEP / aguarda opções
    await page.waitForTimeout(4000)

    // seleciona primeiro frete disponível
    const shippingRadio = page.locator('input[name="shipping_service_id"], input[type=radio][name*=shipping]').first()
    const shippingLabel = page.locator('.shipping-options label, .shipping-option, [class*=shipping] label').first()
    if (await shippingRadio.count()) {
      await shippingRadio.check({ force: true })
    } else if (await shippingLabel.count()) {
      await shippingLabel.click()
    } else {
      // tenta qualquer opção de frete clicável
      const anyShip = page.locator('label').filter({ hasText: /Correios|PAC|SEDEX|Jadlog|Frete|R\$/i }).first()
      if (await anyShip.count()) await anyShip.click()
    }

    await fillIfEmpty('Rua', 'Rua Teste')
    await fillIfEmpty('Número', '100')
    await fillIfEmpty('Bairro', 'Centro')
    await fillIfEmpty('Cidade', 'Florianópolis')
    const uf = page.locator('label').filter({ hasText: /^UF|Estado/i }).locator('input, select').first()
    if (await uf.count()) {
      const tag = await uf.evaluate((el) => el.tagName)
      if (tag === 'SELECT') await uf.selectOption('SC')
      else await uf.fill('SC')
    }

    // Mercado Pago
    const mp = page.locator('label').filter({ hasText: /Mercado Pago/i }).first()
    if (await mp.count()) await mp.click()

    await page.screenshot({ path: 'mp-transparent-checkout-form.png', fullPage: true })

    const submitBtn = page.getByRole('button', { name: /Criar pedido e pagar|Confirmar pedido|Pagar/i })
    await submitBtn.click()

    // 4) Página do pedido
    await page.waitForURL(/\/pedido\//, { timeout: 45000 })
    const orderUrl = page.url()
    const orderId = orderUrl.split('/pedido/')[1]?.split('?')[0]
    console.log('ORDER_URL', orderUrl)
    console.log('ORDER_ID', orderId)

    await page.waitForTimeout(4000)
    await page.screenshot({ path: 'mp-transparent-pedido.png', fullPage: true })

    const bodyText = await page.locator('body').innerText()
    const hasBrickHint =
      bodyText.includes('Checkout Transparente') ||
      bodyText.includes('Pague com PIX ou cartão') ||
      (await page.locator('#paymentBrick_container, [id*=paymentBrick], iframe').count()) > 0

    console.log('BRICK_VISIBLE_HINT', hasBrickHint)

    // 5) Pagamento via API (mesmo cookie da sessão) + token de cartão sandbox
    const token = await createCardToken()
    console.log('CARD_TOKEN', token.id, 'PAYMENT_METHOD', token.payment_method?.id || token.payment_method_id)

    const paymentResult = await page.evaluate(
      async ({ orderId, tokenId, paymentMethodId }) => {
        const res = await fetch('/api/payments/mercadopago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            token: tokenId,
            payment_method_id: paymentMethodId || 'master',
            payment_type_id: 'credit_card',
            installments: 1,
            payer: {
              email: 'test_user_buyer@testuser.com',
              identification: { type: 'CPF', number: '12345678909' },
            },
          }),
        })
        const data = await res.json()
        return { status: res.status, data }
      },
      {
        orderId,
        tokenId: token.id,
        paymentMethodId: token.payment_method?.id || token.payment_method_id || 'master',
      },
    )

    console.log('PAYMENT_RESULT', JSON.stringify(paymentResult, null, 2))

    // Fallback: PIX transparente (mesmo endpoint)
    if (paymentResult.status >= 400) {
      const pixResult = await page.evaluate(async (orderId) => {
        const res = await fetch('/api/payments/mercadopago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            payment_method_id: 'pix',
            payer: {
              email: 'test_user_buyer@testuser.com',
              identification: { type: 'CPF', number: '19119119100' },
            },
          }),
        })
        return { status: res.status, data: await res.json() }
      }, orderId)
      console.log('PIX_RESULT', JSON.stringify(pixResult, null, 2))
      if (pixResult.status < 400 && pixResult.data?.status) {
        Object.assign(paymentResult, pixResult)
      }
    }

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: 'mp-transparent-after-pay.png', fullPage: true })
    const after = await page.locator('body').innerText()
    const paid =
      after.toLowerCase().includes('pagamento confirmado') ||
      after.toLowerCase().includes('paid') ||
      after.includes('aprovado')

    console.log('PAGE_SHOWS_PAID', paid)
    console.log(
      'SUMMARY',
      JSON.stringify({
        orderId,
        paymentHttp: paymentResult.status,
        mpStatus: paymentResult.data?.status,
        paymentId: paymentResult.data?.id,
        paidUi: paid,
        hash: createHash('sha1').update(String(paymentResult.data?.id || '')).digest('hex').slice(0, 8),
      }),
    )

    if (paymentResult.status >= 400 || paymentResult.data?.status === 'rejected') {
      process.exitCode = 1
    } else if (paymentResult.data?.status !== 'approved' && !paymentResult.data?.alreadyPaid) {
      // pending também é válido em alguns casos; marca aviso
      console.warn('Pagamento não aprovado imediatamente:', paymentResult.data?.status)
      if (!['pending', 'in_process', 'authorized'].includes(paymentResult.data?.status)) {
        process.exitCode = 1
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
