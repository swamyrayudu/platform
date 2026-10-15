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
  return { fields }
}
