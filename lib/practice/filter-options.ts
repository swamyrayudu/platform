// ============================================================
// lib/practice/filter-options.ts — Practice filter options
// ============================================================
// Counts come from public.practice_filter_options, which aggregates in SQL.
// The old path loaded rows to count them in JavaScript and hit PostgREST's
// 1,000-row cap, so every larger bank showed a truncated topic list.
// Table choice and matching follow question-loader.ts, so each count is what
// a session can actually draw from.
//
// Until that migration is applied, countFromRows gives the same exact answer
// by paging through four light columns, as the admin topic list does.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DynamicFilterOptions, PracticeFilterState, PracticeMedium } from '@/types/practice'
import { getAllSubjectMetadata } from './subjects'
import { meaningful, practiceTablesFor } from './question-loader'

interface FilterOptionsResult {
  classes: string[]
  topics: DynamicFilterOptions['available_topics']
  difficulties: DynamicFilterOptions['available_difficulties']
  total_matching: number
  table_counts: Record<string, number>
}

interface FilterParams {
  p_tables: string[]
  p_count_tables: string[]
  p_class_levels: string[]
  p_topics: string[]
  p_subtopics: string[]
  p_difficulty: string[]
}

interface LightRow {
  class_level: string | null
  topic: string | null
  subtopic: string | null
  difficulty: string | null
}

const DEFAULT_CLASSES = ['Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10']
const PAGE_SIZE = 1000

export async function loadFilterOptions(
  filter: Partial<PracticeFilterState> & { medium: PracticeMedium }
): Promise<DynamicFilterOptions> {
  const subjects = getAllSubjectMetadata().map((meta) => ({
    meta,
    tables: practiceTablesFor(filter.medium, meta.name),
  }))
  const params: FilterParams = {
    p_tables: practiceTablesFor(filter.medium, filter.subject),
    p_count_tables: [...new Set(subjects.flatMap((s) => s.tables))],
    p_class_levels: meaningful(filter.class_levels),
    p_topics: meaningful(filter.topics),
    p_subtopics: meaningful(filter.subtopics),
    p_difficulty: meaningful(filter.difficulty),
  }

  const { data, error } = await supabaseAdmin.rpc('practice_filter_options', params)
  if (error) console.warn('[practice] practice_filter_options unavailable, counting rows:', error.message)
  const result = !error && data ? (data as FilterOptionsResult) : await countFromRows(params)

  const difficulties: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 }
  for (const d of result.difficulties) difficulties[d.name] = d.count

  return {
    medium: filter.medium,
    available_subjects: subjects.map(({ meta, tables }) => ({
      id: meta.name,
      name: meta.name,
      teluguName: meta.teluguName,
      code: meta.code,
      question_count: tables.reduce((sum, t) => sum + (result.table_counts[t] ?? 0), 0),
    })),
    available_classes: result.classes.length
      ? [...result.classes].sort((a, b) =>
          (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0))
      : DEFAULT_CLASSES,
    // Largest topics first, ties by name — the same order as the admin topic list.
    available_topics: [...result.topics].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    available_difficulties: Object.entries(difficulties).map(([name, count]) => ({ name, count })),
    total_matching_questions: result.total_matching,
  }
}

async function countActive(table: string): Promise<number> {
  const { count, error } = await supabaseAdmin.from(table)
    .select('question_id', { count: 'exact', head: true })
    .eq('is_active', true)
  if (error) throw error
  return count ?? 0
}

async function loadPage(table: string, from: number): Promise<LightRow[]> {
  const { data, error } = await supabaseAdmin.from(table)
    .select('class_level, topic, subtopic, difficulty')
    .eq('is_active', true)
    .order('question_id', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return data as LightRow[]
}

/**
 * All active rows of one table, light columns only. The pages are fetched
 * together; if rows arrived after counting, the last full page keeps going.
 */
async function loadActiveRows(table: string, expected: number): Promise<LightRow[]> {
  const pages = await Promise.all(
    Array.from({ length: Math.max(1, Math.ceil(expected / PAGE_SIZE)) }, (_, i) => loadPage(table, i * PAGE_SIZE)))
  for (let last = pages[pages.length - 1]; last.length === PAGE_SIZE;) {
    last = await loadPage(table, pages.length * PAGE_SIZE)
    pages.push(last)
  }
  return pages.flat()
}

/** Same answer as public.practice_filter_options, computed from the rows. */
async function countFromRows(p: FilterParams): Promise<FilterOptionsResult> {
  const tables = [...new Set([...p.p_count_tables, ...p.p_tables])]
  const counts = Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await countActive(t)] as const)))
  const pools = await Promise.all(p.p_tables.map((t) => loadActiveRows(t, counts[t])))

  const lower = (v: string) => v.toLowerCase()
  // Exact name, or a name the comma-joined query string split into pieces.
  const named = (value: string | null, selected: string[]) =>
    value !== null && (selected.includes(value) ||
      (value !== '' && value.split(',').every((piece) => selected.includes(piece))))

  const classes = new Set<string>()
  const topics = new Map<string, { count: number; subtopics: Set<string> }>()
  const difficulties = new Map<string, number>()
  let total = 0
  for (const row of pools.flat()) {
    if (row.class_level) classes.add(row.class_level)
    if (p.p_class_levels.length && !(row.class_level !== null &&
      p.p_class_levels.some((c) => lower(row.class_level!).includes(lower(c))))) continue

    const difficulty = row.difficulty ?? 'Medium'
    difficulties.set(difficulty, (difficulties.get(difficulty) ?? 0) + 1)
    if (row.topic !== null) {
      const entry = topics.get(row.topic) ?? { count: 0, subtopics: new Set<string>() }
      entry.count++
      if (row.subtopic) entry.subtopics.add(row.subtopic)
      topics.set(row.topic, entry)
    }
    if ((!p.p_topics.length || named(row.topic, p.p_topics)) &&
      (!p.p_subtopics.length || named(row.subtopic, p.p_subtopics)) &&
      (!p.p_difficulty.length || p.p_difficulty.some((d) => lower(d) === lower(difficulty)))) total++
  }

  return {
    classes: [...classes],
    topics: [...topics].map(([name, t]) => ({ name, count: t.count, subtopics: [...t.subtopics].sort() })),
    difficulties: [...difficulties].map(([name, count]) => ({ name, count })),
    total_matching: total,
    table_counts: counts,
  }
}
