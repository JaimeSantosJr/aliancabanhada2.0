import { createServiceClient } from '@/lib/supabase/route'

type MemoryBucket = {
  count: number
  windowStartsAt: number
  lockedUntil: number | null
}

const memory = new Map<string, MemoryBucket>()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSec: number
  locked: boolean
}

export type RateLimitPolicy = {
  /** Máximo de tentativas na janela */
  limit: number
  /** Janela em segundos */
  windowSec: number
  /** Bloqueio após estourar o limite (segundos) */
  lockSec: number
}

export const LOGIN_POLICY: RateLimitPolicy = {
  limit: 5,
  windowSec: 15 * 60,
  lockSec: 15 * 60,
}

export const PASSWORD_RESET_POLICY: RateLimitPolicy = {
  limit: 3,
  windowSec: 30 * 60,
  lockSec: 30 * 60,
}

export const PAYMENT_POLICY: RateLimitPolicy = {
  limit: 8,
  windowSec: 60 * 60,
  lockSec: 60 * 60,
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase().slice(0, 200)
}

function fromMemory(key: string, policy: RateLimitPolicy, recordFail: boolean): RateLimitResult {
  const now = Date.now()
  let bucket = memory.get(key)

  if (!bucket || now - bucket.windowStartsAt > policy.windowSec * 1000) {
    bucket = { count: 0, windowStartsAt: now, lockedUntil: null }
  }

  if (bucket.lockedUntil && bucket.lockedUntil > now) {
    memory.set(key, bucket)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.lockedUntil - now) / 1000),
      locked: true,
    }
  }

  if (recordFail) {
    bucket.count += 1
    if (bucket.count >= policy.limit) {
      bucket.lockedUntil = now + policy.lockSec * 1000
    }
  }

  memory.set(key, bucket)

  const remaining = Math.max(0, policy.limit - bucket.count)
  const locked = Boolean(bucket.lockedUntil && bucket.lockedUntil > now)

  return {
    allowed: !locked && bucket.count < policy.limit,
    remaining,
    retryAfterSec: locked && bucket.lockedUntil
      ? Math.ceil((bucket.lockedUntil - now) / 1000)
      : 0,
    locked,
  }
}

function clearMemory(key: string) {
  memory.delete(key)
}

/** Rate limit persistente (Supabase) com fallback em memória para o processo. */
export async function consumeRateLimit(
  rawKey: string,
  policy: RateLimitPolicy,
  opts?: { recordFail?: boolean; clearOnSuccess?: boolean },
): Promise<RateLimitResult> {
  const key = normalizeKey(rawKey)
  const recordFail = opts?.recordFail ?? true
  const clearOnSuccess = opts?.clearOnSuccess ?? false

  if (clearOnSuccess) {
    clearMemory(key)
    const db = createServiceClient()
    if (db) {
      await db.from('security_rate_limits').delete().eq('bucket_key', key)
    }
    return { allowed: true, remaining: policy.limit, retryAfterSec: 0, locked: false }
  }

  const db = createServiceClient()
  if (!db) {
    return fromMemory(key, policy, recordFail)
  }

  try {
    const now = new Date()
    const { data: row } = await db
      .from('security_rate_limits')
      .select('hit_count, window_starts_at, locked_until')
      .eq('bucket_key', key)
      .maybeSingle()

    let hitCount = row?.hit_count ?? 0
    let windowStartsAt = row?.window_starts_at ? new Date(row.window_starts_at) : now
    let lockedUntil = row?.locked_until ? new Date(row.locked_until) : null

    const windowExpired =
      now.getTime() - windowStartsAt.getTime() > policy.windowSec * 1000

    if (windowExpired) {
      hitCount = 0
      windowStartsAt = now
      lockedUntil = null
    }

    if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000),
        locked: true,
      }
    }

    if (recordFail) {
      hitCount += 1
      if (hitCount >= policy.limit) {
        lockedUntil = new Date(now.getTime() + policy.lockSec * 1000)
      }
    }

    await db.from('security_rate_limits').upsert(
      {
        bucket_key: key,
        hit_count: hitCount,
        window_starts_at: windowStartsAt.toISOString(),
        locked_until: lockedUntil?.toISOString() ?? null,
        updated_at: now.toISOString(),
      },
      { onConflict: 'bucket_key' },
    )

    const locked = Boolean(lockedUntil && lockedUntil.getTime() > now.getTime())
    return {
      allowed: !locked && hitCount < policy.limit,
      remaining: Math.max(0, policy.limit - hitCount),
      retryAfterSec: locked && lockedUntil
        ? Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)
        : 0,
      locked,
    }
  } catch (e) {
    console.warn('rate-limit db fallback', e)
    return fromMemory(key, policy, recordFail)
  }
}

export function formatRetryMessage(retryAfterSec: number) {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60))
  return `Muitas tentativas. Aguarde cerca de ${mins} min e tente de novo.`
}

export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}
