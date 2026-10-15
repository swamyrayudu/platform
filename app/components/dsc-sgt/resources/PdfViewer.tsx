'use client'

// ============================================================
// app/components/dsc-sgt/resources/PdfViewer.tsx — Read a Resource PDF in-page
// ============================================================
// Resources are for reading on this site only: the PDF is drawn page by page
// onto canvases with pdf.js (public/pdfjs, see scripts/build-pdf-viewer-assets.mjs),
// never handed to the browser's own viewer, which offers download and print.
// There is no download or print button; right-click, Ctrl+S and Ctrl+P are
// blocked while it is open, and printing shows nothing. The link it reads
// from is valid for one minute.
//
// A website cannot stop screenshots; the app blocks them.
// ============================================================

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Minus, Plus, X } from 'lucide-react'

interface PdfPage { getViewport(o: { scale: number }): { width: number; height: number }; render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; transform?: number[] }): { promise: Promise<void> } }
interface PdfDocument { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> }
interface PdfJs { GlobalWorkerOptions: { workerSrc: string }; getDocument(o: { data: Uint8Array }): { promise: Promise<PdfDocument> } }

let loading: Promise<PdfJs> | null = null
/** pdf.js, loaded once from this site. */
function loadPdfJs(): Promise<PdfJs> {
  const w = window as unknown as { pdfjsLib?: PdfJs }
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/pdfjs/pdf.min.js'
    script.onload = () => {
      if (!w.pdfjsLib) return reject(new Error('The PDF reader did not load.'))
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'
      resolve(w.pdfjsLib)
    }
    script.onerror = () => { loading = null; reject(new Error('The PDF reader did not load. Check your connection.')) }
    document.head.appendChild(script)
  })
  return loading
}

/** One page, drawn when it scrolls near the screen. */
function Page({ doc, number, width }: { doc: PdfDocument; number: number; width: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(1.414)
  const [visible, setVisible] = useState(number <= 2)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true) }, { rootMargin: '800px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !canvas.current || width <= 0) return
    let cancelled = false
    void doc.getPage(number).then((page) => {
      if (cancelled || !canvas.current) return
      const base = page.getViewport({ scale: 1 })
      setRatio(base.height / base.width)
      const scale = width / base.width
      const viewport = page.getViewport({ scale })
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const c = canvas.current
      c.width = Math.floor(viewport.width * dpr)
      c.height = Math.floor(viewport.height * dpr)
      c.style.width = `${Math.floor(viewport.width)}px`
      c.style.height = `${Math.floor(viewport.height)}px`
      const context = c.getContext('2d')
      if (!context) return
      return page.render({ canvasContext: context, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] }).promise
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [doc, number, width, visible])

  return (
    <div ref={box} data-page={number} className="mx-auto bg-white shadow-md" style={{ width, minHeight: Math.round(width * ratio) }}>
      <canvas ref={canvas} className="block" />
    </div>
  )
}

export default function PdfViewer({ title, getUrl, onClose }: { title: string; getUrl: () => Promise<string>; onClose: () => void }) {
  const [doc, setDoc] = useState<PdfDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [frame, setFrame] = useState(0)
  const [page, setPage] = useState(1)
  const scroller = useRef<HTMLDivElement>(null)

  // Load: one-minute link → bytes → pdf.js. The link is never shown.
  useEffect(() => {
    let current = true
    let opened: PdfDocument | null = null
    Promise.all([loadPdfJs(), getUrl()])
      .then(async ([pdfjs, url]) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Could not load this file. Try again.')
        const data = new Uint8Array(await res.arrayBuffer())
        opened = await pdfjs.getDocument({ data }).promise
        if (current) setDoc(opened)
        else void opened.destroy()
      })
      .catch((err) => current && setError(err instanceof Error ? err.message : 'Could not open this file.'))
    return () => { current = false; void opened?.destroy() }
  }, [getUrl])

  // Width of the reading column, following the window.
  useEffect(() => {
    const measure = () => setFrame(Math.min((scroller.current?.clientWidth ?? 800) - 32, 900))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // While open: Escape closes; save and print shortcuts do nothing; the page cannot scroll behind.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.ctrlKey || e.metaKey) && ['s', 'p'].includes(e.key.toLowerCase())) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
  }, [onClose])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const pages = el.querySelectorAll<HTMLElement>('[data-page]')
    const middle = el.scrollTop + el.clientHeight / 3
    let n = 1
    pages.forEach((p) => { if (p.offsetTop <= middle) n = Number(p.dataset.page) })
    setPage(n)
  }

  const width = Math.max(240, Math.round(frame * zoom))
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="pdf-viewer fixed inset-0 z-[100] flex flex-col bg-neutral-800 select-none"
      onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
      {/* Printing the page shows nothing while the viewer is open. */}
      <style>{'@media print { body * { visibility: hidden !important; } }'}</style>
      <header className="flex items-center gap-2 border-b border-white/10 bg-neutral-900 px-3 py-2 text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
        {doc && <span className="hidden text-xs text-white/70 sm:inline">Page {page} of {doc.numPages}</span>}
        <button type="button" aria-label="Zoom out" disabled={zoom <= 0.6} onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40 cursor-pointer"><Minus className="h-4 w-4" /></button>
        <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" disabled={zoom >= 2.4} onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40 cursor-pointer"><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Close" onClick={onClose} className="ml-1 rounded-lg bg-white/10 p-2 hover:bg-white/20 cursor-pointer"><X className="h-4 w-4" /></button>
      </header>
      <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-auto py-4">
        {error ? (
          <p className="mx-auto mt-16 max-w-sm text-center text-sm text-white/80">{error}</p>
        ) : !doc ? (
          <p className="mt-16 flex items-center justify-center gap-2 text-sm text-white/80"><Loader2 className="h-4 w-4 animate-spin" /> Opening…</p>
        ) : (
          <div className="flex flex-col gap-4 px-4">
            {Array.from({ length: doc.numPages }, (_, i) => <Page key={i} doc={doc} number={i + 1} width={width} />)}
          </div>
        )}
      </div>
    </div>
  )
}
