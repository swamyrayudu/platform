import { useCallback, useState } from 'react';

// These endpoints return full arrays; reveal rows in batches without inventing
// server pagination. The parent list still virtualizes every visible row.
export function useProgressiveList<T>(items: T[], resetKey: string, batchSize = 12) {
  const [window, setWindow] = useState({key:resetKey, size:batchSize});
  // Reset even if the user switches back before requesting another batch.
  if (window.key !== resetKey) setWindow({key:resetKey, size:batchSize});
  const size = window.key === resetKey ? window.size : batchSize;
  const loadMore = useCallback(() => setWindow(previous => ({
    key:resetKey,
    size:Math.min(items.length, (previous.key === resetKey ? previous.size : batchSize) + batchSize),
  })), [items.length, resetKey, batchSize]);
  return {items:items.slice(0,size), hasMore:size < items.length, loadMore};
}
