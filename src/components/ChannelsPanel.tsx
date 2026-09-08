import { useEffect, useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Input, useConfirm } from './ui'
import { isValidYouTubeChannelId } from '../lib/helpers'
import { useToast } from '../context/UiContext'
import type { YouTubeChannel } from '../lib/types'

/**
 * Live-editable list of youtube_channels for one tiktok_accounts row.
 * Handles: list, add (with UC-id validation + cross-account duplicate guard),
 * remove, and pause/resume via is_active.
 */
export function ChannelsPanel({ accountId }: { accountId: string }) {
  const { push } = useToast()
  const { ask, dialog } = useConfirm()
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [accountId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('youtube_channels').select('*').eq('account_id', accountId).order('channel_id')
    setChannels(data || [])
    setLoading(false)
  }

  async function addChannel() {
    setError('')
    const id = newId.trim()
    if (!isValidYouTubeChannelId(id)) {
      setError('Channel ID must be exactly 24 characters and start with "UC".')
      return
    }
    if (channels.some(c => c.channel_id === id)) {
      setError('This channel is already linked to this account.')
      return
    }
    setBusy(true)
    const { data: existing } = await supabase.from('youtube_channels').select('account_id').eq('channel_id', id).maybeSingle()
    if (existing && existing.account_id && existing.account_id !== accountId) {
      setBusy(false)
      ask(
        'Channel already linked elsewhere',
        `This channel already feeds ${existing.account_id} — linking it here too may cause double-uploads. Continue anyway?`,
        () => doInsert(id)
      )
      return
    }
    await doInsert(id)
  }

  async function doInsert(id: string) {
    setBusy(true)
    const { error: insErr } = await supabase.from('youtube_channels').insert({
      channel_id: id, channel_name: newName.trim() || null, account_id: accountId, is_active: true,
    })
    setBusy(false)
    if (insErr) { push(insErr.message, 'bad'); return }
    setNewId(''); setNewName('')
    push('Channel added.', 'ok')
    load()
  }

  function removeChannel(c: YouTubeChannel) {
    ask('Remove channel?', `This unlinks ${c.channel_name || c.channel_id} from this account.`, async () => {
      const { error: delErr } = await supabase.from('youtube_channels').delete().eq('channel_id', c.channel_id)
      if (delErr) { push(delErr.message, 'bad'); return }
      push('Channel removed.', 'ok')
      load()
    })
  }

  async function toggleActive(c: YouTubeChannel) {
    const { error: updErr } = await supabase.from('youtube_channels').update({ is_active: !c.is_active }).eq('channel_id', c.channel_id)
    if (updErr) { push(updErr.message, 'bad'); return }
    load()
  }

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: 'var(--text-dim)' }}>
          <Loader2 size={13} className="animate-spin" /> Loading channels…
        </div>
      ) : channels.length === 0 ? (
        <div className="mb-3 text-xs" style={{ color: 'var(--text-dim)' }}>No YouTube channels linked yet.</div>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {channels.map(c => (
            <li key={c.channel_id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5" style={{ background: 'var(--surface)' }}>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.channel_name || c.channel_id}</div>
                {c.channel_name && <div className="truncate font-mono text-[10.5px]" style={{ color: 'var(--text-dim)' }}>{c.channel_id}</div>}
              </div>
              <div className="flex flex-none items-center gap-2">
                <button
                  onClick={() => toggleActive(c)}
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide"
                  style={{
                    background: c.is_active ? 'var(--good-soft)' : 'var(--surface-2)',
                    color: c.is_active ? 'var(--good)' : 'var(--text-muted)',
                  }}
                  title={c.is_active ? 'Active — click to pause' : 'Paused — click to resume'}
                >
                  {c.is_active ? 'Active' : 'Paused'}
                </button>
                <button onClick={() => removeChannel(c)} style={{ color: 'var(--bad)' }} title="Remove"><X size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Input value={newId} placeholder="UC… (24 chars)" onChange={e => setNewId(e.target.value)} className="font-mono sm:flex-1" />
        <Input value={newName} placeholder="Channel name (optional)" onChange={e => setNewName(e.target.value)} className="sm:flex-1" />
        <Button size="sm" onClick={addChannel} loading={busy} disabled={busy || !newId.trim()}>
          <Plus size={14} /> Add channel
        </Button>
      </div>
      {error && <div className="mt-1.5 text-[11px]" style={{ color: 'var(--bad)' }}>{error}</div>}
      {dialog}
    </div>
  )
}
