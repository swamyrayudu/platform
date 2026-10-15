'use client'

// ============================================================
// app/admin/resources/page.tsx — Upload and manage Resources (PDFs)
// ============================================================
// Upload: the browser asks for a signed upload URL, PUTs the PDF straight to
// Supabase Storage (with progress), then records it. See lib/resources/store.ts.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Check, Eye, EyeOff, ExternalLink, Folder, FolderPlus, Library, Loader2, Pencil, RefreshCw, Trash2, Upload, X } from 'lucide-react'
import { SUBJECT_LIST } from '@/app/components/dsc-sgt/practice/setup/SubjectSelector'
import {
  RESOURCE_CATEGORIES, categoryLabel, fileProblem, formatBytes,
  type AdminResource, type ResourceFields, type ResourceFolder,
} from '@/lib/resources/config'
import { openSignedLink, requestLink } from '@/lib/resources/open-link'

const EMPTY: ResourceFields = {
  title: '', description: '', category: 'study_material', subject: 'All', medium: 'both', access: 'free', is_published: true, folder_id: null,
}

type Listing = { resources: AdminResource[]; folders?: ResourceFolder[] }

const input = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground'
const label = 'block text-[11px] font-medium text-muted-foreground'

/** PUT the file to the signed URL, reporting progress (fetch cannot). */
function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('cacheControl', '3600')
    // Storage checks the part's type against the bucket's PDF-only rule.
    form.append('', new File([file], file.name, { type: 'application/pdf' }))
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('x-upsert', 'false')
    // The token in the URL authorises the upload; the public key satisfies Supabase's gateway.
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (publicKey) xhr.setRequestHeader('apikey', publicKey)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)))
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'))
    xhr.send(form)
  })
}

async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) throw Object.assign(new Error(json.error || 'Request failed.'), { code: json.code })
  return json as T
}

