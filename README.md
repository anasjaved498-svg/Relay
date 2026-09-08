# Relay — TikTok Automation Admin Dashboard

A production dashboard for your multi-proxy TikTok automation system. React + Vite +
TypeScript + Tailwind, talking directly to Supabase (no backend server of its own —
your n8n workflows keep doing the automation; this just manages the data they read from).

## 1. Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` from **Supabase Dashboard → Settings → API Keys**:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

Use the **publishable** key only. Never put the **secret** key in this project — it
runs entirely in the browser, so the secret key would hand out full, unrestricted
database access to anyone who opens the page.

## 2. Enable Row Level Security

Run this once in the Supabase SQL editor. It locks every table down to signed-in
users only (matches "users are added manually in Supabase" — no public access,
no per-row ownership needed since this is a single-team admin tool):

```sql
alter table proxies enable row level security;
alter table tiktok_accounts enable row level security;
alter table youtube_channels enable row level security;
alter table processed_videos enable row level security;
alter table upload_queue enable row level security;
alter table upload_history enable row level security;
alter table system_logs enable row level security;
alter table system_settings enable row level security;

create policy "authenticated full access" on proxies
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on tiktok_accounts
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on youtube_channels
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on processed_videos
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on upload_queue
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on upload_history
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on system_logs
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on system_settings
  for all to authenticated using (true) with check (true);
```

Your n8n workflows connect with the Postgres native credential (not this RLS-bound
client), so they're unaffected and keep working exactly as before.

If you later want multiple admins with different permissions, replace `using (true)`
per table with a real check (e.g. a `staff` table keyed by `auth.uid()`) — ask and
I'll build that out.

## 3. Create your login

Supabase Dashboard → **Authentication → Users → Add user**. Set an email + password —
that's what you sign in with. There's no self-service signup in this app on purpose.

## 4. Run it

```bash
npm run dev
```

Opens at `http://localhost:5173`.

## 5. Deploy

Push this folder to a repo and import it into **Vercel** or **Netlify**. Add the same
two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) in the project's
environment variable settings, build command `npm run build`, output directory `dist`.

## What's built

| Page | Covers |
|---|---|
| **Overview** | Stat cards (accounts/proxies/channels, today's uploads, queue counts, failures), account health summary, uploads-over-time chart from `upload_history` |
| **Accounts** | Paginated table, health/status badges, today-vs-limit (red when at/over), enable/disable, delete with confirm, "Connect new account" wizard, click-through detail (channels, proxy, recent uploads, violation notes editor) |
| **Channels** | Table, filter by account, reassign account inline, pause/resume monitoring, add/remove |
| **Proxies** | Table with health badge, add/enable-disable/delete, click-through drilldown (every account + every channel behind that proxy), warns at 8+ accounts |
| **Queue** | Live `upload_queue` view (10s auto-refresh, toggleable), filter by status, Retry button on failed jobs |
| **Violations & Health** | Accounts needing attention with inline health/notes editor, accounts near/over daily limit, recent `system_logs` errors, recently failed jobs |
| **Logs** | `system_logs`, filter by level + category, paginated |
| **Settings** | Theme switcher (Dark, Light, Ocean, Sunset — saved to this browser), `system_settings` key/value editor |

Ban-prevention checks built in: warns when assigning an 8th+ account to a proxy,
highlights accounts at/over `daily_upload_limit`, surfaces `health_status`
everywhere it's relevant.

**Proxy "test connection":** intentionally *not* faked. A browser can't open a
connection through an arbitrary proxy the way your Playwright worker does, so a
button that pretended to test one would just be lying to you. The Settings page
explains this and shows the honest path: have your worker or an n8n step write real
results into `proxies.health_status` / `last_connection_time`, and this dashboard
reflects them immediately since it reads live from the table.

## Two things spotted in your existing n8n workflows (unrelated to this dashboard)

- **WF2 (Upload Queue Worker)** has a spare Gmail node called "Send a message"
  hardcoded to send a test email ("Hello" / "tghj") after every successful upload,
  in addition to the real Notifier call.
- **WF3 (Notifier)** has the same kind of stray node wired to its fallback branch —
  fires on any `channel` value it doesn't recognize.

Neither affects this dashboard, but both are probably worth deleting.

## AI chat assistant (n8n)

The floating assistant (`src/components/ChatWidget.tsx`) is mounted inside
`ProtectedLayout`, so it only renders for signed-in Supabase users — never on
the login screen. Configure it in `.env`:

```
VITE_CHAT_WEBHOOK_URL=http://localhost:5678/webhook/7b93d42a-fb46-4a3f-8df2-f8ea8458c4e1/chat
VITE_CHAT_USER=admin
VITE_CHAT_PASS=your-real-password
```

The Basic Auth header is built from those variables at runtime. The n8n backend
is assumed to be local-only. **If you deploy this dashboard publicly, move the
call behind a backend proxy** — anything in `VITE_*` ends up in the browser
bundle and the password would be readable by visitors.

The widget's colors are driven by the active dashboard theme through the
`--chat--*` CSS variables defined at the bottom of `src/index.css`.
