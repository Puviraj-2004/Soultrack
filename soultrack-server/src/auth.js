import crypto from 'node:crypto'

const TOKEN_TTL_SECONDS = 24 * 60 * 60

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const digestA = crypto.createHash('sha256').update(a).digest()
  const digestB = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(digestA, digestB)
}

function encodeBase64Url(input) {
  return Buffer.from(input).toString('base64url')
}

export function signAdminToken(secret, ttlSeconds = TOKEN_TTL_SECONDS, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error('TOKEN_SECRET or ADMIN_SECRET must be set.')
  const payload = encodeBase64Url(JSON.stringify({ role: 'admin', iat: nowSeconds, exp: nowSeconds + ttlSeconds }))
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyAdminToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token || !secret || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [payload, sig] = parts
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (!safeEqual(sig, expectedSig)) return false

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return parsed.role === 'admin' && Number(parsed.exp) > nowSeconds
  } catch {
    return false
  }
}

export function createFixedWindowRateLimiter({ windowMs = 60 * 1000, maxRequests = 60 } = {}) {
  const buckets = new Map()

  return {
    consume(key, now = Date.now()) {
      const entry = buckets.get(key)
      if (!entry || now > entry.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfterSec: 0 }
      }
      if (entry.count >= maxRequests) {
        return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
      }
      entry.count += 1
      return { allowed: true, retryAfterSec: 0 }
    },
  }
}

export function createLoginRateLimiter({ windowMs = 15 * 60 * 1000, maxAttempts = 10 } = {}) {
  const buckets = new Map()

  return {
    check(ip, now = Date.now()) {
      const entry = buckets.get(ip)
      if (!entry || now > entry.resetAt) return { allowed: true, retryAfterSec: 0 }
      if (entry.count >= maxAttempts) {
        return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
      }
      return { allowed: true, retryAfterSec: 0 }
    },
    recordFailure(ip, now = Date.now()) {
      const entry = buckets.get(ip)
      if (!entry || now > entry.resetAt) {
        buckets.set(ip, { count: 1, resetAt: now + windowMs })
      } else {
        entry.count += 1
      }
    },
    reset(ip) {
      buckets.delete(ip)
    },
  }
}

export function requireAdmin(config) {
  return (req, res, next) => {
    const header = req.headers.authorization || ''
    const match = header.match(/^Bearer\s+(.+)$/i)
    const token = match?.[1]?.trim()

    if (!token || !config.adminSecret) {
      return res.status(401).json({ error: 'Admin authentication required.' })
    }

    const validToken = verifyAdminToken(token, config.tokenSecret)
    const validDirectSecret = safeEqual(token, config.adminSecret)
    if (!validToken && !validDirectSecret) {
      return res.status(401).json({ error: 'Invalid or expired admin credentials.' })
    }

    next()
  }
}
