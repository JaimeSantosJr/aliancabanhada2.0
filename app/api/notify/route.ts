import { sendSimpleNotify } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body?.website) return NextResponse.json({ ok: true })

    if (body?.type === 'contact') {
      await sendSimpleNotify(
        `[Contato] ${body.subject || 'Nova mensagem'}`,
        `<p><strong>${body.name}</strong> (${body.email})</p><p>${body.subject || ''}</p>`,
      )
    }
    if (body?.type === 'custom') {
      await sendSimpleNotify(
        `[Personalizada] ${body.name || 'Nova solicitação'}`,
        `<p><strong>${body.name}</strong> (${body.email})</p>`,
      )
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
