import {
  clientIpFromRequest,
  consumeRateLimit,
  formatRetryMessage,
  type RateLimitPolicy,
} from '@/lib/rate-limit'
import { sendSimpleNotify } from '@/lib/email'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NOTIFY_POLICY: RateLimitPolicy = {
  limit: 5,
  windowSec: 15 * 60,
  lockSec: 30 * 60,
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body?.website) return NextResponse.json({ ok: true })

    const ip = clientIpFromRequest(request)
    const limit = await consumeRateLimit(`notify:ip:${ip}`, NOTIFY_POLICY)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: formatRetryMessage(limit.retryAfterSec) },
        { status: 429 },
      )
    }

    if (body?.type === 'contact') {
      await sendSimpleNotify(
        `[Contato] ${body.subject || 'Nova mensagem'}`,
        `<p><strong>${String(body.name || '').slice(0, 120)}</strong> (${String(body.email || '').slice(0, 120)})</p><p>${String(body.subject || '').slice(0, 200)}</p>`,
      )
    }
    if (body?.type === 'custom') {
      await sendSimpleNotify(
        `[Personalizada] ${body.name || 'Nova solicitação'}`,
        `<p><strong>${String(body.name || '').slice(0, 120)}</strong> (${String(body.email || '').slice(0, 120)})</p>`,
      )
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
