// Server-side reads for the admin user directory. Never selects tokens or IPs.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { effectiveSubscription, toPublicUser, type DbUser } from '@/lib/auth/types'
import type { AdminUser, AdminUserSummary, AdminUsersResponse, Pagination, UserHistorySection } from '@/types/admin-users'
import { withPlayColumns } from '@/lib/payments/google-play/schema'

const BASE_PROFILE_COLUMNS = 'id, email, name, avatar_url, role, account_type, subscription_status, subscription_plan, subscription_started_at, subscription_expires_at, education_medium, learning_goals, onboarding_completed, created_at, updated_at'
// play_* exist once the Google Play migration is applied; withPlayColumns() falls back without them.
const listColumns = (withPlay: boolean) =>
  `${BASE_PROFILE_COLUMNS}${withPlay ? ', play_expires_at, play_plan' : ''}, latest_sessions:sessions(last_activity_at)`
type ProfileRow = DbUser & { latest_sessions?: { last_activity_at: string }[] }

export class AdminUsersInputError extends Error {}

export function parsePagination(params: URLSearchParams): { page: number; pageSize: number; from: number; to: number } {
  const page = Number(params.get('page') ?? '1')
  const pageSize = Number(params.get('pageSize') ?? '25')
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
    !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new AdminUsersInputError('Page must be a positive integer; page size must be between 1 and 100.')
  }
  const from = (page - 1) * pageSize
  return { page, pageSize, from, to: from + pageSize - 1 }
}

export function pagination(page: number, pageSize: number, total: number): Pagination {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
}

