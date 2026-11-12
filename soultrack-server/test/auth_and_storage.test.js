import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createLoginRateLimiter, safeEqual, signAdminToken, verifyAdminToken } from '../src/auth.js'
import { loadConfig, validateProductionConfig } from '../src/config.js'
import { normalizeCookiesText } from '../src/media.js'
import { createStorage } from '../src/storage.js'

test('safeEqual and admin token signing/verification work with expiry', () => {
  assert.equal(safeEqual('secret-123', 'secret-123'), true)
  assert.equal(safeEqual('secret-123', 'secret-124'), false)
  assert.equal(safeEqual('short', 'much-longer-string'), false)

  const token = signAdminToken('my-signing-key', 60, 1000)
  assert.equal(verifyAdminToken(token, 'my-signing-key', 1030), true)
  assert.equal(verifyAdminToken(token, 'wrong-key', 1030), false)
  assert.equal(verifyAdminToken(token, 'my-signing-key', 1061), false)
})

test('login rate limiter blocks after max attempts and resets after window', () => {
  const limiter = createLoginRateLimiter({ windowMs: 1000, maxAttempts: 2 })
  assert.equal(limiter.check('1.2.3.4', 100).allowed, true)
  limiter.recordFailure('1.2.3.4', 100)
  limiter.recordFailure('1.2.3.4', 200)
  assert.equal(limiter.check('1.2.3.4', 300).allowed, false)
  assert.equal(limiter.check('1.2.3.4', 1201).allowed, true)
})

test('local storage stores, deletes, and rejects path traversal', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'soultrack-storage-test-'))
  try {
    const srcFile = path.join(tmpDir, 'sample.mp3')
    await fs.writeFile(srcFile, 'audio-bytes')

    const storage = createStorage(loadConfig({
      STORAGE_MODE: 'local',
      LOCAL_MEDIA_DIR: path.join(tmpDir, 'media'),
      PUBLIC_BASE_URL: 'http://localhost:3000',
    }))

    const url = await storage.putFile({
      key: 'songs/test.mp3',
      filePath: srcFile,
      contentType: 'audio/mpeg',
    })
    assert.equal(url, 'http://localhost:3000/media/songs/test.mp3')

    await assert.rejects(() =>
      storage.putFile({ key: '../escape.mp3', filePath: srcFile, contentType: 'audio/mpeg' })
    )

    await storage.deleteKeys(['songs/test.mp3'])
    await assert.rejects(() => fs.stat(path.join(tmpDir, 'media', 'songs', 'test.mp3')))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('validateProductionConfig enforces Neon URL, strong secrets, and cloud storage in production', () => {
  // Development config is allowed without production credentials
  assert.doesNotThrow(() => validateProductionConfig(loadConfig({ NODE_ENV: 'development' })))

  // Missing DB URL, placeholder secrets, and local storage fail in production
  assert.throws(
    () => validateProductionConfig(loadConfig({
      NODE_ENV: 'production',
      ADMIN_SECRET: 'change-me-to-a-long-random-secret',
      TOKEN_SECRET: 'short',
      STORAGE_MODE: 'local',
    })),
    /Invalid production configuration/
  )

  // Local storage only allowed with explicit opt-in override
  assert.throws(
    () => validateProductionConfig(loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
      ADMIN_SECRET: 'strong-admin-secret-99',
      TOKEN_SECRET: 'strong-signing-token-secret-1234',
      STORAGE_MODE: 'local',
    })),
    /STORAGE_MODE=local/
  )

  // Valid Neon + R2 production configuration passes
  assert.doesNotThrow(() => validateProductionConfig(loadConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
    ADMIN_SECRET: 'strong-admin-secret-99',
    TOKEN_SECRET: 'strong-signing-token-secret-1234',
    R2_ACCOUNT_ID: 'acc-123',
    R2_ACCESS_KEY_ID: 'key-123',
    R2_SECRET_ACCESS_KEY: 'secret-123',
    R2_BUCKET: 'soultrack-media',
    R2_PUBLIC_URL: 'https://pub-example.r2.dev',
  })))
})

test('loadConfig sets yt-dlp runtime defaults and optional cookies/proxy overrides', () => {
  const defaults = loadConfig({})
  assert.equal(defaults.ytDlpJsRuntime, 'node')
  assert.equal(defaults.ytDlpCookiesB64, '')
  assert.equal(defaults.ytDlpCookiesFile, '')
  assert.equal(defaults.ytDlpProxy, '')

  const custom = loadConfig({
    YTDLP_JS_RUNTIME: '',
    YTDLP_COOKIES_B64: 'IyBOZXRzY2FwZQ==',
    YTDLP_COOKIES_FILE: '/tmp/cookies.txt',
    YTDLP_PROXY: 'http://127.0.0.1:8888',
  })
  assert.equal(custom.ytDlpJsRuntime, '')
  assert.equal(custom.ytDlpCookiesB64, 'IyBOZXRzY2FwZQ==')
  assert.equal(custom.ytDlpCookiesFile, '/tmp/cookies.txt')
  assert.equal(custom.ytDlpProxy, 'http://127.0.0.1:8888')
})

test('normalizeCookiesText strips BOM and converts CRLF to LF', () => {
  const dirty = '\uFEFF# Netscape HTTP Cookie File\r\n.youtube.com\tTRUE\t/\tTRUE\t0\ta\tb\r\n'
  assert.equal(
    normalizeCookiesText(dirty),
    '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\ta\tb'
  )
})
