// ============================================================
// lib/mock-tests/cache.ts — Redis Cache Layer for Grand Mocks
// ============================================================
// Uses @upstash/redis (already in package.json) with automatic
// in-memory fallback when Redis credentials are not configured.
//
// SECURITY: The cached payload NEVER includes correct_answer
// or explanation. Those live only in the internal answer key,
// which is stored under a separate key and never served.
//
// IDENTITY: questions are keyed by question_uid (`table:question_id`),
// because a bare question_id is not unique across the question bank.
//
// KEY NAMING CONVENTION:
//   mock:test:{id}:v{version}:meta           — test definition
//   mock:test:{id}:v{version}:questions      — all client-safe questions
//   mock:test:{id}:v{version}:key            — answer key (SERVER ONLY)
//   mock:test:{id}:v{version}:chunk:{s}:{l}  — chunked slice cache
//
// CACHE WARMING:
//   Called at publish time. Pre-populates all above keys so the
//   first student never triggers a DB read (cache-miss scenario).
//
// CACHE STAMPEDE PREVENTION:
//   A simple Set<string> of in-flight lock keys prevents multiple
//   concurrent cache-miss requests from hitting PostgreSQL simultaneously.
// ============================================================

import type { ClientSafeMockQuestion, AnswerKeyEntry } from '@/types/mock-tests'
import type { GeneratedMapping } from './generator'

// ---- Redis client setup ----------------------------------------

let redis: any = null
let redisReady = false

async function getRedisClient(): Promise<any | null> {
  if (redisReady) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // No Redis configured — use in-memory fallback silently
    redisReady = true
    return null
  }

  try {
    const { Redis } = await import('@upstash/redis')
    redis = new Redis({ url, token })
    redisReady = true
    return redis
  } catch (err) {
    console.warn('[MockCache] Failed to initialize Redis, using in-memory fallback:', err)
    redisReady = true
    return null
  }
}

// ---- In-memory LRU/TTL fallback --------------------------------
// Used when Redis is unavailable (dev environment, no credentials).
// Entries expire after MAX_AGE_MS — prevents stale data accumulation.

const MAX_AGE_MS = 6 * 60 * 60 * 1000 // 6 hours
const MAX_CACHE_ENTRIES = 500

interface MemCacheEntry {
  value: string
  expiresAt: number
}

const memCache = new Map<string, MemCacheEntry>()

function memGet(key: string): string | null {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key)
    return null
  }
  return entry.value
}

