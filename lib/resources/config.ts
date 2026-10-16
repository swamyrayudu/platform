// ============================================================
// lib/resources/config.ts — Resources: shared constants and checks
// ============================================================
// Used by the admin upload form, the candidate page and the API routes.
// ============================================================

/** Storage enforces the same limit (migration 20261014150000_resources). */
export const MAX_RESOURCE_BYTES = 10 * 1024 * 1024

export const RESOURCE_CATEGORIES = [
  { value: 'book', label: 'Books', teluguLabel: 'పుస్తకాలు' },
  { value: 'study_material', label: 'Study material', teluguLabel: 'స్టడీ మెటీరియల్' },
  { value: 'bit_bank', label: 'Bit banks', teluguLabel: 'బిట్ బ్యాంక్' },
  { value: 'previous_paper', label: 'Previous papers', teluguLabel: 'పాత ప్రశ్నపత్రాలు' },
  { value: 'other', label: 'Other', teluguLabel: 'ఇతరాలు' },
] as const

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]['value']
export type ResourceMedium = 'english' | 'telugu' | 'both'
export type ResourceAccess = 'free' | 'pro'

/** What candidates see — never the storage path. */
export interface PublicResource {
  id: string
  title: string
  description: string
  category: ResourceCategory
  subject: string
  medium: ResourceMedium
  access: ResourceAccess
  /** Null when the file is not in a folder (or folders are not set up yet). */
  folder_id: string | null
  file_name: string
  size_bytes: number
  created_at: string
}

export interface AdminResource extends PublicResource {
  is_published: boolean
  download_count: number
}

export interface ResourceFields {
  title: string
  description: string
  category: ResourceCategory
  subject: string
  medium: ResourceMedium
  access: ResourceAccess
  is_published: boolean
  folder_id: string | null
}

/** A group of resources, e.g. "Previous papers". */
export interface ResourceFolder {
  id: string
  name: string
  description: string
  created_at: string
  /** Files in the folder: published ones for candidates, all for admins. */
  file_count: number
  /** Candidates' Resources page: published files for each medium ("both" counts in each). */
  english_count?: number
  telugu_count?: number
}

/** Candidates' Resources page: what each view loads (GET /api/dsc-sgt/resources). */
export interface ResourcesRoot {
  folders: ResourceFolder[]
  /** Published files in no folder. */
  resources: PublicResource[]
}

const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)

/** Check an admin-entered folder name and description. */
export function checkFolder(input: unknown, partial = false): { fields: { name?: string; description?: string } } | { error: string } {
  const o = (input ?? {}) as Record<string, unknown>
  const fields: { name?: string; description?: string } = {}
  if (o.name !== undefined || !partial) {
    const name = typeof o.name === 'string' ? o.name.trim().replace(/\s+/g, ' ') : ''
    if (!name || name.length > 120) return { error: 'Give the folder a name of up to 120 characters.' }
    fields.name = name
  }
  if (o.description !== undefined || !partial) {
    const description = typeof o.description === 'string' ? o.description.trim() : ''
    if (description.length > 500) return { error: 'Keep the folder description under 500 characters.' }
    fields.description = description
  }
  return { fields }
}

const titleCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/**
 * Reading order: by title, with numbers compared as numbers, so "Day 2" comes
 * before "Day 10" and a series reads Day 1 → Day 28 whatever the upload order.
 * Same titles keep upload order.
 */
export function byReadingOrder(a: { title: string; created_at: string }, b: { title: string; created_at: string }): number {
  return titleCollator.compare(a.title, b.title) || a.created_at.localeCompare(b.created_at)
}

export function categoryLabel(value: string): string {
  return RESOURCE_CATEGORIES.find((c) => c.value === value)?.label ?? 'Other'
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Problem with a chosen file, or null. Runs in the browser before uploading. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!/\.pdf$/i.test(file.name)) return 'Choose a PDF file.'
  if (file.size === 0) return 'This file is empty.'
  if (file.size > MAX_RESOURCE_BYTES) return `PDFs must be ${formatBytes(MAX_RESOURCE_BYTES)} or smaller (this one is ${formatBytes(file.size)}).`
  return null
}

/**
 * Check admin-entered fields. `partial` allows an update that only changes
 * some of them. Returns the clean fields, or an error message.
 */
export function checkFields(input: unknown, partial = false): { fields: Partial<ResourceFields> } | { error: string } {
  const o = (input ?? {}) as Record<string, unknown>
  const fields: Partial<ResourceFields> = {}
  const has = (k: string) => o[k] !== undefined

  if (has('title') || !partial) {
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    if (!title || title.length > 200) return { error: 'Give the resource a title of up to 200 characters.' }
    fields.title = title
  }
  if (has('description') || !partial) {
    const description = typeof o.description === 'string' ? o.description.trim() : ''
    if (description.length > 2000) return { error: 'Keep the description under 2000 characters.' }
    fields.description = description
  }
  if (has('category') || !partial) {
    if (!RESOURCE_CATEGORIES.some((c) => c.value === o.category)) return { error: 'Choose a category.' }
    fields.category = o.category as ResourceCategory
  }
  if (has('subject') || !partial) {
    const subject = typeof o.subject === 'string' && o.subject.trim() ? o.subject.trim() : 'All'
    if (subject.length > 120) return { error: 'Subject is too long.' }
    fields.subject = subject
  }
  if (has('medium') || !partial) {
    const medium = o.medium ?? 'both'
    if (medium !== 'english' && medium !== 'telugu' && medium !== 'both') return { error: 'Choose a medium.' }
    fields.medium = medium
  }
  if (has('access') || !partial) {
    const access = o.access ?? 'free'
    if (access !== 'free' && access !== 'pro') return { error: 'Choose Free or Pro access.' }
    fields.access = access
  }
  if (has('is_published') || !partial) {
    fields.is_published = o.is_published === undefined ? true : o.is_published === true
  }
  if (has('folder_id') || !partial) {
    const folder = o.folder_id === undefined || o.folder_id === null || o.folder_id === '' ? null : o.folder_id
    if (folder !== null && !isUuid(folder)) return { error: 'Choose a folder.' }
    fields.folder_id = folder
  }
  return { fields }
}
