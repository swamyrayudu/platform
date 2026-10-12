'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { parseTopicCompletion } from '@/lib/questions/topic-completion'

const STORAGE_KEY = 'admin_topic_completion_v1'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function snapshot() {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? '' } catch { return '' }
}

function serverSnapshot() { return '' }

export function readTopicCompletion() { return parseTopicCompletion(snapshot()) }

export function useTopicCompletion() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const completion = useMemo(() => parseTopicCompletion(raw), [raw])

  const setCompleted = useCallback((key: string, count: number | null): boolean => {
    // Read fresh: another tab may have marked a different topic meanwhile.
    const next = parseTopicCompletion(snapshot())
    if (count === null) delete next[key]
    else next[key] = count
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { return false }
    for (const listener of listeners) listener()
    return true
  }, [])

  return { completion, setCompleted }
}