function FieldsForm({ value, onChange, folders }: { value: ResourceFields; onChange: (v: ResourceFields) => void; folders: ResourceFolder[] }) {
  const set = <K extends keyof ResourceFields>(k: K, v: ResourceFields[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={`${label} sm:col-span-2`}>Title
        <input className={`${input} mt-1`} value={value.title} maxLength={200} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label className={`${label} sm:col-span-2`}>Description (optional)
        <textarea className={`${input} mt-1`} rows={2} maxLength={2000} value={value.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <label className={`${label} sm:col-span-2`}>Folder
        <select className={`${input} mt-1`} value={value.folder_id ?? ''} onChange={(e) => set('folder_id', e.target.value || null)}>
          <option value="">No folder</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {folders.length === 0 && <span className="mt-1 block">Create folders in the Folders section above to group files, e.g. Previous papers.</span>}
      </label>
      <label className={label}>Category
        <select className={`${input} mt-1`} value={value.category} onChange={(e) => set('category', e.target.value as ResourceFields['category'])}>
          {RESOURCE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <label className={label}>Subject
        <select className={`${input} mt-1`} value={value.subject} onChange={(e) => set('subject', e.target.value)}>
          <option value="All">All subjects</option>
          {SUBJECT_LIST.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      </label>
      <label className={label}>Medium
        <select className={`${input} mt-1`} value={value.medium} onChange={(e) => set('medium', e.target.value as ResourceFields['medium'])}>
          <option value="both">Both</option>
          <option value="telugu">Telugu</option>
          <option value="english">English</option>
        </select>
      </label>
      <label className={label}>Access
        <select className={`${input} mt-1`} value={value.access} onChange={(e) => set('access', e.target.value as ResourceFields['access'])}>
          <option value="free">Free — every signed-in user</option>
          <option value="pro">Pro members only</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-foreground sm:col-span-2">
        <input type="checkbox" checked={value.is_published} onChange={(e) => set('is_published', e.target.checked)} />
        Published (visible to candidates)
      </label>
    </div>
  )
}

export default function AdminResourcesPage() {
  const router = useRouter()
  const [resources, setResources] = useState<AdminResource[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notSetUp, setNotSetUp] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fields, setFields] = useState<ResourceFields>(EMPTY)
  const [progress, setProgress] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ id: string; fields: ResourceFields } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [folders, setFolders] = useState<ResourceFolder[]>([])
  const [folderFilter, setFolderFilter] = useState<string>('all')

  const show = useCallback((data: Listing) => { setResources(data.resources); setFolders(data.folders ?? []) }, [])
  const fail = useCallback((err: unknown) => {
    if ((err as { code?: string })?.code === 'NOT_SET_UP') setNotSetUp(true)
    else setError(err instanceof Error ? err.message : 'Could not load resources.')
  }, [])
  useEffect(() => {
    let current = true
    api<Listing>('/api/admin/resources')
      .then((d) => current && show(d))
      .catch((e) => current && fail(e))
    return () => {
      current = false
    }
  }, [show, fail])
  const reload = () => {
    setError(null)
    api<Listing>('/api/admin/resources').then(show).catch(fail)
  }

  const chooseFile = (f: File | null) => {
    if (!f) return
    const problem = fileProblem(f)
    if (problem) {
      toast.error(problem)
      return
    }
    setFile(f)
    if (!fields.title) setFields((v) => ({ ...v, title: f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() }))
  }

  const upload = async () => {
    if (!file || !fields.title.trim()) return
    setProgress(0)
    try {
      const { path, signedUrl } = await api<{ path: string; signedUrl: string }>(
        '/api/admin/resources/upload-url', 'POST', { fileName: file.name, size: file.size })
      await uploadWithProgress(signedUrl, file, setProgress)
      const { resource } = await api<{ resource: AdminResource }>('/api/admin/resources', 'POST', { path, fileName: file.name, ...fields })
      setResources((prev) => [resource, ...(prev ?? [])])
      setFile(null)
      setFields(EMPTY)
      toast.success('Resource uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setProgress(null)
    }
  }

  const patch = async (id: string, change: Partial<ResourceFields>) => {
    setBusy(id)
    try {
      const { resource } = await api<{ resource: AdminResource }>(`/api/admin/resources/${id}`, 'PATCH', change)
      setResources((prev) => prev?.map((r) => (r.id === id ? resource : r)) ?? prev)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update.')
      return false
    } finally {
      setBusy(null)
    }
  }

  const remove = async (r: AdminResource) => {
    if (!window.confirm(`Delete "${r.title}"? The PDF is removed for everyone.`)) return
    setBusy(r.id)
    try {
      await api(`/api/admin/resources/${r.id}`, 'DELETE')
      setResources((prev) => prev?.filter((x) => x.id !== r.id) ?? prev)
      toast.success('Resource deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete.')
    } finally {
      setBusy(null)
    }
  }

  // Folder counts follow uploads, moves and deletes without a reload.
  const counted = folders.map((f) => ({ ...f, file_count: (resources ?? []).filter((r) => r.folder_id === f.id).length }))
  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name
  const listed = (resources ?? []).filter((r) => folderFilter === 'all' || (folderFilter === 'none' ? !r.folder_id : r.folder_id === folderFilter))

  const preview = (id: string) =>
    openSignedLink(() => requestLink(`/api/admin/resources/${id}/preview`)).catch((err) =>
      toast.error(err instanceof Error ? err.message : 'Could not open the file.'))

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <button onClick={() => router.push('/admin')} className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin dashboard
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="bloom-eyebrow">Content</p>
            <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-medium text-foreground">
              <Library className="h-5 w-5 text-primary" strokeWidth={1.7} /> Resources
            </h1>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
              Books, study material, bit banks and previous papers as PDFs, up to 10 MB each. Candidates see them
              under Resources; Pro resources open only for Pro members.
            </p>
          </div>
          <button onClick={reload} className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {notSetUp && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-foreground">
          Resources are not set up yet. Run <code>supabase/migrations/20261014150000_resources.sql</code> in the
          Supabase SQL Editor, then refresh.
        </div>
      )}

      {!notSetUp && <FoldersSection folders={counted} onChange={setFolders} />}

      <section className="mb-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium text-foreground">Upload a PDF</h2>
        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-muted/20 p-5 text-center hover:border-primary/50">
          <Upload className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium text-foreground">{file ? file.name : 'Choose a PDF (max 10 MB)'}</span>
          {file && <span className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => { chooseFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
        </label>
        <FieldsForm value={fields} onChange={setFields} folders={folders} />
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={upload}
            disabled={!file || !fields.title.trim() || progress !== null || notSetUp}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {progress !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {progress !== null ? `Uploading ${progress}%` : 'Upload'}
          </button>
          {progress !== null && (
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </section>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {!error && !notSetUp && resources === null && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      )}
      {resources?.length === 0 && <p className="text-sm text-muted-foreground">No resources yet. Upload the first PDF above.</p>}

      {!!resources?.length && folders.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">Files</h2>
          <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} aria-label="Show files in folder" className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground">
            <option value="all">All files</option>
            <option value="none">Not in a folder</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {listed.map((r) => (
          <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
            {editing?.id === r.id ? (
              <div>
                <FieldsForm value={editing.fields} onChange={(f) => setEditing({ id: r.id, fields: f })} folders={folders} />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => { if (await patch(r.id, editing.fields)) setEditing(null) }}
                    disabled={busy === r.id || !editing.fields.title.trim()}
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditing(null)} className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-foreground">{r.title}</h3>
                  <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    {folderName(r.folder_id) && <><span className="inline-flex items-center gap-1 font-medium text-foreground"><Folder className="h-3 w-3" />{folderName(r.folder_id)}</span>·</>}
                    <span>{categoryLabel(r.category)}</span>·<span>{r.subject === 'All' ? 'All subjects' : r.subject}</span>·
                    <span>{r.medium === 'both' ? 'Both mediums' : r.medium === 'telugu' ? 'Telugu' : 'English'}</span>·
                    <span>{formatBytes(r.size_bytes)}</span>·<span>{r.download_count} opens</span>
                    <span className={`rounded-full px-2 font-medium ${r.access === 'pro' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
                      {r.access === 'pro' ? 'Pro' : 'Free'}
                    </span>
                    {!r.is_published && <span className="rounded-full bg-muted px-2 font-medium">Hidden</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => preview(r.id)} title="Open PDF" className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></button>
                  <button
                    onClick={() => patch(r.id, { is_published: !r.is_published })}
                    disabled={busy === r.id}
                    title={r.is_published ? 'Hide from candidates' : 'Publish'}
                    className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {r.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => setEditing({ id: r.id, fields: { title: r.title, description: r.description, category: r.category, subject: r.subject, medium: r.medium, access: r.access, is_published: r.is_published, folder_id: r.folder_id } })}
                    title="Edit details"
                    className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(r)} disabled={busy === r.id} title="Delete" className="rounded-full border border-border p-2 text-muted-foreground hover:text-destructive disabled:opacity-50">
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}

/** Create, rename and delete folders. Deleting keeps the files, outside any folder. */
function FoldersSection({ folders, onChange }: { folders: ResourceFolder[]; onChange: (update: (prev: ResourceFolder[]) => ResourceFolder[]) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; name: string; description: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const { folder } = await api<{ folder: ResourceFolder }>('/api/admin/resources/folders', 'POST', { name, description })
      onChange((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setDescription('')
      toast.success(`Folder "${folder.name}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the folder.')
    } finally {
      setCreating(false)
    }
  }
  const save = async () => {
    if (!renaming || !renaming.name.trim()) return
    setBusy(renaming.id)
    try {
      const { folder } = await api<{ folder: ResourceFolder }>(`/api/admin/resources/folders/${renaming.id}`, 'PATCH', { name: renaming.name, description: renaming.description })
      onChange((prev) => prev.map((f) => (f.id === folder.id ? { ...f, ...folder } : f)).sort((a, b) => a.name.localeCompare(b.name)))
      setRenaming(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not rename the folder.')
    } finally {
      setBusy(null)
    }
  }
  const remove = async (f: ResourceFolder) => {
    const kept = f.file_count ? ` Its ${f.file_count} file${f.file_count === 1 ? '' : 's'} stay, outside any folder.` : ''
    if (!window.confirm(`Delete the folder "${f.name}"?${kept}`)) return
    setBusy(f.id)
    try {
      await api(`/api/admin/resources/folders/${f.id}`, 'DELETE')
      onChange((prev) => prev.filter((x) => x.id !== f.id))
      toast.success('Folder deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the folder.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-foreground">Folders</h2>
      <p className="mt-1 text-[11px] text-muted-foreground">Group files, e.g. every previous paper in a &ldquo;Previous papers&rdquo; folder. Candidates open a folder to see its files.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
        <input className={input} placeholder="Folder name, e.g. Previous papers" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create() }} />
        <input className={input} placeholder="Description (optional)" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        <button onClick={create} disabled={!name.trim() || creating} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />} New folder
        </button>
      </div>
      {folders.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {folders.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
              {renaming?.id === f.id ? (
                <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
                  <input className={input} value={renaming.name} maxLength={120} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} aria-label="Folder name" />
                  <input className={input} value={renaming.description} maxLength={500} onChange={(e) => setRenaming({ ...renaming, description: e.target.value })} aria-label="Folder description" placeholder="Description (optional)" />
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Folder className="h-4 w-4 text-primary" /> {f.name}
                    <span className="text-[11px] font-normal text-muted-foreground">{f.file_count} file{f.file_count === 1 ? '' : 's'}</span>
                  </p>
                  {f.description && <p className="mt-0.5 pl-6 text-[11px] text-muted-foreground">{f.description}</p>}
                </div>
              )}
              <div className="flex shrink-0 gap-1.5">
                {renaming?.id === f.id ? (
                  <>
                    <button onClick={save} disabled={busy === f.id || !renaming.name.trim()} title="Save" className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setRenaming(null)} title="Cancel" className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setRenaming({ id: f.id, name: f.name, description: f.description })} title="Rename" className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(f)} disabled={busy === f.id} title="Delete folder" className="rounded-full border border-border p-2 text-muted-foreground hover:text-destructive disabled:opacity-50">
                      {busy === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
