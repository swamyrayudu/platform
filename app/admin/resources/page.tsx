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
import { ArrowLeft, Eye, EyeOff, ExternalLink, Library, Loader2, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react'
import { SUBJECT_LIST } from '@/app/components/dsc-sgt/practice/setup/SubjectSelector'
import {
  RESOURCE_CATEGORIES, categoryLabel, fileProblem, formatBytes,
  type AdminResource, type ResourceFields,
} from '@/lib/resources/config'
import { openSignedLink, requestLink } from '@/lib/resources/open-link'

const EMPTY: ResourceFields = {
  title: '', description: '', category: 'study_material', subject: 'All', medium: 'both', access: 'free', is_published: true,
}

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

function FieldsForm({ value, onChange }: { value: ResourceFields; onChange: (v: ResourceFields) => void }) {
  const set = <K extends keyof ResourceFields>(k: K, v: ResourceFields[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={`${label} sm:col-span-2`}>Title
        <input className={`${input} mt-1`} value={value.title} maxLength={200} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label className={`${label} sm:col-span-2`}>Description (optional)
        <textarea className={`${input} mt-1`} rows={2} maxLength={2000} value={value.description} onChange={(e) => set('description', e.target.value)} />
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

  const show = useCallback((data: { resources: AdminResource[] }) => setResources(data.resources), [])
  const fail = useCallback((err: unknown) => {
    if ((err as { code?: string })?.code === 'NOT_SET_UP') setNotSetUp(true)
    else setError(err instanceof Error ? err.message : 'Could not load resources.')
  }, [])
  useEffect(() => {
    let current = true
    api<{ resources: AdminResource[] }>('/api/admin/resources')
      .then((d) => current && show(d))
      .catch((e) => current && fail(e))
    return () => {
      current = false
    }
  }, [show, fail])
  const reload = () => {
    setError(null)
    api<{ resources: AdminResource[] }>('/api/admin/resources').then(show).catch(fail)
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

      <section className="mb-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium text-foreground">Upload a PDF</h2>
        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-muted/20 p-5 text-center hover:border-primary/50">
          <Upload className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium text-foreground">{file ? file.name : 'Choose a PDF (max 10 MB)'}</span>
          {file && <span className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => { chooseFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
        </label>
        <FieldsForm value={fields} onChange={setFields} />
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

      <div className="space-y-3">
        {resources?.map((r) => (
          <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
            {editing?.id === r.id ? (
              <div>
                <FieldsForm value={editing.fields} onChange={(f) => setEditing({ id: r.id, fields: f })} />
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
                    onClick={() => setEditing({ id: r.id, fields: { title: r.title, description: r.description, category: r.category, subject: r.subject, medium: r.medium, access: r.access, is_published: r.is_published } })}
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
