import { Fragment, useEffect, useRef, useState } from 'react'
import { UserPlus, ChevronDown, ChevronRight, Info, Users, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, Badge, Button, TableSkeleton, LoadError, EmptyState, Pagination, Field, Input, Textarea, Select, useConfirm } from '../components/ui'
import { ChannelsPanel } from '../components/ChannelsPanel'
import { UploadedTodayModal, FailedJobsModal } from './AccountStatsModals'
import { fmtDate, startOfTodayISO } from '../lib/helpers'
import { useToast } from '../context/UiContext'
import AccountFormModal from './AccountFormModal'
import type { TikTokAccount, AccountHealth } from '../lib/types'

/** Per-account counts sourced live from upload_queue (Feature 2). */
interface AccountStats { uploadedToday: number; failed: number }

type StatsModalState = { kind: 'uploaded' | 'failed'; account: TikTokAccount } | null

const PAGE_SIZE = 10
const STILL_WAITING_MS = 60_000
const WAITING_STATUSES = new Set(['needs_login', 'logging_in'])

export default function Accounts() {
  const { push } = useToast()
  const { ask, dialog } = useConfirm()
  const [rows, setRows] = useState<TikTokAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [lastLoaded, setLastLoaded] = useState<number | null>(null)
  const [stats, setStats] = useState<Record<string, AccountStats>>({})
  const [statsModal, setStatsModal] = useState<StatsModalState>(null)

  const loadRef = useRef<() => void>(() => {})

  useEffect(() => { load() }, [page])

  async function load() {
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE
    const { data, count, error } = await supabase
      .from('tiktok_accounts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) { setError(error.message); setLoading(false); return }
    setError(null)
    setRows(data || [])
    setCount(count || 0)
    setLastLoaded(Date.now())
    setLoading(false)
    loadStats((data || []).map(a => a.account_id))
  }
  loadRef.current = load

  /**
   * Feature 2: "Uploaded today" and "Failed jobs" are live counts from
   * upload_queue, not the cached tiktok_accounts.uploads_today column.
   * One query covers both stats for every account on the current page:
   * either status='failed' rows, or status='completed' rows completed today.
   */
  async function loadStats(accountIds: string[]) {
    if (accountIds.length === 0) { setStats({}); return }
    const { data, error } = await supabase
      .from('upload_queue')
      .select('account_id, status, completed_at')
      .in('account_id', accountIds)
      .or(`status.eq.failed,and(status.eq.completed,completed_at.gte.${startOfTodayISO()})`)
    if (error) return // non-fatal — stats just stay at their previous values
    const map: Record<string, AccountStats> = {}
    for (const id of accountIds) map[id] = { uploadedToday: 0, failed: 0 }
    for (const r of data || []) {
      const id = r.account_id as string | null
      if (!id) continue
      if (!map[id]) map[id] = { uploadedToday: 0, failed: 0 }
      if (r.status === 'failed') map[id].failed += 1
      else if (r.status === 'completed') map[id].uploadedToday += 1
    }
    setStats(map)
  }

  // Live status updates: Supabase realtime (instant) plus a poll fallback
  // (every 20s) in case realtime isn't enabled on this table.
  useEffect(() => {
    const channel = supabase
      .channel('tiktok_accounts-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiktok_accounts' }, () => loadRef.current())
      .subscribe()
    const poll = setInterval(() => loadRef.current(), 20000)
    const clock = setInterval(() => setNow(Date.now()), 5000)
    return () => { supabase.removeChannel(channel); clearInterval(poll); clearInterval(clock) }
  }, [])

  function reLogin(a: TikTokAccount) {
    ask(
      'Re-login this account?',
      'This will open a TikTok login window on your PC and require you to log in again. Continue?',
      async () => {
        const { error } = await supabase.from('tiktok_accounts').update({ status: 'needs_login' }).eq('account_id', a.account_id)
        if (error) { push(error.message, 'bad'); return }
        push('A login window will open on your PC. Log into TikTok in that window, then close it. Make sure the watcher is running.', 'ok')
        load()
      }
    )
  }

  function deleteAccount(a: TikTokAccount) {
    ask(
      'Delete account?',
      `This will permanently remove ${a.account_id} (${a.username}) from the dashboard. This cannot be undone.`,
      async () => {
        // Delete in FK-safe order: channels and queue jobs reference the account.
        const { error: chErr } = await supabase.from('youtube_channels').delete().eq('account_id', a.account_id)
        if (chErr) { push(chErr.message, 'bad'); return }
        const { error: qErr } = await supabase.from('upload_queue').delete().eq('account_id', a.account_id)
        if (qErr) { push(qErr.message, 'bad'); return }
        const { error: accErr } = await supabase.from('tiktok_accounts').delete().eq('account_id', a.account_id)
        if (accErr) { push(accErr.message, 'bad'); return }
        push('Account deleted', 'ok')
        load()
      }
    )
  }

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle={`${count} TikTok account${count !== 1 ? 's' : ''}`}
        actions={<Button onClick={() => setAddOpen(true)}><UserPlus size={15} /> Add TikTok account</Button>}
      />
      {/* pb-24 clears the floating chat launcher so bottom pagination stays reachable */}
      <main className="p-8 pb-24">
        <div
          className="mb-4 flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs"
          style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)', color: 'var(--text-muted)' }}
        >
          <span className="flex items-center gap-2">
            <Info size={14} className="flex-none" />
            Login windows open on your PC only while the local watcher is running.
          </span>
          {lastLoaded && (
            <span className="flex-none" style={{ color: 'var(--text-dim)' }}>
              Updated {Math.max(0, Math.round((now - lastLoaded) / 1000))}s ago
            </span>
          )}
        </div>

        <Card>
          {loading ? <TableSkeleton cols={8} /> : error ? <LoadError message={error} onRetry={load} /> : rows.length === 0 ? (
            <EmptyState
              icon={<Users size={28} />}
              title="No accounts yet"
              hint="Add your first TikTok account to get started."
              action={<Button size="sm" onClick={() => setAddOpen(true)}><UserPlus size={14} /> Add TikTok account</Button>}
            />
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Posts to</th>
                    <th className="py-2 pr-3">Proxy</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Health</th>
                    <th className="py-2 pr-3">Uploaded today</th>
                    <th className="py-2 pr-3">Failed jobs</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => {
                    const s = stats[a.account_id] || { uploadedToday: 0, failed: 0 }
                    const nearLimit = s.uploadedToday >= a.daily_upload_limit
                    const isOpen = expanded === a.account_id
                    const waitingSince = a.updated_at ? new Date(a.updated_at).getTime() : null
                    const stillWaiting = WAITING_STATUSES.has(a.status) && waitingSince != null && now - waitingSince > STILL_WAITING_MS
                    return (
                      <Fragment key={a.account_id}>
                        <tr className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
                          <td className="py-2.5 pr-3">
                            <button className="flex items-center gap-1.5 font-mono text-xs" onClick={() => setExpanded(isOpen ? null : a.account_id)}>
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {a.account_id}
                            </button>
                            {a.email && <div className="ml-5 text-[11px]" style={{ color: 'var(--text-dim)' }}>{a.email}</div>}
                          </td>
                          {/* Feature 6: where this account publishes — TikTok handle + proxy */}
                          <td className="py-2.5 pr-3 font-mono text-xs">{a.username ? `@${a.username}` : '—'}</td>
                          <td className="py-2.5 pr-3 font-mono text-xs">{a.proxy_id || '—'}</td>
                          <td className="py-2.5 pr-3">
                            <Badge value={a.status} pulse={a.status === 'logging_in'} />
                            {stillWaiting && (
                              <div className="mt-1 text-[10.5px]" style={{ color: 'var(--warn)' }}>
                                Still waiting — is the watcher running on your PC, and is the proxy working?
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-3"><Badge value={a.health_status} /></td>
                          {/* Feature 2, Stat A: opens "Uploaded Today" modal (Feature 4) */}
                          <td className="py-2.5 pr-3">
                            <button
                              className="font-mono text-xs underline decoration-dotted underline-offset-2"
                              style={{ color: nearLimit ? 'var(--bad)' : 'var(--text)' }}
                              onClick={() => setStatsModal({ kind: 'uploaded', account: a })}
                              title="View uploads completed today"
                            >
                              {s.uploadedToday} / {a.daily_upload_limit}
                            </button>
                          </td>
                          {/* Feature 2, Stat B: opens "Failed Jobs" modal (Feature 5) */}
                          <td className="py-2.5 pr-3">
                            <button
                              className="font-mono text-xs underline decoration-dotted underline-offset-2"
                              style={{ color: s.failed > 0 ? 'var(--bad)' : 'var(--text-dim)' }}
                              onClick={() => setStatsModal({ kind: 'failed', account: a })}
                              title="View failed jobs"
                            >
                              {s.failed}
                            </button>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="subtle" onClick={() => reLogin(a)}>Re-login</Button>
                              <button title="Delete" onClick={() => deleteAccount(a)} style={{ color: 'var(--bad)' }}><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
                            <td colSpan={8} className="bg-transparent py-3 pr-3">
                              <AccountDetailPanel account={a} onChanged={load} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </Card>
      </main>

      <AccountFormModal open={addOpen} onClose={() => setAddOpen(false)} onDone={load} />

      {/* Feature 4 */}
      <UploadedTodayModal
        open={statsModal?.kind === 'uploaded'}
        onClose={() => setStatsModal(null)}
        accountId={statsModal?.account.account_id || ''}
        accountLabel={statsModal?.account.username ? `@${statsModal.account.username}` : (statsModal?.account.account_id || '')}
      />
      {/* Feature 5 */}
      <FailedJobsModal
        open={statsModal?.kind === 'failed'}
        onClose={() => setStatsModal(null)}
        accountId={statsModal?.account.account_id || ''}
        accountLabel={statsModal?.account.username ? `@${statsModal.account.username}` : (statsModal?.account.account_id || '')}
      />

      {dialog}
    </div>
  )
}

function AccountDetailPanel({ account, onChanged }: { account: TikTokAccount; onChanged: () => void }) {
  const { push } = useToast()
  const [health, setHealth] = useState<AccountHealth>(account.health_status)
  const [notes, setNotes] = useState(account.violation_notes || '')
  const [saving, setSaving] = useState(false)
  const [caption, setCaption] = useState(account.default_caption || '')
  const [hashtags, setHashtags] = useState(account.default_hashtags || '')
  const [savingCaption, setSavingCaption] = useState(false)
  const [dailyLimit, setDailyLimit] = useState(String(account.daily_upload_limit ?? ''))
  const [savingLimit, setSavingLimit] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('tiktok_accounts').update({ health_status: health, violation_notes: notes || null }).eq('account_id', account.account_id)
    setSaving(false)
    if (error) { push(error.message, 'bad'); return }
    push('Saved.', 'ok')
    onChanged()
  }

  // Feature 1 — the only write feature in this task. Updates
  // default_caption / default_hashtags on tiktok_accounts for this account.
  async function saveCaption() {
    setSavingCaption(true)
    const { error } = await supabase
      .from('tiktok_accounts')
      .update({ default_caption: caption || null, default_hashtags: hashtags || null })
      .eq('account_id', account.account_id)
    setSavingCaption(false)
    if (error) { push(error.message, 'bad'); return }
    push('Default caption & hashtags saved.', 'ok')
    onChanged()
  }

  // Feature 7 — editable daily_upload_limit, same write pattern as saveCaption.
  async function saveLimit() {
    const parsed = Number(dailyLimit)
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      push('Daily upload limit must be a whole number of 0 or more.', 'bad')
      return
    }
    setSavingLimit(true)
    const { error } = await supabase
      .from('tiktok_accounts')
      .update({ daily_upload_limit: parsed })
      .eq('account_id', account.account_id)
    setSavingLimit(false)
    if (error) { push(error.message, 'bad'); return }
    push('Daily upload limit saved.', 'ok')
    onChanged()
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4" style={{ borderColor: 'var(--border-soft)' }}>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Manage channels</h3>
        <ChannelsPanel accountId={account.account_id} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Default caption &amp; hashtags</h3>
        <Field label="Default caption">
          <Textarea rows={2} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Default caption used for uploads from this account…" />
        </Field>
        <Field label="Default hashtags">
          <Input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#tag1 #tag2 #tag3" />
        </Field>
        <Button size="sm" onClick={saveCaption} loading={savingCaption} disabled={savingCaption}>Save</Button>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Daily upload limit</h3>
        <Field label="Daily upload limit">
          <Input
            type="number"
            min={0}
            step={1}
            value={dailyLimit}
            onChange={e => setDailyLimit(e.target.value)}
            className="sm:max-w-[10rem]"
          />
        </Field>
        <Button size="sm" onClick={saveLimit} loading={savingLimit} disabled={savingLimit}>Save</Button>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Health &amp; violations</h3>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Field label="Health status">
            <Select value={health} onChange={e => setHealth(e.target.value as AccountHealth)}>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="restricted">Restricted</option>
              <option value="banned">Banned</option>
            </Select>
          </Field>
          <div />
        </div>
        <Field label="Violation notes">
          <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. community guideline strike on Aug 12…" />
        </Field>
        <Button size="sm" onClick={save} loading={saving} disabled={saving}>Save</Button>
      </div>

      <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Last updated {fmtDate(account.updated_at)}</div>
    </div>
  )
}
