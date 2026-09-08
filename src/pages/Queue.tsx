import { useEffect, useState } from 'react'
import { RotateCcw, RefreshCw, ListChecks } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, Badge, Button, TableSkeleton, LoadError, EmptyState, Pagination, Select, useConfirm } from '../components/ui'
import { fmtDate, timeAgo } from '../lib/helpers'
import { useToast } from '../context/UiContext'
import type { UploadQueueItem, QueueStatus } from '../lib/types'

const PAGE_SIZE = 15
const STATUSES: QueueStatus[] = ['queued', 'processing', 'uploading', 'retrying', 'completed', 'failed', 'cancelled']

export default function Queue() {
  const { push } = useToast()
  const { ask, dialog } = useConfirm()
  const [rows, setRows] = useState<UploadQueueItem[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auto, setAuto] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [lastLoaded, setLastLoaded] = useState<number | null>(null)

  useEffect(() => { load() }, [page, statusFilter])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, page, statusFilter])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE
    let q = supabase.from('upload_queue').select('*', { count: 'exact' }).order('scheduled_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
    if (statusFilter) q = q.eq('status', statusFilter)
    const { data, count, error } = await q
    if (error) { setError(error.message); setLoading(false); return }
    setError(null)
    setRows(data || [])
    setCount(count || 0)
    setLastLoaded(Date.now())
    setLoading(false)
  }

  function retry(row: UploadQueueItem) {
    ask('Retry this upload?', `Requeue ${row.youtube_video_id} for upload?`, async () => {
      const { error } = await supabase.from('upload_queue').update({ status: 'queued', scheduled_at: new Date().toISOString() }).eq('job_id', row.job_id)
      if (error) { push(error.message, 'bad'); return }
      push('Job requeued.', 'ok')
      load()
    })
  }

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Upload queue"
        subtitle={`${count} job${count !== 1 ? 's' : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {auto && lastLoaded && (
              <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                Updated {Math.max(0, Math.round((now - lastLoaded) / 1000))}s ago
              </span>
            )}
            <Select value={statusFilter} onChange={e => { setPage(1); setStatusFilter(e.target.value) }} className="!w-40">
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Button size="sm" variant={auto ? 'primary' : 'subtle'} onClick={() => setAuto(a => !a)}>
              <RefreshCw size={13} /> Auto-refresh {auto ? 'on' : 'off'}
            </Button>
          </div>
        }
      />
      {/* pb-24 clears the floating chat launcher so bottom pagination stays reachable */}
      <main className="p-4 pb-24 sm:p-8">
        <Card>
          {loading && rows.length === 0 ? <TableSkeleton cols={7} /> : error ? <LoadError message={error} onRetry={load} /> : rows.length === 0 ? (
            <EmptyState
              icon={<ListChecks size={28} />}
              title={statusFilter ? 'No jobs match this filter' : 'Queue is empty'}
              hint={statusFilter ? 'Try a different status.' : 'Uploads will appear here once scheduled.'}
              action={statusFilter ? <Button size="sm" variant="subtle" onClick={() => { setPage(1); setStatusFilter('') }}>Clear filter</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                    <th className="py-2 pr-3">Video</th>
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Retries</th>
                    <th className="py-2 pr-3">Scheduled</th>
                    <th className="py-2 pr-3">Last error</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.job_id} className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="py-2.5 pr-3">
                        <a href={r.youtube_url || '#'} target="_blank" rel="noreferrer" className="font-mono text-xs" style={{ color: 'var(--accent)' }}>
                          {r.youtube_video_id}
                        </a>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs">{r.account_id}</td>
                      <td className="py-2.5 pr-3"><Badge value={r.status} /></td>
                      <td className="py-2.5 pr-3 font-mono text-xs">{r.retry_count}/{r.max_retries}</td>
                      <td className="py-2.5 pr-3 text-xs" style={{ color: 'var(--text-muted)' }} title={fmtDate(r.scheduled_at)}>{timeAgo(r.scheduled_at)}</td>
                      <td className="max-w-[220px] truncate py-2.5 pr-3 text-xs" title={r.last_error || ''} style={{ color: 'var(--bad)' }}>{r.last_error || '—'}</td>
                      <td className="py-2.5 pr-3">
                        {r.status === 'failed' && (
                          <Button size="sm" variant="subtle" onClick={() => retry(r)}><RotateCcw size={12} /> Retry</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </Card>
      </main>
      {dialog}
    </div>
  )
}
