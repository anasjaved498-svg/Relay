import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, Badge, Select, Textarea, Button, Spinner, LoadError, PaginationBar } from '../components/ui'
import { fmtDate } from '../lib/helpers'
import { ErrorMessage } from '../components/ErrorMessage'
import { RANGE_OPTIONS, rangeStart, type RangeKey } from '../lib/errors'
import { useToast } from '../context/UiContext'
import type { TikTokAccount, SystemLog, UploadQueueItem, AccountHealth } from '../lib/types'

const SEVERITY: Record<string, number> = { banned: 0, restricted: 1, warning: 2, healthy: 3 }

export default function Violations() {
  const { push } = useToast()
  const [accounts, setAccounts] = useState<TikTokAccount[]>([])
  const [edits, setEdits] = useState<Record<string, { health: AccountHealth; notes: string }>>({})
  const [range, setRange] = useState<RangeKey>('3d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // "Recent errors (system_logs)" panel — paginates independently of the panel below.
  const [errorLogs, setErrorLogs] = useState<SystemLog[]>([])
  const [errorCount, setErrorCount] = useState(0)
  const [errorPage, setErrorPage] = useState(1)
  const [errorPageSize, setErrorPageSize] = useState(25)
  const [errorLoading, setErrorLoading] = useState(true)
  const [errorLoadErr, setErrorLoadErr] = useState<string | null>(null)

  // "Recently failed uploads" panel — paginates independently of the panel above.
  const [failedJobs, setFailedJobs] = useState<UploadQueueItem[]>([])
  const [failedCount, setFailedCount] = useState(0)
  const [failedPage, setFailedPage] = useState(1)
  const [failedPageSize, setFailedPageSize] = useState(25)
  const [failedLoading, setFailedLoading] = useState(true)
  const [failedLoadErr, setFailedLoadErr] = useState<string | null>(null)

  useEffect(() => { loadAccounts() }, [])
  useEffect(() => { loadErrors() }, [range, errorPage, errorPageSize])
  useEffect(() => { loadFailed() }, [range, failedPage, failedPageSize])

  async function loadAccounts() {
    setLoading(true)
    const { data: acc, error: accErr } = await supabase.from('tiktok_accounts').select('*')
    if (accErr) { setError(accErr.message); setLoading(false); return }
    setError(null)

    const sorted = (acc || []).sort((a, b) => (SEVERITY[a.health_status] ?? 9) - (SEVERITY[b.health_status] ?? 9))
    setAccounts(sorted)
    const initial: Record<string, { health: AccountHealth; notes: string }> = {}
    sorted.forEach(a => { initial[a.account_id] = { health: a.health_status, notes: a.violation_notes || '' } })
    setEdits(initial)
    setLoading(false)
  }

  async function loadErrors() {
    setErrorLoading(true)
    const from = (errorPage - 1) * errorPageSize
    let q = supabase.from('system_logs').select('*', { count: 'exact' }).eq('level', 'error').order('log_ts', { ascending: false }).range(from, from + errorPageSize - 1)
    const start = rangeStart(range)
    if (start) q = q.gte('log_ts', start.toISOString())
    const { data, count, error } = await q
    if (error) { setErrorLoadErr(error.message); setErrorLoading(false); return }
    setErrorLoadErr(null)
    setErrorLogs(data || [])
    setErrorCount(count || 0)
    setErrorLoading(false)
  }

  async function loadFailed() {
    setFailedLoading(true)
    const from = (failedPage - 1) * failedPageSize
    let q = supabase.from('upload_queue').select('*', { count: 'exact' }).eq('status', 'failed').order('updated_at', { ascending: false }).range(from, from + failedPageSize - 1)
    const start = rangeStart(range)
    if (start) q = q.gte('updated_at', start.toISOString())
    const { data, count, error } = await q
    if (error) { setFailedLoadErr(error.message); setFailedLoading(false); return }
    setFailedLoadErr(null)
    setFailedJobs(data || [])
    setFailedCount(count || 0)
    setFailedLoading(false)
  }

  async function save(accountId: string) {
    const e = edits[accountId]
    const { error } = await supabase.from('tiktok_accounts').update({ health_status: e.health, violation_notes: e.notes || null }).eq('account_id', accountId)
    if (error) { push(error.message, 'bad'); return }
    push('Saved.', 'ok')
    loadAccounts()
  }

  function changeRange(v: RangeKey) {
    setRange(v)
    setErrorPage(1)
    setFailedPage(1)
  }

  function changeErrorPageSize(n: number) {
    setErrorPage(1)
    setErrorPageSize(n)
  }

  function changeFailedPageSize(n: number) {
    setFailedPage(1)
    setFailedPageSize(n)
  }

  const rangeFilter = (
    <Select value={range} onChange={e => changeRange(e.target.value as RangeKey)} className="w-36">
      {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  )

  const atRisk = accounts.filter(a => a.uploads_today >= a.daily_upload_limit)
  const flagged = accounts.filter(a => a.health_status !== 'healthy')
  const errorPageCount = Math.max(1, Math.ceil(errorCount / errorPageSize))
  const failedPageCount = Math.max(1, Math.ceil(failedCount / failedPageSize))

  return (
    <div>
      <PageHeader title="Violations & Health" subtitle="Ban-prevention overview — health status, limits, and recent failures." />
      {loading ? (
        <main className="p-4 pb-24 sm:p-8"><Card><Spinner /></Card></main>
      ) : error ? (
        <main className="p-4 pb-24 sm:p-8"><Card><LoadError message={error} onRetry={loadAccounts} /></Card></main>
      ) : (
      <main className="grid grid-cols-1 gap-4 p-4 pb-24 sm:p-8 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Accounts needing attention ({flagged.length})</h3>
          {flagged.length === 0 && <div className="text-xs" style={{ color: 'var(--text-dim)' }}>All accounts healthy.</div>}
          <div className="flex flex-col gap-3">
            {flagged.map(a => (
              <div key={a.account_id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">{a.username} <span className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>{a.account_id}</span></div>
                  <Badge value={edits[a.account_id]?.health} />
                </div>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <Select value={edits[a.account_id]?.health} onChange={e => setEdits(s => ({ ...s, [a.account_id]: { ...s[a.account_id], health: e.target.value as AccountHealth } }))}>
                    <option value="healthy">Healthy</option><option value="warning">Warning</option>
                    <option value="restricted">Restricted</option><option value="banned">Banned</option>
                  </Select>
                  <Button size="sm" variant="subtle" onClick={() => save(a.account_id)}>Save</Button>
                </div>
                <Textarea rows={2} value={edits[a.account_id]?.notes} placeholder="Violation notes…" onChange={e => setEdits(s => ({ ...s, [a.account_id]: { ...s[a.account_id], notes: e.target.value } }))} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">Near or over daily limit ({atRisk.length})</h3>
          {atRisk.length === 0 && <div className="text-xs" style={{ color: 'var(--text-dim)' }}>No accounts near their limit.</div>}
          <ul className="flex flex-col gap-2">
            {atRisk.map(a => (
              <li key={a.account_id} className="flex items-center justify-between text-sm">
                <span>{a.username}</span>
                <span className="font-mono" style={{ color: 'var(--bad)' }}>{a.uploads_today} / {a.daily_upload_limit}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Recent errors (system_logs)</h3>
            {rangeFilter}
          </div>
          {errorLoading && errorLogs.length === 0 ? (
            <Spinner />
          ) : errorLoadErr ? (
            <LoadError message={errorLoadErr} onRetry={loadErrors} />
          ) : (
            <ul className="flex flex-col gap-2 text-xs">
              {errorLogs.length === 0 && <li style={{ color: 'var(--text-dim)' }}>No errors in this range.</li>}
              {errorLogs.map(l => (
                <li key={l.id} className="min-w-0 border-b pb-2" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex justify-between gap-2"><span style={{ color: 'var(--text-dim)' }}>{fmtDate(l.log_ts)}</span><span className="font-mono">{l.category}</span></div>
                  <ErrorMessage raw={l.error_message || l.message} tone="warn" />
                </li>
              ))}
            </ul>
          )}
          <PaginationBar
            page={errorPage}
            pageCount={errorPageCount}
            onPageChange={setErrorPage}
            pageSize={errorPageSize}
            onPageSizeChange={changeErrorPageSize}
          />
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Recently failed uploads</h3>
            {rangeFilter}
          </div>
          {failedLoading && failedJobs.length === 0 ? (
            <Spinner />
          ) : failedLoadErr ? (
            <LoadError message={failedLoadErr} onRetry={loadFailed} />
          ) : (
            <ul className="flex flex-col gap-2 text-xs">
              {failedJobs.length === 0 && <li style={{ color: 'var(--text-dim)' }}>No failed uploads in this range.</li>}
              {failedJobs.map(j => (
                <li key={j.job_id} className="min-w-0 border-b pb-2" style={{ borderColor: 'var(--border-soft)' }}>
                  <div className="flex justify-between gap-2"><span className="truncate font-mono">{j.youtube_video_id}</span><span className="flex-none" style={{ color: 'var(--text-dim)' }}>{fmtDate(j.updated_at)}</span></div>
                  <ErrorMessage raw={j.last_error} tone="bad" />
                </li>
              ))}
            </ul>
          )}
          <PaginationBar
            page={failedPage}
            pageCount={failedPageCount}
            onPageChange={setFailedPage}
            pageSize={failedPageSize}
            onPageSizeChange={changeFailedPageSize}
          />
        </Card>
      </main>
      )}
    </div>
  )
}
