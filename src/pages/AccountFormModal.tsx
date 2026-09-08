import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Field, Input, Textarea, Select, Modal, useConfirm } from '../components/ui'
import { nextId, isValidYouTubeChannelId } from '../lib/helpers'
import { useToast } from '../context/UiContext'
import type { Proxy } from '../lib/types'

interface DraftChannel { key: number; channel_id: string; channel_name: string; error: string }

let draftKeyCounter = 0
function emptyDraftChannel(): DraftChannel {
  return { key: ++draftKeyCounter, channel_id: '', channel_name: '', error: '' }
}

export default function AccountFormModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { push } = useToast()
  const { ask, dialog } = useConfirm()

  const [proxies, setProxies] = useState<Proxy[]>([])
  const [existingAccountIds, setExistingAccountIds] = useState<string[]>([])

  const [accountId, setAccountId] = useState('')
  const [accountIdError, setAccountIdError] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [email, setEmail] = useState('')
  const [proxyId, setProxyId] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [dailyLimit, setDailyLimit] = useState(5)
  const [channels, setChannels] = useState<DraftChannel[]>([])

  const [saving, setSaving] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [failedChannels, setFailedChannels] = useState<{ id: string; reason: string }[]>([])

  useEffect(() => {
    if (!open) return
    reset()
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function reset() {
    setEmail(''); setProxyId(''); setCaption(''); setHashtags(''); setDailyLimit(5)
    setChannels([]); setSaving(false); setCreatedId(null); setFailedChannels([]); setAccountIdError('')
    setUsername(''); setUsernameError('')
  }

  async function load() {
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('proxies').select('*').order('proxy_id'),
      supabase.from('tiktok_accounts').select('account_id'),
    ])
    setProxies(p || [])
    const ids = (a || []).map(x => x.account_id)
    setExistingAccountIds(ids)
    setAccountId(nextId('acct', ids))
  }

  function addChannelRow() {
    setChannels(c => [...c, emptyDraftChannel()])
  }
  function removeChannelRow(key: number) {
    setChannels(c => c.filter(x => x.key !== key))
  }
  function updateChannelRow(key: number, patch: Partial<DraftChannel>) {
    setChannels(c => c.map(x => x.key === key ? { ...x, ...patch, error: '' } : x))
  }

  function validateChannelsLocally(): boolean {
    let ok = true
    const seen = new Set<string>()
    const next = channels.map(c => {
      const id = c.channel_id.trim()
      if (!id) { ok = false; return { ...c, error: 'Channel ID is required (or remove this row).' } }
      if (!isValidYouTubeChannelId(id)) { ok = false; return { ...c, error: 'Must be exactly 24 characters and start with "UC".' } }
      if (seen.has(id)) { ok = false; return { ...c, error: 'Duplicate channel ID in this form.' } }
      seen.add(id)
      return { ...c, error: '' }
    })
    setChannels(next)
    return ok
  }

  async function handleSave() {
    setAccountIdError('')
    setUsernameError('')
    const id = accountId.trim()
    if (!id) { setAccountIdError('Account ID is required.'); return }
    if (existingAccountIds.includes(id)) { setAccountIdError('This account ID is already in use.'); return }
    const cleanUsername = username.trim().replace(/^@/, '')
    if (!cleanUsername) { setUsernameError('TikTok username is required.'); return }
    if (!proxyId) { push('Choose a proxy.', 'bad'); return }
    if (channels.length > 0 && !validateChannelsLocally()) return

    // Double-check uniqueness against the DB (in case of a race since we loaded the page).
    const { data: dupe } = await supabase.from('tiktok_accounts').select('account_id').eq('account_id', id).maybeSingle()
    if (dupe) { setAccountIdError('This account ID is already in use.'); return }

    // Username/email must be unique (case-insensitive) — unique indexes exist on
    // lower(username)/lower(email), so check up front for a clear inline error
    // instead of letting the insert fail with a raw Postgres error.
    const dupChecks = [
      supabase.from('tiktok_accounts').select('account_id').ilike('username', cleanUsername).limit(1),
    ]
    const cleanEmail = email.trim()
    if (cleanEmail) {
      dupChecks.push(supabase.from('tiktok_accounts').select('account_id').ilike('email', cleanEmail).limit(1))
    }
    const dupResults = await Promise.all(dupChecks)
    if (dupResults.some(r => (r.data || []).length > 0)) {
      setUsernameError('An account with this username or email already exists.')
      return
    }

    // Cross-check each channel against youtube_channels for a conflicting owner.
    if (channels.length > 0) {
      const ids = channels.map(c => c.channel_id.trim())
      const { data: owners } = await supabase.from('youtube_channels').select('channel_id, account_id').in('channel_id', ids)
      const conflicts = (owners || []).filter(o => o.account_id && o.account_id !== id)
      if (conflicts.length > 0) {
        const list = conflicts.map(c => `${c.channel_id} → already feeds ${c.account_id}`).join('\n')
        ask(
          'Channel(s) already linked elsewhere',
          `${list}\n\nLinking these here too may cause double-uploads. Continue anyway?`,
          () => doSave(id, cleanUsername)
        )
        return
      }
    }
    await doSave(id, cleanUsername)
  }

  async function doSave(id: string, usernameValue: string) {
    setSaving(true)
    const { error: accErr } = await supabase.from('tiktok_accounts').insert({
      account_id: id,
      username: usernameValue,
      email: email.trim() || null,
      proxy_id: proxyId,
      status: 'needs_login',
      health_status: 'healthy',
      daily_upload_limit: dailyLimit || 5,
      uploads_today: 0,
      default_caption: caption.trim() || null,
      default_hashtags: hashtags.trim() || null,
    })
    if (accErr) {
      setSaving(false)
      if (accErr.code === '23505') {
        setUsernameError('An account with this username or email already exists.')
      } else {
        push(accErr.message || 'Could not save account.', 'bad')
      }
      return
    }

    const failures: { id: string; reason: string }[] = []
    for (const c of channels) {
      const channelId = c.channel_id.trim()
      const { error: chErr } = await supabase.from('youtube_channels').insert({
        channel_id: channelId, channel_name: c.channel_name.trim() || null, account_id: id, is_active: true,
      })
      if (chErr) failures.push({ id: channelId, reason: chErr.message })
    }

    setSaving(false)
    setFailedChannels(failures)
    setCreatedId(id)
    if (failures.length > 0) {
      push(`Account created, but ${failures.length} channel${failures.length !== 1 ? 's' : ''} failed to save.`, 'bad')
    } else {
      push('Account created.', 'ok')
    }
    onDone()
  }

  function finish() {
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={createdId ? 'Account created' : 'Add TikTok account'} width={620}>
      {createdId ? (
        <div>
          <div className="mb-4 rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' }}>
            A login window will open on your PC. Log into TikTok in that window, then close it. Make sure the watcher is running.
          </div>
          <div className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)' }}>{createdId}</strong> was created with status <span className="font-mono">needs_login</span>. You can watch its status update live on the Accounts page.
          </div>
          {failedChannels.length > 0 && (
            <div className="mb-4 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--bad)', background: 'var(--bad-soft)', color: 'var(--bad)' }}>
              <div className="mb-1 font-semibold">Some channels failed to save:</div>
              <ul className="flex flex-col gap-0.5">
                {failedChannels.map(f => <li key={f.id} className="font-mono">{f.id} — {f.reason}</li>)}
              </ul>
            </div>
          )}
          <Button onClick={finish}>Done</Button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Account ID" error={accountIdError}>
              <Input value={accountId} onChange={e => { setAccountId(e.target.value); setAccountIdError('') }} className="font-mono" />
            </Field>
            <Field label="Email (optional)">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="account@mail.com" />
            </Field>
          </div>

          <Field label="TikTok username" error={usernameError}>
            <Input value={username} onChange={e => { setUsername(e.target.value); setUsernameError('') }} placeholder="@yourhandle" />
          </Field>

          <Field label="Proxy">
            <Select value={proxyId} onChange={e => setProxyId(e.target.value)}>
              <option value="">Choose a proxy…</option>
              {proxies.map(p => (
                <option key={p.proxy_id} value={p.proxy_id}>{p.proxy_id} — {p.host}:{p.port}</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Default hashtags (optional)">
              <Input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#fyi #foryou" />
            </Field>
            <Field label="Daily upload limit">
              <Input type="number" min={1} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Default caption (optional)">
            <Textarea rows={2} value={caption} onChange={e => setCaption(e.target.value)} />
          </Field>

          <div className="mt-4 mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>YouTube channels ({channels.length})</h3>
            <Button size="sm" variant="subtle" onClick={addChannelRow}><Plus size={13} /> Add channel</Button>
          </div>
          {channels.length === 0 && (
            <div className="mb-3 text-xs" style={{ color: 'var(--text-dim)' }}>No channels yet — you can add these later too.</div>
          )}
          <div className="mb-4 flex flex-col gap-2">
            {channels.map(c => (
              <div key={c.key} className="rounded-lg border p-2.5" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start gap-2">
                  <Input
                    value={c.channel_id}
                    placeholder="UC… (24 chars)"
                    onChange={e => updateChannelRow(c.key, { channel_id: e.target.value })}
                    className="font-mono"
                  />
                  <Input
                    value={c.channel_name}
                    placeholder="Channel name (optional)"
                    onChange={e => updateChannelRow(c.key, { channel_name: e.target.value })}
                  />
                  <button onClick={() => removeChannelRow(c.key)} className="mt-2 flex-none" style={{ color: 'var(--bad)' }} title="Remove">
                    <X size={16} />
                  </button>
                </div>
                {c.error && <div className="mt-1 text-[11px]" style={{ color: 'var(--bad)' }}>{c.error}</div>}
              </div>
            ))}
          </div>

          <Button onClick={handleSave} loading={saving} disabled={saving}>Save</Button>
        </div>
      )}
      {dialog}
    </Modal>
  )
}
