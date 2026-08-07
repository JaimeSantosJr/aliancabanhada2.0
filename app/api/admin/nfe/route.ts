import { createRouteClient, createServiceClient } from '@/lib/supabase/route'
import { getStoreFiscalConfig, isNfeApiConfigured } from '@/lib/store-fiscal'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: 'Sem permissao.' }, { status: 403 }) }
  }
  return { user, supabase }
}

/** Status da integracao fiscal (sem expor tokens). */
export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate && gate.error) return gate.error

  const store = getStoreFiscalConfig()
  return NextResponse.json({
    store: {
      legalName: store.legalName,
      tradeName: store.tradeName,
      cnpj: store.cnpj ? '**' + store.cnpj.slice(-4) : '',
      city: store.city,
      state: store.state,
      configured: store.configured,
      provider: store.provider,
    },
    apiReady: isNfeApiConfigured(),
    message: !store.configured
      ? 'Preencha NEXT_PUBLIC_STORE_CNPJ e NEXT_PUBLIC_STORE_LEGAL_NAME no .env'
      : !isNfeApiConfigured()
        ? 'Loja configurada. Falta token do provedor (FOCUSNFE_TOKEN ou NFEIO_API_KEY) para emissao automatica.'
        : 'Pronto para emitir NF-e.',
  })
}

/**
 * Emite NF-e (scaffold).
 * Quando voce passar token + provedor, implementamos a chamada real aqui.
 */
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate && gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const orderId = String(body?.orderId || '')
  if (!orderId) {
    return NextResponse.json({ error: 'Pedido invalido.' }, { status: 400 })
  }

  const store = getStoreFiscalConfig()
  if (!store.configured) {
    return NextResponse.json(
      {
        error:
          'Dados da loja ainda nao configurados. Envie CNPJ/razao social e eu conecto no .env (NEXT_PUBLIC_STORE_*).',
        code: 'STORE_NOT_CONFIGURED',
      },
      { status: 503 },
    )
  }

  if (!isNfeApiConfigured()) {
    const db = createServiceClient() || gate.supabase
    await db
      .from('orders')
      .update({
        nfe_status: 'pending',
        nfe_error: 'Aguardando integracao do provedor (token).',
      })
      .eq('id', orderId)

    return NextResponse.json(
      {
        error:
          'Loja ok, mas a API de NF ainda nao tem token. Pedido marcado como NF pendente. Quando voce passar FocusNFe/NFe.io, ativamos a emissao.',
        code: 'NFE_API_NOT_CONFIGURED',
        nfe_status: 'pending',
      },
      { status: 503 },
    )
  }

  // Hook futuro: chamar Focus NFe / NFe.io com order + store
  return NextResponse.json(
    {
      error: 'Provedor configurado, mas o conector ainda sera ligado com seus dados. Avise quando o token estiver no .env.',
      code: 'NFE_CONNECTOR_PENDING',
    },
    { status: 501 },
  )
}
