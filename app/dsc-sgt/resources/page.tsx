'use client'

// ============================================================
// app/dsc-sgt/resources/page.tsx — Books, study material, bit banks (PDFs)
// ============================================================
// Folders the admin made (e.g. "Previous papers") come first, then files in
// no folder; opening a folder shows its files. Search looks in every folder.
// PDFs are read in-page (PdfViewer), never downloaded or handed to the
// browser's own viewer.
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Crown, FileText, Folder, Library, Loader2, Search } from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
import { RESOURCE_CATEGORIES, categoryLabel, formatBytes, type PublicResource, type ResourceFolder } from '@/lib/resources/config'
import { requestLink } from '@/lib/resources/open-link'
import PdfViewer from '@/app/components/dsc-sgt/resources/PdfViewer'

type Medium = 'all' | 'telugu' | 'english'

async function fetchResources(): Promise<{ resources: PublicResource[]; folders: ResourceFolder[] }> {
  const res = await fetch('/api/dsc-sgt/resources')
  const json = await res.json()
  if (!res.ok || !json.success) throw Object.assign(new Error(json.error || 'Could not load resources.'), { code: json.code })
  return { resources: json.resources, folders: json.folders ?? [] }
}

export default function ResourcesPage() {
  const { isPremium, openModal } = usePremium()
  const [resources, setResources] = useState<PublicResource[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notSetUp, setNotSetUp] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const [medium, setMedium] = useState<Medium>('all')
  const [subject, setSubject] = useState('all')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<{ id: string; title: string } | null>(null)
  const [folders, setFolders] = useState<ResourceFolder[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)

  const fail = useCallback((err: unknown) => {
    if ((err as { code?: string })?.code === 'NOT_SET_UP') setNotSetUp(true)
    else setError(err instanceof Error ? err.message : 'Could not load resources.')
  }, [])
  useEffect(() => {
    let current = true
    fetchResources().then((r) => { if (current) { setResources(r.resources); setFolders(r.folders) } }).catch((e) => current && fail(e))
    return () => {
      current = false
    }
  }, [fail])

  // Filters other than category, so the tab counts follow medium, subject and search.
  const narrowed = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (resources ?? []).filter((r) =>
      (medium === 'all' || r.medium === 'both' || r.medium === medium) &&
      (subject === 'all' || r.subject === subject || r.subject === 'All') &&
      (!term || r.title.toLowerCase().includes(term) || r.description.toLowerCase().includes(term)))
  }, [resources, medium, subject, search])
  const searching = search.trim() !== ''
  const folder = folders.find((x) => x.id === folderId) ?? null
  // The view: one folder's files, every match while searching, or the files in no folder.
  const scoped = narrowed.filter((r) => searching || (folder ? r.folder_id === folder.id : true))
  const matching = scoped.filter((r) => category === 'all' || r.category === category)
  const shown = searching || folder ? matching : matching.filter((r) => !r.folder_id || !folders.some((x) => x.id === r.folder_id))
  const folderCards = searching || folder ? [] : folders
    .map((x) => ({ ...x, matches: matching.filter((r) => r.folder_id === x.id).length }))
    .filter((x) => x.matches > 0)
  const folderName = (id: string | null) => folders.find((x) => x.id === id)?.name
  const subjects = useMemo(
    () => [...new Set((resources ?? []).map((r) => r.subject).filter((s) => s !== 'All'))].sort(),
    [resources]
  )

  const open = (r: PublicResource) => {
    if (r.access === 'pro' && !isPremium) openModal('resources')
    else setViewing({ id: r.id, title: r.title })
  }
  const viewingId = viewing?.id
  const getUrl = useCallback(() => requestLink(`/api/dsc-sgt/resources/${viewingId}/link`), [viewingId])
  const closeViewer = useCallback(() => setViewing(null), [])

  const tab = (value: string, text: string, count: number) => (
    <button
      key={value}
      type="button"
      onClick={() => setCategory(value)}
      className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
        category === value ? 'bg-primary text-primary-foreground shadow-xs' : 'border border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      {text} <span className="opacity-70">{count}</span>
    </button>
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-primary" />
          <h1 className="text-xl font-black text-foreground sm:text-2xl">Resources</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Books, study material, bit banks and previous papers for AP DSC SGT, as PDFs.</p>
      </div>

      {notSetUp && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <Library className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-base font-bold">Coming soon</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Books, study material and bit banks will appear here soon.</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && !notSetUp && resources === null && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading resources…</p>
      )}

      {resources && (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tab('all', 'All', scoped.length)}
              {RESOURCE_CATEGORIES.map((c) => tab(c.value, c.label, scoped.filter((r) => r.category === c.value).length))}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search resources"
                  className="w-40 rounded-xl border border-border bg-card py-2 pl-8 pr-3 text-xs text-foreground"
                />
              </label>
              <select value={medium} onChange={(e) => setMedium(e.target.value as Medium)} aria-label="Medium" className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground">
                <option value="all">All mediums</option>
                <option value="telugu">Telugu</option>
                <option value="english">English</option>
              </select>
              {subjects.length > 0 && (
                <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" className="max-w-48 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground">
                  <option value="all">All subjects</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </div>

          {folder && (
            <div className="mb-4">
              <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
                <button type="button" onClick={() => setFolderId(null)} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline cursor-pointer">
                  <ChevronLeft className="h-3.5 w-3.5" /> All resources
                </button>
                <span>/</span>
                <span className="font-semibold text-foreground">{folder.name}</span>
              </nav>
              {folder.description && <p className="mt-1.5 text-xs text-muted-foreground">{folder.description}</p>}
            </div>
          )}

          {folderCards.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-bold text-foreground">Folders</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {folderCards.map((x) => (
                  <button key={x.id} type="button" onClick={() => setFolderId(x.id)}
                    className="flex items-center gap-3 rounded-3xl border border-border/80 bg-card p-4 text-left shadow-xs transition hover:border-primary/50 cursor-pointer">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10"><Folder className="h-5 w-5 text-amber-600" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{x.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{x.matches} file{x.matches === 1 ? '' : 's'}{x.description ? ` · ${x.description}` : ''}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {folderCards.length > 0 && shown.length > 0 && <h2 className="mb-2 text-sm font-bold text-foreground">Files</h2>}

          {shown.length === 0 && folderCards.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {resources.length === 0 ? 'No resources yet. Check back soon.' : folder ? 'No files in this folder match these filters.' : 'No resources match these filters.'}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => {
              const locked = r.access === 'pro' && !isPremium
              return (
                <article key={r.id} className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <FileText className="h-6 w-6 shrink-0 text-primary" />
                      <div className="flex flex-wrap justify-end gap-1">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{categoryLabel(r.category)}</span>
                        {r.access === 'pro' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                            <Crown className="h-3 w-3" /> Pro
                          </span>
                        )}
                      </div>
                    </div>
                    <h2 className="mt-3 text-sm font-bold text-foreground">{r.title}</h2>
                    {searching && folderName(r.folder_id) && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"><Folder className="h-3 w-3" /> {folderName(r.folder_id)}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {r.subject === 'All' ? 'All subjects' : r.subject} · {r.medium === 'both' ? 'Telugu & English' : r.medium === 'telugu' ? 'Telugu' : 'English'} · PDF {formatBytes(r.size_bytes)}
                    </p>
                    {r.description && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{r.description}</p>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {locked ? (
                      <button type="button" onClick={() => openModal('resources')} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-xs font-semibold text-white cursor-pointer">
                        <Crown className="h-3.5 w-3.5" /> Unlock with Pro
                      </button>
                    ) : (
                      <button type="button" onClick={() => open(r)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer">
                        <BookOpen className="h-3.5 w-3.5" /> Read
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
      {viewing && <PdfViewer title={viewing.title} getUrl={getUrl} onClose={closeViewer} />}
    </main>
  )
}
