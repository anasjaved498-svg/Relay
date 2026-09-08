export function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function timeAgo(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v).getTime()
  if (Number.isNaN(d)) return '—'
  const diff = Date.now() - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/** Generates the next id like "proxy_03" given existing ids and a prefix. */
export function nextId(prefix: string, existingIds: string[]): string {
  let max = 0
  for (const id of existingIds) {
    const m = id.match(new RegExp(`^${prefix}_(\\d+)$`))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const n = max + 1
  return `${prefix}_${String(n).padStart(2, '0')}`
}

/**
 * Formats a duration given in minutes as a compact human-readable string:
 * under 60 minutes -> "12 min", at/above 60 minutes -> "1.4 h".
 * Returns "—" for null/undefined/NaN (i.e. no data).
 */
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return '—'
  if (minutes < 60) return `${Math.round(minutes)} min`
  return `${(minutes / 60).toFixed(1)} h`
}

export function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function isValidChannelId(v: string): boolean {
  return /^UC[\w-]{20,}$/.test(v.trim())
}

/** Strict UC-id validator per the Accounts add/manage form spec: exactly 24 chars, starts with UC. */
export function isValidYouTubeChannelId(v: string): boolean {
  const s = v.trim()
  return s.length === 24 && s.startsWith('UC')
}
