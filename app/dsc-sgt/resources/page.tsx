'use client'

// ============================================================
// app/dsc-sgt/resources/page.tsx — Books, study material, bit banks (PDFs)
// ============================================================
// The top level loads only the folders (with counts) and the files in no
// folder; a folder's files load when it is opened (?folder=<id>, so the
// browser's back button and the page's Back both return here). Search on the
// top level looks in every folder; inside a folder it filters that folder.
// PDFs are read in-page (PdfViewer), never downloaded or handed to the
// browser's own viewer.
// ============================================================

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, ChevronRight, Crown, FileText, Folder, Library, Search, X } from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
import {
  RESOURCE_CATEGORIES, categoryLabel, formatBytes,
  type PublicResource, type ResourceFolder, type ResourcesRoot,
} from '@/lib/resources/config'
import { requestLink } from '@/lib/resources/open-link'
import PdfViewer from '@/app/components/dsc-sgt/resources/PdfViewer'

type Medium = 'all' | 'telugu' | 'english'
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const PATH = '/dsc-sgt/resources'

async function getJson<T>(query: string): Promise<T> {
  const res = await fetch(`/api/dsc-sgt/resources?${query}`)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) throw Object.assign(new Error(json.error || 'Could not load resources.'), { code: json.code })
  return json as T
}

