export type ProxyType = 'HTTP' | 'SOCKS5'
export type AccountStatus = 'needs_login' | 'logging_in' | 'active' | 'login_failed'
export type AccountHealth = 'healthy' | 'warning' | 'restricted' | 'banned'
export type QueueStatus = 'queued' | 'processing' | 'uploading' | 'completed' | 'retrying' | 'failed' | 'cancelled'
export type LogLevel = 'info' | 'warn' | 'error'

export interface Proxy {
  id: number
  proxy_id: string
  host: string
  port: number
  username: string | null
  password: string | null
  proxy_type: ProxyType
  country: string | null
  status: string
  health_status: string
  last_connection_time: string | null
  created_at: string
  updated_at: string
}

/**
 * tiktok_accounts — confirmed schema (Aug 2026):
 * account_id, email, proxy_id, status, health_status, daily_upload_limit,
 * uploads_today, default_caption, default_hashtags, violation_notes.
 * id/created_at/updated_at are assumed standard Supabase columns.
 *
 * The fields below marked "legacy — unconfirmed" are NOT part of the
 * confirmed schema. They're kept optional purely so Channels.tsx,
 * Proxies.tsx and Violations.tsx (out of scope for the Accounts rebuild)
 * still type-check — those pages read columns (username, privacy, etc.)
 * that may no longer exist and likely need their own follow-up pass.
 */
export interface TikTokAccount {
  id: number
  account_id: string
  email: string | null
  proxy_id: string | null
  status: AccountStatus
  health_status: AccountHealth
  daily_upload_limit: number
  uploads_today: number
  default_caption: string | null
  default_hashtags: string | null
  violation_notes: string | null
  created_at: string
  updated_at: string
  // legacy — unconfirmed, see note above
  username?: string
  privacy?: 'public' | 'friends' | 'private'
  credential_ref?: string | null
  allow_comments?: boolean
  allow_duet?: boolean
  allow_stitch?: boolean
  upload_delay?: number
  retry_limit?: number
  last_upload?: string | null
  next_upload?: string | null
}

/**
 * youtube_channels — confirmed schema (Aug 2026):
 * channel_id (YouTube UC id), account_id, channel_name, is_active.
 * id/created_at/updated_at are assumed standard Supabase columns.
 *
 * monitoring_status / channel_url / latest_video_id / last_check are
 * legacy — unconfirmed, kept optional only so Channels.tsx keeps
 * type-checking (out of scope for the Accounts rebuild).
 */
export interface YouTubeChannel {
  id: number
  channel_id: string
  account_id: string | null
  channel_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // legacy — unconfirmed, see note above
  channel_url?: string | null
  latest_video_id?: string | null
  monitoring_status?: 'active' | 'paused'
  last_check?: string | null
}

export interface UploadQueueItem {
  id: number
  job_id: string
  youtube_video_id: string
  youtube_url: string | null
  video_path: string | null
  account_id: string | null
  proxy_id: string | null
  caption: string | null
  hashtags: string | null
  scheduled_at: string
  status: QueueStatus
  retry_count: number
  max_retries: number
  last_error: string | null
  tiktok_post_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

/**
 * processed_videos — a video is inserted here at detection/registration time,
 * before it enters upload_queue. Only the columns the dashboard currently
 * reads are modeled here.
 */
export interface ProcessedVideo {
  id: number
  youtube_video_id: string
  channel_id: string | null
  account_id: string | null
  processed_at: string
}

export interface UploadHistoryItem {
  id: number
  job_id: string | null
  youtube_video_id: string | null
  account_id: string | null
  proxy_id: string | null
  tiktok_post_id: string | null
  final_status: string | null
  attempts: number | null
  error_message: string | null
  recorded_at: string
}

export interface SystemLog {
  id: number
  log_ts: string
  level: LogLevel
  category: string
  job_id: string | null
  account_id: string | null
  proxy_id: string | null
  youtube_channel_id: string | null
  video_url: string | null
  message: string | null
  download_status: string | null
  upload_status: string | null
  login_status: string | null
  logout_status: string | null
  execution_time_ms: number | null
  error_message: string | null
}

export interface SystemSetting {
  key: string
  value: string | null
  updated_at: string
}
