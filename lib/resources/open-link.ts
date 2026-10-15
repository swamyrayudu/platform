// ============================================================
// lib/resources/open-link.ts — Open or save a PDF from a signed link (browser)
// ============================================================
// The link is fetched after the click, and browsers block tabs opened after
// an await. So the tab is opened synchronously and pointed at the link once it
// arrives; it is closed again if the request fails.
// ============================================================

export async function openSignedLink(getUrl: () => Promise<string>, download = false): Promise<void> {
  const tab = download ? null : window.open('', '_blank')
  try {
    const url = await getUrl()
    if (download) window.location.assign(url)
    else if (tab) tab.location.href = url
    else window.location.assign(url)
  } catch (err) {
    tab?.close()
    throw err
  }
}

/** POST to a link endpoint and return its signed URL; errors carry the server's code. */
export async function requestLink(endpoint: string, body: unknown = {}): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    throw Object.assign(new Error(json.error || 'Could not open this file.'), { code: json.code as string | undefined })
  }
  return json.url as string
}
