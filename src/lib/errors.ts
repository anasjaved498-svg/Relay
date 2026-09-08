export function friendlyError(raw: unknown): string {
  if (!raw) return 'Unknown error'
  const s = String(raw)
  if (s.includes('ERR_INVALID_AUTH_CREDENTIALS')) return 'TikTok session expired — re-login needed'
  if (s.includes('ENOTFOUND') || s.includes('host.docker.internal')) return 'Worker offline — start the worker'
  if (s.includes('ECONNABORTED') || s.includes('timeout of 300000ms') || s.toLowerCase().includes('timeout')) return 'Upload timed out — file too large / slow'
  if (s.includes('does not exist for type "httpBearerAuth"')) return 'Missing credential (old error)'
  if (s.toLowerCase().includes('duplicate')) return 'Duplicate content — TikTok rejected re-upload'
  return s.length > 120 ? s.slice(0, 120) + '…' : s
}

export type RangeKey = '3d' | '7d' | 'all'

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '3d', label: 'Last 3 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'all', label: 'All time' },
]

export function rangeStart(range: RangeKey): Date | null {
  if (range === 'all') return null
  const days = range === '3d' ? 3 : 7
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export function withinRange(ts: string | null | undefined, range: RangeKey): boolean {
  const from = rangeStart(range)
  if (!from) return true
  if (!ts) return false
  return new Date(ts).getTime() >= from.getTime()
}
