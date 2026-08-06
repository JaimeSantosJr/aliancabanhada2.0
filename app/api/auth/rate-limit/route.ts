import {
  LOGIN_POLICY,
  PASSWORD_RESET_POLICY,
  clientIpFromRequest,
  consumeRateLimit,
  formatRetryMessage,
} from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Action = 'login_check' | 'login_fail' | 'login_success' | 'reset_check' | 'reset_consume'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '') as Action
    const email = String(body?.email || '')
      .trim()
      .toLowerCase()
    const ip = clientIpFromRequest(request)

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    }

    if (action === 'login_check') {
      const byEmail = await consumeRateLimit(`login:email:${email}`, LOGIN_POLICY, {
        recordFail: false,
      })
      const byIp = await consumeRateLimit(`login:ip:${ip}`, LOGIN_POLICY, {
        recordFail: false,
      })
      if (!byEmail.allowed || !byIp.allowed) {
        const retry = Math.max(byEmail.retryAfterSec, byIp.retryAfterSec)
        return NextResponse.json(
          { allowed: false, error: formatRetryMessage(retry), retryAfterSec: retry },
          { status: 429 },
        )
      }
      return NextResponse.json({ allowed: true, remaining: Math.min(byEmail.remaining, byIp.remaining) })
    }

    if (action === 'login_fail') {
      const byEmail = await consumeRateLimit(`login:email:${email}`, LOGIN_POLICY)
      const byIp = await consumeRateLimit(`login:ip:${ip}`, LOGIN_POLICY)
      if (!byEmail.allowed || !byIp.allowed) {
        const retry = Math.max(byEmail.retryAfterSec, byIp.retryAfterSec)
        return NextResponse.json(
          { allowed: false, error: formatRetryMessage(retry), retryAfterSec: retry },
          { status: 429 },
        )
      }
      return NextResponse.json({
        allowed: true,
        remaining: Math.min(byEmail.remaining, byIp.remaining),
      })
    }

    if (action === 'login_success') {
      await consumeRateLimit(`login:email:${email}`, LOGIN_POLICY, { clearOnSuccess: true })
      return NextResponse.json({ allowed: true })
    }

    if (action === 'reset_check' || action === 'reset_consume') {
      const result = await consumeRateLimit(
        `reset:email:${email}`,
        PASSWORD_RESET_POLICY,
        { recordFail: action === 'reset_consume' },
      )
      const byIp = await consumeRateLimit(`reset:ip:${ip}`, PASSWORD_RESET_POLICY, {
        recordFail: action === 'reset_consume',
      })
      if (!result.allowed || !byIp.allowed) {
        const retry = Math.max(result.retryAfterSec, byIp.retryAfterSec)
        return NextResponse.json(
          { allowed: false, error: formatRetryMessage(retry), retryAfterSec: retry },
          { status: 429 },
        )
      }
      return NextResponse.json({
        allowed: true,
        remaining: Math.min(result.remaining, byIp.remaining),
      })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('auth rate-limit', e)
    // Em falha do limitador, não trava o login legítimo
    return NextResponse.json({ allowed: true, degraded: true })
  }
}
