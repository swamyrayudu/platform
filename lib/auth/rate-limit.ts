// ============================================================
// lib/auth/rate-limit.ts — Adaptive rate limiter (SERVER ONLY)
// ============================================================
// memory  → in-process sliding window (single instance, dev)
// redis   → Upstash Redis (multi-instance, production)
// Controlled by RATE_LIMIT_PROVIDER env variable.
// ============================================================

type Endpoint = 'google' | 'refresh' | 'logout'

// ---- Limits per endpoint --------------------------------------
const LIMITS: Record<Endpoint, { max: number; windowMs: number }> = {
  google:  { max: 10, windowMs: 15 * 60 * 1000 }, // 10 req / 15 min
  refresh: { max: 20, windowMs: 15 * 60 * 1000 }, // 20 req / 15 min
  logout:  { max: 10, windowMs: 15 * 60 * 1000 }, // 10 req / 15 min
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

async function checkRedisLimit(
  key: string,
  endpoint: Endpoint
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // Dynamically import to avoid errors when not installed
  try {
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

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit.max, `${windowSeconds} s`),
    })

    const result = await ratelimit.limit(key)
    if (result.success) return { allowed: true }

    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
    return { allowed: false, retryAfter }
  } catch (err) {
    console.error('[RateLimit] Redis error, falling back to allow:', err)
    // Fail open on Redis errors to avoid blocking all users
    return { allowed: true }
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
export async function checkRateLimit(
  key: string,
  endpoint: Endpoint
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const provider = process.env.RATE_LIMIT_PROVIDER ?? 'memory'

  if (provider === 'redis') {
    return checkRedisLimit(key, endpoint)
  }

  return checkMemoryLimit(key, endpoint)
}
