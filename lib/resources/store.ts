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
} from './config'

export const RESOURCES_BUCKET = 'resources'

/** Signed links last an hour, long enough to read a book in the browser viewer. */
const LINK_SECONDS = 60 * 60

const PUBLIC_COLUMNS = 'id, title, description, category, subject, medium, access, file_name, size_bytes, created_at'
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, is_published, download_count`

export const isResourcePath = (path: string) => /^[0-9a-f-]{36}\.pdf$/.test(path)

export async function listPublishedResources(): Promise<PublicResource[]> {
  const { data, error } = await supabaseAdmin.from('resources')
    .select(PUBLIC_COLUMNS).eq('is_published', true).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PublicResource[]
}

export async function listAllResources(): Promise<AdminResource[]> {
  const { data, error } = await supabaseAdmin.from('resources')
    .select(ADMIN_COLUMNS).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdminResource[]
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
  const { data, error } = await supabaseAdmin.from('resources').insert({
    ...fields,
    storage_path: path,
    file_name: fileName.slice(0, 200),
    size_bytes: size,
    created_by: adminId,
  }).select(ADMIN_COLUMNS).single()
  if (error) {
    await removeFile(path)
    throw error
  }
  return data as AdminResource
}

export async function updateResource(id: string, fields: Partial<ResourceFields>): Promise<AdminResource | null> {
  const { data, error } = await supabaseAdmin.from('resources')
    .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select(ADMIN_COLUMNS).maybeSingle()
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
