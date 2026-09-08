import { useEffect, useState } from 'react'
import { ExternalLink, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Modal, Spinner, EmptyState } from '../components/ui'
import { fmtDate, startOfTodayISO } from '../lib/helpers'
import type { UploadQueueItem } from '../lib/types'

// Sits above the floating chat widget (chat root + bubble use z-index up to
// ~9998–9999), without touching the default Modal z-index used elsewhere.
const ABOVE_CHAT_Z = 10050

/**
 * Resolves the "source YouTube channel" to show for a given TikTok account
 * (Feature 3). upload_queue has no channel_id column, so we join via
 * youtube_channels.account_id. If the account has exactly one channel we use
 * its name (falling back to its channel_id if unnamed); if it has zero or
 * more than one, we can't resolve to a single channel, so we fall back to
 * showing the account_id.
 */
function useSourceChannelLabel(accountId: string | null) {
  const [label, setLabel] = useState<string>(accountId || '—')

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setLabel(accountId)
    supabase
      .from('youtube_channels')
      .select('channel_id, channel_name')
      .eq('account_id', accountId)
      .then(({ data }) => {
        if (cancelled) return
        if (data && data.length === 1) {
          setLabel(data[0].channel_name || data[0].channel_id || accountId)
        } else {
          setLabel(accountId)
        }
      })
    return () => { cancelled = true }
  }, [accountId])

  return label
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

/* ---------------- Feature 4: "Uploaded Today" modal (Stat A) ---------------- */
export function UploadedTodayModal({
  open, onClose, accountId, accountLabel,
}: { open: boolean; onClose: () => void; accountId: string; accountLabel: string }) {
  const [rows, setRows] = useState<UploadQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelLabel = useSourceChannelLabel(open ? accountId : null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    supabase
      .from('upload_queue')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'completed')
      .gte('completed_at', startOfTodayISO())
      .order('completed_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setError(error.message); setLoading(false); return }
        setRows(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, accountId])

  return (
    <Modal open={open} onClose={onClose} title={`Uploaded today — ${accountLabel}`} width={640} zIndex={ABOVE_CHAT_Z}>
      {loading ? (
        <Spinner label="Loading uploads…" />
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <AlertCircle size={20} style={{ color: 'var(--bad)' }} />
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No uploads today" />
      ) : (
        <div className="max-h-[60vh] overflow-y-auto thin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                <th className="py-2 pr-3">Video</th>
                <th className="py-2 pr-3">Source channel</th>
                <th className="py-2 pr-3">Caption</th>
                <th className="py-2 pr-3">TikTok post</th>
                <th className="py-2 pr-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t align-top" style={{ borderColor: 'var(--border-soft)' }}>
                  <td className="py-2 pr-3">
                    {r.youtube_url ? (
                      <a href={r.youtube_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs" style={{ color: 'var(--accent)' }}>
                        {truncate(r.youtube_video_id || r.youtube_url, 24)} <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>{r.youtube_video_id || '—'}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs">{channelLabel}</td>
                  <td className="py-2 pr-3 text-xs" title={r.caption || ''} style={{ color: 'var(--text-muted)' }}>{truncate(r.caption, 60) || '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.tiktok_post_id || '—'}</td>
                  <td className="py-2 pr-3 text-xs" style={{ color: 'var(--text-dim)' }}>{fmtDate(r.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

/* ---------------- Feature 5: "Failed Jobs" modal (Stat B) ---------------- */
export function FailedJobsModal({
  open, onClose, accountId, accountLabel,
}: { open: boolean; onClose: () => void; accountId: string; accountLabel: string }) {
  const [rows, setRows] = useState<UploadQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedErr, setExpandedErr] = useState<number | null>(null)
  const channelLabel = useSourceChannelLabel(open ? accountId : null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setExpandedErr(null)
    supabase
      .from('upload_queue')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setError(error.message); setLoading(false); return }
        setRows(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, accountId])

  return (
    <Modal open={open} onClose={onClose} title={`Failed jobs — ${accountLabel}`} width={680} zIndex={ABOVE_CHAT_Z}>
      {loading ? (
        <Spinner label="Loading failed jobs…" />
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <AlertCircle size={20} style={{ color: 'var(--bad)' }} />
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No failed jobs" />
      ) : (
        <div className="max-h-[60vh] overflow-y-auto thin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                <th className="py-2 pr-3">Video</th>
                <th className="py-2 pr-3">Source channel</th>
                <th className="py-2 pr-3">Error</th>
                <th className="py-2 pr-3">Retries</th>
                <th className="py-2 pr-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isLong = (r.last_error?.length || 0) > 120
                const isExpanded = expandedErr === r.id
                return (
                  <tr key={r.id} className="border-t align-top" style={{ borderColor: 'var(--border-soft)' }}>
                    <td className="py-2 pr-3">
                      {r.youtube_url ? (
                        <a href={r.youtube_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs" style={{ color: 'var(--accent)' }}>
                          {truncate(r.youtube_video_id || r.youtube_url, 24)} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>{r.youtube_video_id || '—'}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{channelLabel}</td>
                    <td className="py-2 pr-3 text-xs" style={{ color: 'var(--bad)', maxWidth: 260 }}>
                      <span title={r.last_error || ''}>
                        {isExpanded ? (r.last_error || '—') : (truncate(r.last_error, 120) || '—')}
                      </span>
                      {isLong && (
                        <button
                          className="ml-1.5 underline"
                          style={{ color: 'var(--text-dim)' }}
                          onClick={() => setExpandedErr(isExpanded ? null : r.id)}
                        >
                          {isExpanded ? 'less' : 'more'}
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.retry_count} / {r.max_retries}</td>
                    <td className="py-2 pr-3 text-xs" style={{ color: 'var(--text-dim)' }}>{fmtDate(r.updated_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
