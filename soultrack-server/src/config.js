import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SERVER_ROOT = path.resolve(__dirname, '..')

const PLACEHOLDER_SECRETS = new Set([
  'change-me-to-a-long-random-secret',
  'change-me-to-another-long-random-secret',
])

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return String(value).toLowerCase() === 'true'
}

export function loadConfig(env = process.env) {
  const r2 = {
    accountId: (env.R2_ACCOUNT_ID || '').trim(),
    accessKeyId: (env.R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (env.R2_SECRET_ACCESS_KEY || '').trim(),
    bucket: (env.R2_BUCKET || '').trim(),
    publicUrl: (env.R2_PUBLIC_URL || '').trim().replace(/\/$/, ''),
  }

  const r2Configured = Boolean(
    r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket && r2.publicUrl
  )

  const requestedStorage = (env.STORAGE_MODE || '').trim().toLowerCase()
  const storageMode = requestedStorage || (r2Configured ? 'r2' : 'local')

  return {
    port: Number(env.PORT) || 3000,
    nodeEnv: env.NODE_ENV || 'development',
    publicBaseUrl: (env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, ''),
    databaseUrl: (env.DATABASE_URL || '').trim(),
    autoMigrate: parseBool(env.AUTO_MIGRATE, true),
    adminSecret: env.ADMIN_SECRET || '',
    tokenSecret: env.TOKEN_SECRET || env.ADMIN_SECRET || '',
    storageMode,
    allowLocalStorageInProd: parseBool(env.ALLOW_LOCAL_STORAGE, false),
    r2Configured,
    r2,
    localMediaDir: path.resolve(env.LOCAL_MEDIA_DIR || path.join(SERVER_ROOT, 'uploads')),
    maxUploadBytes: (Number(env.MAX_UPLOAD_MB) || 50) * 1024 * 1024,
    ytDlpBin: (env.YTDLP_BIN || 'yt-dlp').trim(),
    ffmpegBin: (env.FFMPEG_BIN || 'ffmpeg').trim(),
    ffprobeBin: (env.FFPROBE_BIN || 'ffprobe').trim(),
    geminiApiKey: (env.GEMINI_API_KEY || '').trim(),
    defaultAppRelease: {
      versionCode: Number(env.APP_LATEST_VERSION_CODE) || 1,
      versionName: env.APP_LATEST_VERSION_NAME || '1.0.0',
      downloadUrl: env.APP_DOWNLOAD_URL || '',
      releaseNotes: env.APP_RELEASE_NOTES || '',
      forceUpdate: parseBool(env.APP_FORCE_UPDATE, false),
    },
  }
}

export function validateProductionConfig(config) {
  if (config.nodeEnv !== 'production') return

  const problems = []
  if (!config.databaseUrl) problems.push('DATABASE_URL must be set to your Neon/Postgres URL.')
  if (!config.adminSecret || config.adminSecret.length < 12 || PLACEHOLDER_SECRETS.has(config.adminSecret)) {
    problems.push('ADMIN_SECRET must be at least 12 characters and not a placeholder value.')
  }
  if (!config.tokenSecret || config.tokenSecret.length < 16 || PLACEHOLDER_SECRETS.has(config.tokenSecret)) {
    problems.push('TOKEN_SECRET must be at least 16 characters and not a placeholder value.')
  }
  if (config.storageMode === 'local' && !config.allowLocalStorageInProd) {
    problems.push('STORAGE_MODE=local is unsafe on ephemeral hosts like Render. Configure Cloudflare R2 (STORAGE_MODE=r2).')
  }

  if (problems.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${problems.join('\n- ')}`)
  }
}
