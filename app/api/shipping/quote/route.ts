import { quoteMelhorEnvio } from '@/lib/melhor-envio'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const cep = String(body?.cep || '').replace(/\D/g, '')
    const insuranceValue = Number(body?.insuranceValue || body?.subtotal || 0)
    const quantity = Math.max(1, Number(body?.quantity || 1))

    if (cep.length !== 8) {
      return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 })
    }

    const result = await quoteMelhorEnvio({
      destinationCep: cep,
      insuranceValue: Math.max(0, insuranceValue),
      quantity,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao cotar frete.' }, { status: 500 })
  }
}
