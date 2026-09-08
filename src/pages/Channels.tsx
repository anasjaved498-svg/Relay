import { useEffect, useState } from 'react'
import { Plus, Trash2, Youtube } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/Layout'
import { Card, Badge, Button, TableSkeleton, LoadError, EmptyState, Modal, Field, Input, Select, useConfirm } from '../components/ui'
import { fmtDate, isValidChannelId } from '../lib/helpers'
import { useToast } from '../context/UiContext'
import type { YouTubeChannel, TikTokAccount } from '../lib/types'

export default function Channels() {
  const { push } = useToast()
  const { ask, dialog } = useConfirm()
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [accounts, setAccounts] = useState<TikTokAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterAccount, setFilterAccount] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: ch, error: chErr }, { data: acc, error: accErr }] = await Promise.all([
      supabase.from('youtube_channels').select('*').order('created_at', { ascending: false }),
      supabase.from('tiktok_accounts').select('*').order('account_id'),
    ])
    const err = chErr || accErr
    if (err) { setError(err.message); setLoading(false); return }
    setError(null)
    setChannels(ch || [])
    setAccounts(acc || [])
    setLoading(false)
  }

  async function reassign(channelId: string, accountId: string) {
    const { error } = await supabase.from('youtube_channels').update({ account_id: accountId || null }).eq('channel_id', channelId)
    if (error) { push(error.message, 'bad'); return }
    push('Channel repaired.', 'ok')
    load()
  }

  function togglePause(c: YouTubeChannel) {
    const next = c.monitoring_status === 'active' ? 'paused' : 'active'
    const run = async () => {
      const { error } = await supabase.from('youtube_channels').update({ monitoring_status: next }).eq('channel_id', c.channel_id)
      if (error) { push(error.message, 'bad'); return }
      push(next === 'paused' ? 'Channel paused.' : 'Channel resumed.', 'ok')
      load()
    }
    if (next === 'paused') {
      ask('Pause this channel?', `Stop monitoring "${c.channel_name || c.channel_id}" until you resume it?`, run)
    } else {
      run()
    }
  }

  function remove(c: YouTubeChannel) {
    ask('Remove channel?', `Stop monitoring "${c.channel_name || c.channel_id}"?`, async () => {
      const { error } = await supabase.from('youtube_channels').delete().eq('channel_id', c.channel_id)
      if (error) { push(error.message, 'bad'); return }
      push('Channel removed.', 'ok')
      load()
    })
  }

  function accountName(id: string | null) {
    const a = accounts.find(a => a.account_id === id)
    // `username` is a legacy/unconfirmed field (see lib/types.ts) — fall back to account_id.
    return a ? (a.username || a.account_id) : '—'
  }

  const visible = filterAccount ? channels.filter(c => c.account_id === filterAccount) : channels

  return (
    <div>
      <PageHeader
        title="Channels"
        subtitle={`${channels.length} YouTube channel${channels.length !== 1 ? 's' : ''} monitored`}
        actions={<Button onClick={() => setAddOpen(true)}><Plus size={15} /> Add channel</Button>}
      />
      <main className="p-8">
        <div className="mb-4 max-w-xs">
          <Select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.username} ({a.account_id})</option>)}
          </Select>
        </div>
        <Card>
          {loading ? <TableSkeleton cols={5} /> : error ? <LoadError message={error} onRetry={load} /> : visible.length === 0 ? (
            <EmptyState
              icon={<Youtube size={28} />}
              title="No channels"
              hint="Add a YouTube channel to start monitoring it."
              action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add channel</Button>}
            />
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
                    <th className="py-2 pr-3">Channel</th>
                    <th className="py-2 pr-3">Paired account</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Last check</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(c => (
                    <tr key={c.channel_id} className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{c.channel_name || '—'}</div>
                        <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>{c.channel_id}</div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Select value={c.account_id || ''} onChange={e => reassign(c.channel_id, e.target.value)} className="!py-1.5 !text-xs">
                          <option value="">Unassigned</option>
                          {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.username}</option>)}
                        </Select>
                      </td>
                      <td className="py-2.5 pr-3"><Badge value={c.monitoring_status} /></td>
                      <td className="py-2.5 pr-3 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(c.last_check)}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="subtle" onClick={() => togglePause(c)}>{c.monitoring_status === 'active' ? 'Pause' : 'Resume'}</Button>
                          <button title="Remove" onClick={() => remove(c)} style={{ color: 'var(--bad)' }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      {addOpen && <AddChannelModal accounts={accounts} onClose={() => setAddOpen(false)} onDone={load} accountName={accountName} />}
      {dialog}
    </div>
  )
}

function AddChannelModal({ accounts, onClose, onDone }: { accounts: TikTokAccount[]; onClose: () => void; onDone: () => void; accountName: (id: string | null) => string }) {
  const { push } = useToast()
  const [form, setForm] = useState({ channel_name: '', channel_id: '', channel_url: '', account_id: '' })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form.channel_name.trim() || !isValidChannelId(form.channel_id)) {
      push('Enter a channel name and a valid channel ID (starts with UC…).', 'bad'); return
    }
    setBusy(true)
    const { error } = await supabase.from('youtube_channels').insert({
      channel_id: form.channel_id.trim(), channel_name: form.channel_name.trim(),
      channel_url: form.channel_url.trim() || `https://www.youtube.com/channel/${form.channel_id.trim()}`,
      account_id: form.account_id || null, monitoring_status: 'active',
    })
    setBusy(false)
    if (error) { push(error.message, 'bad'); return }
    push('Channel added.', 'ok')
    onDone()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Add YouTube channel">
      <Field label="Channel name"><Input value={form.channel_name} onChange={e => setForm(f => ({ ...f, channel_name: e.target.value }))} /></Field>
      <Field label="Channel ID (UC…)"><Input value={form.channel_id} onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))} /></Field>
      <Field label="Channel URL (optional)"><Input value={form.channel_url} onChange={e => setForm(f => ({ ...f, channel_url: e.target.value }))} /></Field>
      <Field label="Paired account">
        <Select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
          <option value="">Unassigned</option>
          {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.username} ({a.account_id})</option>)}
        </Select>
      </Field>
      <Button onClick={submit} loading={busy} disabled={busy}>Add channel</Button>
    </Modal>
  )
}