/** Quote PostgREST grammar and escape SQL wildcards for a literal text search. */
export function userSearchFilter(term: string): string {
  const pattern = `%${term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const fields = [`name.ilike.${quoted}`, `email.ilike.${quoted}`]
  if (isUserId(term)) fields.push(`id.eq.${term}`)
  return fields.join(',')
}

export function isUserId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function publicProfile(row: ProfileRow): AdminUser {
  return {
    ...toPublicUser(row), createdAt: row.created_at, updatedAt: row.updated_at,
    subscriptionStartedAt: row.subscription_started_at,
    lastActivityAt: row.latest_sessions?.[0]?.last_activity_at ?? null,
    isPremium: effectiveSubscription(row).active,
  }
}

export async function listAdminUsers(params: URLSearchParams): Promise<AdminUsersResponse> {
  const { page, pageSize, from, to } = parsePagination(params)
  const search = (params.get('q') ?? '').trim()
  const access = params.get('access') ?? 'all'
  const role = params.get('role') ?? 'all'
  const medium = params.get('medium') ?? 'all'
  const sort = params.get('sort') ?? 'newest'
  if (search.length > 120 || /[\u0000-\u001f]/.test(search)) throw new AdminUsersInputError('Search must be at most 120 characters.')
  if (!['all', 'premium', 'free', 'expired'].includes(access) || !['all', 'admin', 'user'].includes(role) ||
    !['all', 'english', 'telugu'].includes(medium) || !['newest', 'oldest', 'name'].includes(sort)) {
    throw new AdminUsersInputError('Invalid user filter.')
  }
  const now = new Date().toISOString()
  const { data, count, error } = await withPlayColumns((withPlay) => {
    let query = supabaseAdmin.from('users').select(listColumns(withPlay), { count: 'exact' })
    if (search) query = query.or(userSearchFilter(search))
    if (role !== 'all') query = query.eq('role', role)
    if (medium !== 'all') query = query.eq('education_medium', medium)
    // Same rule as effectiveSubscription(): web access OR Google Play access.
    const webActive = `and(account_type.eq.PREMIUM,subscription_status.eq.ACTIVE,subscription_expires_at.gt.${now})`
    const webFree = `account_type.eq.FREE,subscription_status.neq.ACTIVE,subscription_expires_at.is.null,subscription_expires_at.lte.${now}`
    const webExpired = `subscription_status.eq.EXPIRED,subscription_expires_at.lte.${now}`
    const playInactive = `or(play_expires_at.is.null,play_expires_at.lte.${now})`
    if (access === 'premium') query = withPlay ? query.or(`${webActive},play_expires_at.gt.${now}`) : query.or(webActive)
    if (access === 'free') query = withPlay ? query.or(webFree).or(playInactive) : query.or(webFree)
    if (access === 'expired') query = withPlay ? query.eq('account_type', 'PREMIUM').or(webExpired).or(playInactive) : query.eq('account_type', 'PREMIUM').or(webExpired)
    return query
      .order(sort === 'name' ? 'name' : 'created_at', { ascending: sort !== 'newest', nullsFirst: false })
      .order('id', { ascending: true })
      .order('last_activity_at', { referencedTable: 'latest_sessions', ascending: false })
      .limit(1, { referencedTable: 'latest_sessions' })
      .range(from, to)
  })
  if (error) throw error
  return { success: true, users: ((data ?? []) as unknown as ProfileRow[]).map(publicProfile),
    pagination: pagination(page, pageSize, count ?? 0) }
}

export async function getAdminUser(id: string): Promise<AdminUser | null> {
  const { data, error } = await withPlayColumns((withPlay) => supabaseAdmin.from('users').select(listColumns(withPlay)).eq('id', id)
    .order('last_activity_at', { referencedTable: 'latest_sessions', ascending: false })
    .limit(1, { referencedTable: 'latest_sessions' }).maybeSingle())
  if (error) throw error
  return data ? publicProfile(data as unknown as ProfileRow) : null
}

function countRows(table: string, id: string) {
  return supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', id)
}

async function paidTotals(id: string): Promise<{ currency: string; amount: number }[]> {
  const totals = new Map<string, number>()
  let offset = 0
  while (true) {
    const { data, error } = await supabaseAdmin.from('payment_orders').select('id, amount, currency')
      .eq('user_id', id).eq('status', 'PAID').order('id').range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    for (const row of data) totals.set(row.currency, (totals.get(row.currency) ?? 0) + Number(row.amount))
    offset += data.length
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }))
}

/** Resource-open totals. Tolerates the resource_views table not existing yet. */
async function resourceUsage(id: string): Promise<Pick<AdminUserSummary['usage'], 'resourcesOpened' | 'resourceOpens' | 'resourcesBlocked' | 'lastResourceOpenedAt'>> {
  let opened = 0, opens = 0, blocked = 0
  let last: string | null = null
  let offset = 0
  while (true) {
    const { data, error } = await supabaseAdmin.from('resource_views').select('id, open_count, blocked_count, last_opened_at')
      .eq('user_id', id).order('id').range(offset, offset + 999)
    if (error) {
      console.error('[AdminUsers] resource_views unavailable:', error.message)
      return { resourcesOpened: null, resourceOpens: null, resourcesBlocked: null, lastResourceOpenedAt: null }
    }
    if (!data?.length) break
    for (const row of data) {
      if (row.open_count > 0) opened++
      opens += Number(row.open_count)
      blocked += Number(row.blocked_count)
      if (row.last_opened_at && (!last || row.last_opened_at > last)) last = row.last_opened_at
    }
    offset += data.length
  }
  return { resourcesOpened: opened, resourceOpens: opens, resourcesBlocked: blocked, lastResourceOpenedAt: last }
}

export async function getAdminUserSummary(user: AdminUser): Promise<AdminUserSummary> {
  const id = user.id
  // Counts run in the database, independent of the current history page.
  const [counts, totals, resources] = await Promise.all([
    Promise.all([
      countRows('practice_sessions', id), countRows('practice_sessions', id).eq('status', 'completed'),
      countRows('question_attempts', id).not('selected_answer', 'is', null),
      countRows('question_attempts', id).not('selected_answer', 'is', null).eq('is_correct', true),
      countRows('mock_test_attempts', id), countRows('mock_test_attempts', id).eq('status', 'submitted'),
      countRows('devices', id), countRows('security_events', id),
      countRows('payment_orders', id), countRows('payment_orders', id).eq('status', 'PAID'),
      countRows('payment_orders', id).eq('status', 'FAILED'), countRows('payment_orders', id).eq('status', 'CREATED'),
    ]), paidTotals(id), resourceUsage(id),
  ])
  for (const result of counts) if (result.error) throw result.error
  const [practiceSessions, practiceCompleted, questionsAnswered, correctAnswers, mockAttempts, mockSubmitted,
    devices, activityEvents, orders, paid, failed, pending] = counts.map((result) => result.count ?? 0)
  // A session marked ACTIVE can still be expired or invalidated by a version reset.
  const { data: internal, error: userError } = await supabaseAdmin.from('users').select('session_version').eq('id', id).single()
  if (userError) throw userError
  const active = await countRows('sessions', id).eq('status', 'ACTIVE')
    .eq('session_version', internal.session_version).gt('expires_at', new Date().toISOString())
  if (active.error) throw active.error
  return { success: true, user, usage: { practiceSessions, practiceCompleted, questionsAnswered, correctAnswers,
    practiceAccuracy: questionsAnswered > 0 ? Math.round(correctAnswers / questionsAnswered * 1000) / 10 : null,
    mockAttempts, mockSubmitted, devices, activityEvents, activeSessions: active.count ?? 0, ...resources },
    payments: { orders, paid, failed, pending, totals } }
}

export const HISTORY_CONFIG = {
  activity: { table: 'security_events', order: 'created_at', columns: 'id, event_type, created_at' },
  practice: { table: 'practice_sessions', order: 'started_at', columns: 'id, subject, medium, topics, mode, question_count, score, accuracy_pct, status, time_spent_seconds, started_at, completed_at' },
  questions: { table: 'question_attempts', order: 'attempted_at', columns: 'id, question_id, subject, topic, difficulty, selected_answer, is_correct, time_taken_seconds, attempted_at' },
  resources: { table: 'resource_views', order: 'last_seen_at', columns: 'id, open_count, blocked_count, first_opened_at, last_opened_at, last_seen_at, last_platform, resources(title, category, subject, medium, access, file_name)' },
  mocks: { table: 'mock_test_attempts', order: 'started_at', columns: 'id, status, score, total_marks, percentage, correct_count, incorrect_count, unanswered_count, time_spent_seconds, rank, percentile, started_at, submitted_at, mock_tests(title, module_number)' },
  payments: { table: 'payment_orders', order: 'created_at', columns: 'id, plan_id, amount, currency, status, coupon_code, discount_percent, failure_reason, confirmed_via, razorpay_order_id, razorpay_payment_id, paid_at, created_at' },
  devices: { table: 'devices', order: 'last_login_at', columns: 'id, platform, user_agent, first_login_at, last_login_at, login_count' },
} as const

export async function getAdminUserHistory(id: string, section: UserHistorySection, params: URLSearchParams) {
  const { page, pageSize, from, to } = parsePagination(params)
  const config = HISTORY_CONFIG[section]
  const { data, count, error } = await supabaseAdmin.from(config.table).select(config.columns, { count: 'exact' })
    .eq('user_id', id).order(config.order, { ascending: false }).order('id', { ascending: true }).range(from, to)
  // resource_views arrives with migration 20261107130000; before that the tab is simply empty.
  if (error && section === 'resources' && (error.code === 'PGRST205' || error.code === '42P01')) {
    return { success: true, section, rows: [], pagination: pagination(page, pageSize, 0) }
  }
  if (error) throw error
  return { success: true, section, rows: data ?? [], pagination: pagination(page, pageSize, count ?? 0) }
}
