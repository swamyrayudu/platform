// ============================================================
// lib/auth/rate-limit.ts — Adaptive rate limiter (SERVER ONLY)
// ============================================================
// memory  → in-process sliding window (single instance, dev)
// redis   → Upstash Redis (multi-instance, production)
// Controlled by RATE_LIMIT_PROVIDER env variable.
// ============================================================

type Endpoint =
  | 'google'
  | 'refresh'
  | 'logout'
  | 'payment_order'
  | 'payment_verify'
  | 'coupon'

// ---- Limits per endpoint --------------------------------------
const LIMITS: Record<Endpoint, { max: number; windowMs: number }> = {
  google:  { max: 10, windowMs: 15 * 60 * 1000 }, // 10 req / 15 min
  refresh: { max: 20, windowMs: 15 * 60 * 1000 }, // 20 req / 15 min
  logout:  { max: 10, windowMs: 15 * 60 * 1000 }, // 10 req / 15 min
  payment_order:  { max: 10, windowMs: 15 * 60 * 1000 }, // 10 orders / 15 min per user
  payment_verify: { max: 20, windowMs: 15 * 60 * 1000 }, // 20 verifies / 15 min per user
  coupon:         { max: 30, windowMs: 15 * 60 * 1000 }, // 30 coupon checks / 15 min per user
}

// ---- In-memory implementation ---------------------------------

interface WindowEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, WindowEntry>()

function checkMemoryLimit(
  key: string,
  endpoint: Endpoint
): { allowed: boolean; retryAfter?: number } {
  const limit = LIMITS[endpoint]
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    // New window
    memoryStore.set(key, { count: 1, resetAt: now + limit.windowMs })
    return { allowed: true }
  }

  if (entry.count >= limit.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.count++
  return { allowed: true }
}

// Periodically purge expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetAt) memoryStore.delete(key)
  }
}, 5 * 60 * 1000) // every 5 minutes

// ---- Redis implementation (Upstash) ---------------------------

// One limiter per endpoint, built once. This previously constructed a new
// Redis client AND a new Ratelimit instance on every single request.
const redisLimiterCache = new Map<Endpoint, unknown>()

async function getRedisLimiter(endpoint: Endpoint): Promise<unknown> {
  const cached = redisLimiterCache.get(endpoint)
  if (cached) return cached

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — optional production dependency
  const { Ratelimit } = await import('@upstash/ratelimit')
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — optional production dependency
  const { Redis } = await import('@upstash/redis')

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  const limit = LIMITS[endpoint]
  const windowSeconds = Math.floor(limit.windowMs / 1000)

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit.max, `${windowSeconds} s`),
  })

  redisLimiterCache.set(endpoint, limiter)
  return limiter
}

async function checkRedisLimit(
  key: string,
  endpoint: Endpoint
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const limiter = (await getRedisLimiter(endpoint)) as {
      limit: (k: string) => Promise<{ success: boolean; reset: number }>
    }

    const result = await limiter.limit(key)
    if (result.success) return { allowed: true }

    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
    return { allowed: false, retryAfter }
  } catch (err) {
    // Do NOT fail open. This previously returned { allowed: true }, so any
    // Redis hiccup removed rate limiting from the auth endpoints entirely —
    // and an attacker able to induce errors could keep it that way.
    // Degrade to the in-process limiter instead: weaker than Redis across
    // instances, but never unlimited.
    console.error('[RateLimit] Redis error, degrading to in-memory limiter:', err)
    redisLimiterCache.delete(endpoint) // force a rebuild on the next call
    return checkMemoryLimit(key, endpoint)
  }
}

// ---- Public API -----------------------------------------------

/**
 * Check rate limit for an auth endpoint.
 *
 * @param key      - Unique key (typically hashed IP)
 * @param endpoint - Which auth endpoint is being protected
 * @returns { allowed: boolean; retryAfter?: number (seconds) }
 */
let warnedAboutMemoryProvider = false

export async function checkRateLimit(
  key: string,
  endpoint: Endpoint
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const provider = process.env.RATE_LIMIT_PROVIDER ?? 'memory'

  if (provider === 'redis') {
    return checkRedisLimit(key, endpoint)
  }

  // On serverless each instance has its own Map, so the effective limit is
  // (configured limit x warm instances) and resets on every cold start.
  if (process.env.NODE_ENV === 'production' && !warnedAboutMemoryProvider) {
    warnedAboutMemoryProvider = true
    console.error(
      '[RateLimit] RATE_LIMIT_PROVIDER is not "redis" in production: limits are ' +
        'per-instance and reset on cold starts. Set RATE_LIMIT_PROVIDER=redis.'
    )
  }

  return checkMemoryLimit(key, endpoint)
}