const fitsMedium = (r: PublicResource, medium: Medium) => medium === 'all' || r.medium === 'both' || r.medium === medium
const mediumLabel = (m: PublicResource['medium']) => (m === 'both' ? 'Telugu & English' : m === 'telugu' ? 'Telugu' : 'English')
const countFor = (f: ResourceFolder, medium: Medium) =>
  medium === 'english' ? f.english_count ?? f.file_count : medium === 'telugu' ? f.telugu_count ?? f.file_count : f.file_count
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function ResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = use(searchParams)
  const folderId = typeof query.folder === 'string' ? query.folder : null
  const router = useRouter()
  const { isPremium, openModal } = usePremium()

  const [root, setRoot] = useState<ResourcesRoot | null>(null)
  const [rootError, setRootError] = useState<string | null>(null)
  const [notSetUp, setNotSetUp] = useState(false)
  // Opened folders stay loaded, so going back and in again is instant.
  const [folders, setFolders] = useState<Record<string, { folder: ResourceFolder; resources: PublicResource[] }>>({})
  const [folderError, setFolderError] = useState<{ id: string; message: string } | null>(null)
  const [medium, setMedium] = useState<Medium>('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ term: string; resources: PublicResource[] } | null>(null)
  const [viewing, setViewing] = useState<{ id: string; title: string } | null>(null)
  // Whether a folder was opened from this page, so Back can use the browser history.
  const openedHere = useRef(false)

  useEffect(() => {
    let current = true
    getJson<ResourcesRoot>('view=root')
      .then((r) => current && setRoot({ folders: r.folders ?? [], resources: r.resources ?? [] }))
      .catch((err) => {
        if (!current) return
        if (err?.code === 'NOT_SET_UP') setNotSetUp(true)
        else setRootError(err instanceof Error ? err.message : 'Could not load resources.')
      })
    return () => {
      current = false
    }
  }, [])

  const loaded = folderId ? folders[folderId] : undefined
  useEffect(() => {
    if (!folderId || loaded) return
    let current = true
    getJson<{ folder: ResourceFolder; resources: PublicResource[] }>(`folder=${encodeURIComponent(folderId)}`)
      .then((r) => current && setFolders((prev) => ({ ...prev, [folderId]: { folder: r.folder, resources: r.resources } })))
      .catch((err) => current && setFolderError({ id: folderId, message: err instanceof Error ? err.message : 'Could not load this folder.' }))
    return () => {
      current = false
    }
  }, [folderId, loaded])

  // Top-level search asks the server (every folder); typing pauses before the request.
  const term = search.trim()
  useEffect(() => {
    if (folderId || term.length < 2) return
    let current = true
    const timer = setTimeout(() => {
      getJson<{ resources: PublicResource[] }>(`search=${encodeURIComponent(term)}`)
        .then((r) => current && setResults({ term, resources: r.resources ?? [] }))
        .catch(() => current && setResults({ term, resources: [] }))
    }, 300)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [folderId, term])

  const openFolder = (id: string) => {
    openedHere.current = true
    setCategory('all')
    setSearch('')

    router.push(`${PATH}?folder=${encodeURIComponent(id)}`)
  }
  const back = () => {
    setSearch('')
    setCategory('all')
    if (openedHere.current) {
      openedHere.current = false
      router.back()
    } else router.replace(PATH)
  }

  const open = (r: PublicResource) => {
    if (r.access === 'pro' && !isPremium) openModal('resources')
    else setViewing({ id: r.id, title: r.title })
  }
  const viewingId = viewing?.id
  const getUrl = useCallback(() => requestLink(`/api/dsc-sgt/resources/${viewingId}/link`), [viewingId])
  const closeViewer = useCallback(() => setViewing(null), [])
  const folderName = useMemo(() => new Map((root?.folders ?? []).map((f) => [f.id, f.name])), [root])

  const fileList = (list: PublicResource[], showFolder = false) => (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {list.map((r) => (
        <FileRow key={r.id} resource={r} locked={r.access === 'pro' && !isPremium} onOpen={() => open(r)}
          folder={showFolder && r.folder_id ? folderName.get(r.folder_id) : undefined} />
      ))}
    </div>
  )

  // ── One folder ──────────────────────────────────────────────
  let body: React.ReactNode
  if (folderId) {
    const files = (loaded?.resources ?? []).filter((r) => fitsMedium(r, medium))
    const searched = term ? files.filter((r) => `${r.title} ${r.description}`.toLowerCase().includes(term.toLowerCase())) : files
    const present = RESOURCE_CATEGORIES.filter((c) => searched.some((r) => r.category === c.value))
    const shown = searched.filter((r) => category === 'all' || r.category === category)
    const name = loaded?.folder.name ?? root?.folders.find((f) => f.id === folderId)?.name
    const failed = folderError?.id === folderId ? folderError.message : null
    body = (
      <>
        <div className="mb-5 flex items-start gap-3">
          <button type="button" onClick={back} aria-label="Back to resources"
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-accent cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Resources</p>
            <h2 className="truncate text-lg font-bold text-foreground sm:text-xl">{name ?? 'Folder'}</h2>
            {loaded && <p className="mt-0.5 text-xs text-muted-foreground">{plural(files.length, 'file')}{loaded.folder.description ? ` · ${loaded.folder.description}` : ''}</p>}
          </div>
        </div>

        {failed && !loaded && (
          <Notice>
            {failed}{' '}
            <button type="button" onClick={back} className="font-semibold text-primary hover:underline cursor-pointer">Back to resources</button>
          </Notice>
        )}
        {!loaded && !failed && <FileSkeleton />}
        {loaded && (
          <>
            {present.length > 1 && (
              <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
                <Chip active={category === 'all'} onClick={() => setCategory('all')}>All · {searched.length}</Chip>
                {present.map((c) => (
                  <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
                    {c.label} · {searched.filter((r) => r.category === c.value).length}
                  </Chip>
                ))}
              </div>
            )}
            {shown.length === 0
              ? <Notice>{files.length === 0 ? 'No files in this folder for this medium yet.' : 'No files match your search.'}</Notice>
              : fileList(shown)}
          </>
        )}
      </>
    )
  } else if (root) {
    // ── Top level: search results, or folders then loose files ──
    const searching = term.length >= 2
    if (searching) {
      const ready = results?.term === term
      const found = (ready ? results.resources : []).filter((r) => fitsMedium(r, medium))
      body = (
        <section>
          <SectionTitle>{ready ? `${plural(found.length, 'result')} for “${term}”` : 'Searching…'}</SectionTitle>
          {!ready ? <FileSkeleton /> : found.length === 0 ? <Notice>Nothing matches “{term}”. Try a shorter word.</Notice> : fileList(found, true)}
        </section>
      )
    } else {
      const folderCards = root.folders.map((f) => ({ ...f, count: countFor(f, medium) })).filter((f) => f.count > 0)
      const loose = root.resources.filter((r) => fitsMedium(r, medium))
      body = folderCards.length === 0 && loose.length === 0 ? (
        <Notice>{root.folders.length || root.resources.length ? 'Nothing for this medium yet.' : 'No resources yet. Check back soon.'}</Notice>
      ) : (
        <>
          {folderCards.length > 0 && (
            <section className="mb-8">
              <SectionTitle>Folders</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {folderCards.map((f) => (
                  <button key={f.id} type="button" onClick={() => openFolder(f.id)}
                    className="group flex h-[84px] items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 text-left shadow-xs transition hover:border-primary/50 hover:shadow-sm cursor-pointer">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                      <Folder className="h-5 w-5 text-amber-600" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{f.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{plural(f.count, 'file')}{f.description ? ` · ${f.description}` : ''}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {loose.length > 0 && (
            <section>
              <SectionTitle>{folderCards.length > 0 ? 'Other files' : 'Files'}</SectionTitle>
              {fileList(loose)}
            </section>
          )}
        </>
      )
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-foreground sm:text-2xl">Resources</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Books, study material, bit banks and previous papers, as PDFs.</p>
        </div>
        <div role="group" aria-label="Medium" className="inline-flex self-start rounded-xl border border-border bg-card p-1 sm:self-auto">
          {(['all', 'telugu', 'english'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMedium(m)} aria-pressed={medium === m}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition cursor-pointer ${medium === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {m === 'all' ? 'All' : m === 'telugu' ? 'Telugu' : 'English'}
            </button>
          ))}
        </div>
      </header>

      {!notSetUp && !rootError && (
        <label className="relative mb-6 block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={folderId ? 'Search in this folder' : 'Search all resources'}
            aria-label={folderId ? 'Search in this folder' : 'Search all resources'}
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      )}

      {notSetUp && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <Library className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-base font-bold">Coming soon</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Books, study material and bit banks will appear here soon.</p>
        </div>
      )}
      {rootError && <Notice>{rootError}</Notice>}
      {!notSetUp && !rootError && !root && !folderId && <FolderSkeleton />}
      {body}

      {viewing && <PdfViewer title={viewing.title} getUrl={getUrl} onClose={closeViewer} />}
    </main>
  )
}

/** One file: the same size everywhere — title in two lines at most, details in one. */
function FileRow({ resource: r, locked, onOpen, folder }: { resource: PublicResource; locked: boolean; onOpen: () => void; folder?: string }) {
  const details = [categoryLabel(r.category), r.subject === 'All' ? null : r.subject, mediumLabel(r.medium), formatBytes(r.size_bytes)]
    .filter(Boolean).join(' · ')
  return (
    <article className="flex h-full min-h-[92px] items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-xs sm:gap-4 sm:p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <FileText className="h-5 w-5 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground" title={r.title}>{r.title}</h3>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {r.access === 'pro' && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              <Crown className="h-3 w-3" /> PRO
            </span>
          )}
          <span className="truncate" title={details}>{folder ? `${folder} · ` : ''}{details}</span>
        </p>
      </div>
      {locked ? (
        <button type="button" onClick={onOpen}
          className="inline-flex h-9 w-[92px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-semibold text-white cursor-pointer">
          <Crown className="h-3.5 w-3.5" /> Unlock
        </button>
      ) : (
        <button type="button" onClick={onOpen}
          className="inline-flex h-9 w-[92px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer">
          <BookOpen className="h-3.5 w-3.5" /> Read
        </button>
      )}
    </article>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`h-9 shrink-0 rounded-xl px-3.5 text-xs font-semibold transition cursor-pointer ${active ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground'}`}>
      {children}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</h2>
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">{children}</div>
}

function FolderSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading resources">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-muted" />)}
    </div>
  )
}

function FileSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Loading files">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-muted" />)}
    </div>
  )
}
