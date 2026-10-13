'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { readCsvFile } from '@/lib/questions/csv-upload'

export default function CsvFilePicker({ value, disabled, onLoad, onBusyChange }: {
  value: string
  disabled: boolean
  onLoad: (text: string) => Promise<void>
  onBusyChange: (busy: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const reading = useRef(false)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<{ name: string; text: string } | null>(null)
  const [error, setError] = useState<{ message: string; forValue: string } | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function loadFile(file: File) {
    if (disabled || reading.current) return
    reading.current = true
    setLoading(true)
    setError(null)
    onBusyChange(true)
    try {
      const text = await readCsvFile(file)
      if (!mounted.current) return
      setSource({ name: file.name, text })
      await onLoad(text)
    } catch (err) {
      if (mounted.current) setError({ message: err instanceof Error ? err.message : 'Could not read the CSV file.', forValue: value })
    } finally {
      reading.current = false
      if (mounted.current) {
        setLoading(false)
        onBusyChange(false)
      }
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    // The same file can be selected again after editing it on disk.
    event.currentTarget.value = ''
    if (file) void loadFile(file)
  }

  function loadTransfer(files: FileList, text: string, sourceName: string) {
    if (disabled || reading.current) return
    if (files.length > 1) {
      setError({ message: 'Drop or paste one CSV file at a time.', forValue: value })
      return
    }
    if (files[0]) void loadFile(files[0])
    else if (text.trim()) void loadFile(new File([text], sourceName, { type: 'text/csv' }))
  }

  function acceptsDrag(event: DragEvent<HTMLDivElement>) {
    return Array.from(event.dataTransfer.types).some((type) => type === 'Files' || type === 'text/plain')
  }

  function dragEnter(event: DragEvent<HTMLDivElement>) {
    if (!acceptsDrag(event)) return
    event.preventDefault()
    if (disabled || reading.current) return
    dragDepth.current++
    setDragging(true)
  }

  function dragOver(event: DragEvent<HTMLDivElement>) {
    if (!acceptsDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = disabled || reading.current ? 'none' : 'copy'
  }

  function dragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setDragging(false)
    loadTransfer(event.dataTransfer.files, event.dataTransfer.getData('text/plain'), 'dropped-text.csv')
  }

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData('text/plain')
    if (!event.clipboardData.files.length && !text.trim()) return
    event.preventDefault()
    loadTransfer(event.clipboardData.files, text, 'pasted-text.csv')
  }

  return <div className="mt-3">
    <div role="group" aria-label="CSV upload and drop area" aria-disabled={disabled || loading}
      tabIndex={disabled || loading ? -1 : 0} onDragEnter={dragEnter} onDragOver={dragOver}
      onDragLeave={dragLeave} onDrop={drop} onPaste={paste}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dragging && !disabled && !loading
        ? 'border-primary bg-primary/10' : 'border-border bg-background'} ${disabled || loading ? 'opacity-60' : ''}`}>
      <div className="text-xs">
        <p className="font-semibold text-foreground">{dragging && !disabled && !loading ? 'Drop here to load & preview' : 'Drag a CSV file here'}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Or choose a file. You can also paste or drag copied CSV text here.</p>
      </div>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" aria-label="Choose CSV file"
        disabled={disabled || loading} onChange={selectFile} />
      <button type="button" disabled={disabled || loading} onClick={() => input.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-accent disabled:opacity-50">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
        {loading ? 'Loading & previewing…' : 'Upload CSV file & preview'}
      </button>
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">CSV only · Up to 8 MB · Loads the editor and previews the rows. Review before applying.</p>
    {source && value && <p role="status" className="mt-1 break-all text-[11px] text-muted-foreground">Loaded: {source.name}{source.text !== value ? ' (edited)' : ''}</p>}
    {error && error.forValue === value && <p role="alert" className="mt-2 text-xs text-destructive">{error.message}</p>}
  </div>
}
