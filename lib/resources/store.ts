// ============================================================
// lib/resources/store.ts — Resources: Storage + database (server only)
// ============================================================
// Upload is two steps so a 10 MB PDF never passes through a Vercel function
// (whose request body limit is about 4.5 MB):
//   1. createUploadUrl()  — the server picks the path and signs a one-time
//                           upload URL; the admin's browser PUTs the file.
//   2. createResource()   — the server checks the stored file really is a
//                           PDF within the limit, then records it.
// Candidates get short-lived signed URLs from createAccessUrl().
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MAX_RESOURCE_BYTES,
  type AdminResource,
  type PublicResource,
  type ResourceFields,
  type ResourceFolder,
} from './config'

export const RESOURCES_BUCKET = 'resources'

/** Signed links last an hour, long enough to read a book in the browser viewer. */
const LINK_SECONDS = 60 * 60

const BASE_COLUMNS = 'id, title, description, category, subject, medium, access, file_name, size_bytes, created_at'
const PUBLIC_COLUMNS = `${BASE_COLUMNS}, folder_id`
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, is_published, download_count`

export const isResourcePath = (path: string) => /^[0-9a-f-]{36}\.pdf$/.test(path)

/**
 * Folders arrive with migration 20261015120000_resource_folders. Until it is
 * applied, reads fall back to the columns without folder_id (every file then
 * has no folder), so Resources keep working.
 */
export function isFoldersMissing(err: unknown): boolean {
  const message = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : ''
  return /folder_id|resource_folders/i.test(message)
}
const withoutFolder = <T,>(rows: T[]) => rows.map((r) => ({ ...r, folder_id: null }))

export async function listPublishedResources(): Promise<PublicResource[]> {
  const query = (columns: string) => supabaseAdmin.from('resources')
    .select(columns).eq('is_published', true).order('created_at', { ascending: false })
  const { data, error } = await query(PUBLIC_COLUMNS)
  if (!error) return (data ?? []) as unknown as PublicResource[]
  if (!isFoldersMissing(error)) throw error
  const fallback = await query(BASE_COLUMNS)
  if (fallback.error) throw fallback.error
  return withoutFolder((fallback.data ?? []) as unknown as PublicResource[])
}

export async function listAllResources(): Promise<AdminResource[]> {
  const query = (columns: string) => supabaseAdmin.from('resources').select(columns).order('created_at', { ascending: false })
  const { data, error } = await query(ADMIN_COLUMNS)
  if (!error) return (data ?? []) as unknown as AdminResource[]
  if (!isFoldersMissing(error)) throw error
  const fallback = await query(`${BASE_COLUMNS}, is_published, download_count`)
  if (fallback.error) throw fallback.error
  return withoutFolder((fallback.data ?? []) as unknown as AdminResource[])
}

/**
 * Folders, each with how many of the given resources it holds. Candidates
 * pass their published list and see only folders with files; admins see all.
 * Empty when folders are not set up yet.
 */
export async function listFolders(resources: readonly { folder_id: string | null }[], includeEmpty: boolean): Promise<ResourceFolder[]> {
  const { data, error } = await supabaseAdmin.from('resource_folders')
    .select('id, name, description, created_at').order('name', { ascending: true })
  if (error) {
    if (isFoldersMissing(error)) return []
    throw error
  }
  const counts = new Map<string, number>()
  for (const r of resources) if (r.folder_id) counts.set(r.folder_id, (counts.get(r.folder_id) ?? 0) + 1)
  return ((data ?? []) as Omit<ResourceFolder, 'file_count'>[])
    .map((f) => ({ ...f, file_count: counts.get(f.id) ?? 0 }))
    .filter((f) => includeEmpty || f.file_count > 0)
}

const duplicateName = (err: unknown) => typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'

export async function createFolder(fields: { name: string; description: string }): Promise<ResourceFolder | { error: string }> {
  const { data, error } = await supabaseAdmin.from('resource_folders').insert(fields).select('id, name, description, created_at').single()
  if (error) {
    if (duplicateName(error)) return { error: 'A folder with this name already exists.' }
    throw error
  }
  return { ...(data as Omit<ResourceFolder, 'file_count'>), file_count: 0 }
}

export async function updateFolder(id: string, fields: { name?: string; description?: string }): Promise<Omit<ResourceFolder, 'file_count'> | { error: string } | null> {
  const { data, error } = await supabaseAdmin.from('resource_folders')
    .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select('id, name, description, created_at').maybeSingle()
  if (error) {
    if (duplicateName(error)) return { error: 'A folder with this name already exists.' }
    throw error
  }
  return (data as Omit<ResourceFolder, 'file_count'> | null) ?? null
}

/** The folder's files stay; the database moves them out of the folder. */
export async function deleteFolder(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('resource_folders').delete().eq('id', id).select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

/**
 * Write a resource row; before the folders migration, a write that only
 * says "no folder" is retried without folder_id instead of failing.
 */
async function writeWithFolder<T>(fields: Partial<ResourceFields>, write: (row: Record<string, unknown>, columns: string) => PromiseLike<{ data: T | null; error: unknown }>) {
  const first = await write({ ...fields }, ADMIN_COLUMNS)
  if (!first.error || !isFoldersMissing(first.error) || (fields.folder_id ?? null) !== null) return first
  const rest: Partial<ResourceFields> = { ...fields }
  delete rest.folder_id
  const retry = await write({ ...rest }, `${BASE_COLUMNS}, is_published, download_count`)
  return retry.data ? { ...retry, data: { ...(retry.data as object), folder_id: null } as T } : retry
}

export async function createUploadUrl(): Promise<{ path: string; signedUrl: string }> {
  const path = `${crypto.randomUUID()}.pdf`
  const { data, error } = await supabaseAdmin.storage.from(RESOURCES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw error ?? new Error('Could not create an upload link')
  return { path, signedUrl: data.signedUrl }
}

async function removeFile(path: string) {
  await supabaseAdmin.storage.from(RESOURCES_BUCKET).remove([path])
}

/** Record an uploaded PDF. A file that fails the checks is deleted. */
export async function createResource(
  path: string,
  fileName: string,
  fields: ResourceFields,
  adminId: string
): Promise<AdminResource | { error: string }> {
  const { data: info, error: infoError } = await supabaseAdmin.storage.from(RESOURCES_BUCKET).info(path)
  if (infoError || !info) return { error: 'The upload did not finish. Choose the file and upload again.' }
  const size = Number(info.size ?? 0)
  if (info.contentType !== 'application/pdf' || size < 1 || size > MAX_RESOURCE_BYTES) {
    await removeFile(path)
    return { error: 'The uploaded file is not a PDF of 10 MB or less.' }
  }
  const { data, error } = await writeWithFolder<AdminResource>(fields, (row, columns) => supabaseAdmin.from('resources').insert({
    ...row,
    storage_path: path,
    file_name: fileName.slice(0, 200),
    size_bytes: size,
    created_by: adminId,
  }).select(columns).single() as unknown as PromiseLike<{ data: AdminResource | null; error: unknown }>)
  if (error) {
    await removeFile(path)
    throw error
  }
  return data as AdminResource
}

export async function updateResource(id: string, fields: Partial<ResourceFields>): Promise<AdminResource | null> {
  const { data, error } = await writeWithFolder<AdminResource>(fields, (row, columns) => supabaseAdmin.from('resources')
    .update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).select(columns).maybeSingle() as unknown as PromiseLike<{ data: AdminResource | null; error: unknown }>)
  if (error) throw error
  return (data as AdminResource | null) ?? null
}

/** The file goes first, so a failure never leaves a row pointing at nothing. */
export async function deleteResource(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('resources').select('storage_path').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return false
  const { error: removeError } = await supabaseAdmin.storage.from(RESOURCES_BUCKET).remove([data.storage_path as string])
  if (removeError) throw removeError
  const { error: deleteError } = await supabaseAdmin.from('resources').delete().eq('id', id)
  if (deleteError) throw deleteError
  return true
}

/** Admin preview: any resource, published or not, not counted as a download. */
export async function createPreviewUrl(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('resources').select('storage_path').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: signed, error: signError } = await supabaseAdmin.storage.from(RESOURCES_BUCKET)
    .createSignedUrl(data.storage_path as string, LINK_SECONDS)
  if (signError || !signed) throw signError ?? new Error('Could not sign the link')
  return signed.signedUrl
}

/**
 * A short-lived link to a published resource, or why there is none.
 * `download` makes the browser save the file instead of opening it.
 */
export async function createAccessUrl(id: string, isPremium: boolean, download: boolean):
  Promise<{ url: string } | { error: 'NOT_FOUND' | 'PRO_REQUIRED' }> {
  const { data, error } = await supabaseAdmin.from('resources')
    .select('storage_path, file_name, access, is_published').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data || !data.is_published) return { error: 'NOT_FOUND' }
  if (data.access === 'pro' && !isPremium) return { error: 'PRO_REQUIRED' }

  const { data: signed, error: signError } = await supabaseAdmin.storage.from(RESOURCES_BUCKET)
    .createSignedUrl(data.storage_path as string, LINK_SECONDS, download ? { download: data.file_name as string } : undefined)
  if (signError || !signed) throw signError ?? new Error('Could not sign the link')
  // Counting is best effort: a failed count must not block the reader.
  await supabaseAdmin.rpc('increment_resource_downloads', { p_id: id }).then(() => undefined, () => undefined)
  return { url: signed.signedUrl }
}