function memSet(key: string, value: string, ttlSeconds: number): void {
  // Evict oldest 20% if at capacity
  if (memCache.size >= MAX_CACHE_ENTRIES) {
    let count = 0
    const evictCount = Math.floor(MAX_CACHE_ENTRIES * 0.2)
    for (const k of memCache.keys()) {
      if (count >= evictCount) break
      memCache.delete(k)
      count++
    }
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

function memDel(key: string): void {
  // Support prefix pattern deletion: key* matching
  if (key.endsWith('*')) {
    const prefix = key.slice(0, -1)
    for (const k of memCache.keys()) {
      if (k.startsWith(prefix)) memCache.delete(k)
    }
  } else {
    memCache.delete(key)
  }
}

// ---- Generic get/set/del wrappers ------------------------------

const TTL_META = 24 * 60 * 60       // 24 hours
const TTL_QUESTIONS = 24 * 60 * 60  // 24 hours (re-warm on publish)
const TTL_KEY = 24 * 60 * 60        // 24 hours
const TTL_CHUNK = 6 * 60 * 60       // 6 hours (chunks re-built from full cache)

async function cacheGet(cacheKey: string): Promise<string | null> {
  const r = await getRedisClient()
  if (r) {
    try {
      const val = await r.get(cacheKey)
      return val ? (typeof val === 'string' ? val : JSON.stringify(val)) : null
    } catch (err) {
      console.warn('[MockCache] Redis GET error, falling back to memory:', err)
    }
  }
  return memGet(cacheKey)
}

async function cacheSet(cacheKey: string, value: string, ttl: number): Promise<void> {
  const r = await getRedisClient()
  if (r) {
    try {
      await r.set(cacheKey, value, { ex: ttl })
      return
    } catch (err) {
      console.warn('[MockCache] Redis SET error, falling back to memory:', err)
    }
  }
  memSet(cacheKey, value, ttl)
}

async function cacheDel(keyPattern: string): Promise<void> {
  const r = await getRedisClient()
  if (r) {
    try {
      // Upstash doesn't support SCAN+DEL pattern directly, so we delete known key patterns
      // This is intentional — we know the exact keys at publish time
      await r.del(keyPattern)
      return
    } catch (err) {
      console.warn('[MockCache] Redis DEL error:', err)
    }
  }
  memDel(keyPattern)
}

// ---- Key builders -----------------------------------------------

export function buildMetaKey(testId: string, version: number) {
  return `mock:test:${testId}:v${version}:meta`
}

export function buildQuestionsKey(testId: string, version: number) {
  return `mock:test:${testId}:v${version}:questions`
}

export function buildAnswerKeyKey(testId: string, version: number) {
  return `mock:test:${testId}:v${version}:key`
}

export function buildChunkKey(testId: string, version: number, start: number, limit: number) {
  return `mock:test:${testId}:v${version}:chunk:${start}:${limit}`
}

// ---- In-flight lock (stampede prevention) ----------------------
// When multiple concurrent requests miss the cache simultaneously,
// only the first one rebuilds — others wait briefly then retry.

const inFlightLocks = new Set<string>()
const LOCK_WAIT_MS = 150
const LOCK_MAX_RETRIES = 10

async function withSingleFlight<T>(
  lockKey: string,
  fn: () => Promise<T>
): Promise<T> {
  if (inFlightLocks.has(lockKey)) {
    // Wait and let the first request populate
    for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
      await new Promise((r) => setTimeout(r, LOCK_WAIT_MS))
      if (!inFlightLocks.has(lockKey)) break
    }
    // After waiting, re-run fn — result may now be in cache
  }

  inFlightLocks.add(lockKey)
  try {
    return await fn()
  } finally {
    inFlightLocks.delete(lockKey)
  }
}

// ---- Cache Payload Builders -------------------------------------

/**
 * Convert GeneratedMapping[] into client-safe questions (no correct_answer).
 * Also returns the server-side answer key separately.
 */
export function buildCachePayloads(mappings: GeneratedMapping[]): {
  clientQuestions: ClientSafeMockQuestion[]
  answerKey: AnswerKeyEntry[]
} {
  const clientQuestions: ClientSafeMockQuestion[] = mappings.map((m) => ({
    question_uid: m.question_uid,
    question_id: m.question_id,
    question_number: m.question_number,
    section_id: m.section_id,
    section_name: m.section_name,
    subject: m.subject || '',
    chapter: m.chapter || null,
    topic: m.topic || '',
    subtopic: m.subtopic || null,
    difficulty: m.difficulty || 'Medium',
    question_type: m.question_type || 'MCQ',
    question: m.question,
    option_a: m.option_a,
    option_b: m.option_b,
    option_c: m.option_c,
    option_d: m.option_d,
    marks: m.marks,
    // Deliberately absent: correct_answer, explanation
  }))

  const answerKey: AnswerKeyEntry[] = mappings.map((m) => ({
    question_uid: m.question_uid,
    question_id: m.question_id,
    question_number: m.question_number,
    correct_answer: (m.correct_answer || 'A').trim().toUpperCase(),
    explanation: m.explanation || null,
    marks: m.marks,
  }))

  return { clientQuestions, answerKey }
}

// ---- Public Cache API -------------------------------------------

/**
 * Warm the Redis cache for a published Grand Mock.
 * Called once at publish time. Stores:
 *  - Full client-safe question array (no answers)
 *  - Internal answer key (separate key, server-side only)
 *
 * Returns true on success.
 */
export async function warmMockTestCache(
  testId: string,
  version: number,
  mappings: GeneratedMapping[]
): Promise<boolean> {
  try {
    const { clientQuestions, answerKey } = buildCachePayloads(mappings)
    const questionsKey = buildQuestionsKey(testId, version)
    const keyKey = buildAnswerKeyKey(testId, version)

    await Promise.all([
      cacheSet(questionsKey, JSON.stringify(clientQuestions), TTL_QUESTIONS),
      cacheSet(keyKey, JSON.stringify(answerKey), TTL_KEY),
    ])

    console.log(`[MockCache] Warmed cache for mock ${testId} v${version}: ${mappings.length} questions`)
    return true
  } catch (err) {
    console.error('[MockCache] Cache warming failed:', err)
    return false
  }
}

/**
 * Get all client-safe questions for a test from cache.
 * If not cached, returns null (caller must fetch from DB and re-warm).
 */
export async function getCachedQuestions(
  testId: string,
  version: number
): Promise<ClientSafeMockQuestion[] | null> {
  const key = buildQuestionsKey(testId, version)
  const raw = await cacheGet(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ClientSafeMockQuestion[]
  } catch {
    return null
  }
}

/**
 * Get a chunk of client-safe questions (for chunked delivery).
 *
 * Reads from the full cached array and returns the requested slice.
 * start is 1-indexed (question_number).
 * This avoids storing separate chunk entries in Redis.
 */
export async function getCachedQuestionChunk(
  testId: string,
  version: number,
  start: number,
  limit: number
): Promise<ClientSafeMockQuestion[] | null> {
  const allQuestions = await getCachedQuestions(testId, version)
  if (!allQuestions) return null

  // Sort by question_number to guarantee correct order
  const sorted = allQuestions.slice().sort((a, b) => a.question_number - b.question_number)

  // Convert 1-indexed start to 0-indexed array slice
  const fromIdx = Math.max(0, start - 1)
  const slice = sorted.slice(fromIdx, fromIdx + limit)
  return slice
}

/**
 * Get the internal answer key (server-side only).
 * NEVER expose this to the client.
 */
export async function getCachedAnswerKey(
  testId: string,
  version: number
): Promise<Map<string, AnswerKeyEntry> | null> {
  const key = buildAnswerKeyKey(testId, version)
  const raw = await cacheGet(key)
  if (!raw) return null
  try {
    const entries = JSON.parse(raw) as AnswerKeyEntry[]
    const map = new Map<string, AnswerKeyEntry>()
    // Keyed by question_uid: a bare question_id is ambiguous across tables and
    // would let one section's key grade another section's answer.
    entries.forEach((e) => map.set(e.question_uid, e))
    return map
  } catch {
    return null
  }
}

/**
 * Invalidate all cache entries for a test version.
 * Called when a test is unpublished, archived, or re-generated.
 */
export async function invalidateMockTestCache(testId: string, version: number): Promise<void> {
  const keys = [
    buildQuestionsKey(testId, version),
    buildAnswerKeyKey(testId, version),
    buildMetaKey(testId, version),
  ]
  await Promise.all(keys.map((k) => cacheDel(k)))
  // Also clear in-memory patterns
  memDel(`mock:test:${testId}:v${version}:*`)
}

/**
 * Safe cache-miss fallback with single-flight protection.
 * Fetches from DB, populates cache, returns result.
 * Prevents cache stampede when multiple users miss simultaneously.
 */
export async function getQuestionsWithFallback(
  testId: string,
  version: number,
  dbFetcher: () => Promise<GeneratedMapping[] | null>
): Promise<ClientSafeMockQuestion[] | null> {
  // 1. Try cache first
  const cached = await getCachedQuestions(testId, version)
  if (cached) return cached

  // 2. Cache miss — use single-flight to prevent stampede
  const lockKey = `lock:mock:${testId}:v${version}`
  return withSingleFlight(lockKey, async () => {
    // Re-check after acquiring lock (another request may have populated cache)
    const rechecked = await getCachedQuestions(testId, version)
    if (rechecked) return rechecked

    // 3. Fetch from DB
    const mappings = await dbFetcher()
    if (!mappings || mappings.length === 0) return null

    // 4. Warm cache
    await warmMockTestCache(testId, version, mappings)

    // 5. Return client-safe questions
    const { clientQuestions } = buildCachePayloads(mappings)
    return clientQuestions
  })
}

// ---- Cache statistics (admin) -----------------------------------

export interface CacheStats {
  redis_available: boolean
  memory_cache_entries: number
}

export async function getCacheStats(): Promise<CacheStats> {
  const r = await getRedisClient()
  return {
    redis_available: r !== null,
    memory_cache_entries: memCache.size,
  }
}
