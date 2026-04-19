import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { query } from '../services/db.ts'
import crypto from 'crypto'

const router = new Hono()

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? '').trim()
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()

// BACKEND_URL is set in production (Vercel). Falls back to Replit dev domain locally.
const BACKEND_URL = process.env.BACKEND_URL
    ? process.env.BACKEND_URL.replace(/\/$/, '')
    : `https://${process.env.REPLIT_DEV_DOMAIN ?? 'localhost:3001'}`
const REDIRECT_URI = `${BACKEND_URL}/api/auth/google/callback`
const SESSION_TTL_DAYS = 30

function randomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex')
}

// ── GET /api/auth/google → redirect to Google OAuth ───────────────────────
router.get('/google', (c) => {
    if (!GOOGLE_CLIENT_ID) {
        return c.json({ error: 'Google OAuth not configured — set GOOGLE_CLIENT_ID' }, 500)
    }
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
    })
    return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// ── GET /api/auth/google/callback → exchange code, create session ─────────
router.get('/google/callback', async (c) => {
    const code = c.req.query('code')
    if (!code) {
        return c.redirect('/?auth_error=no_code')
    }

    try {
        // Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            }),
        })
        const tokens: { access_token?: string; error?: string } = await tokenRes.json()
        if (!tokens.access_token) throw new Error(tokens.error ?? 'No access token')

        // Get user info
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        const user: { email: string; name?: string; picture?: string } = await userRes.json()
        if (!user.email) throw new Error('No email from Google')

        // Check if email is allowed
        const allowed = await query<{ email: string }>(
            'SELECT email FROM allowed_emails WHERE LOWER(email) = LOWER($1)',
            [user.email]
        )
        if (allowed.length === 0) {
            return c.redirect(`/?auth_error=not_authorized&email=${encodeURIComponent(user.email)}`)
        }

        // Create session
        const sessionId = randomToken(48)
        const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400000)
        await query(
            `INSERT INTO sessions (id, email, name, avatar, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO NOTHING`,
            [sessionId, user.email, user.name ?? '', user.picture ?? '', expiresAt]
        )

        // Redirect to frontend with session token as query param
        return c.redirect(`/?session=${sessionId}`)
    } catch (e) {
        console.error('OAuth callback error:', e)
        return c.redirect(`/?auth_error=callback_failed`)
    }
})

// ── GET /api/auth/me → validate session, return user ─────────────────────
router.get('/me', async (c) => {
    const authHeader = c.req.header('Authorization') ?? ''
    const sessionId = authHeader.replace('Bearer ', '').trim() || getCookie(c, 'session') || ''

    if (!sessionId) return c.json({ user: null })

    try {
        const rows = await query<{ email: string; name: string; avatar: string; expires_at: string }>(
            'SELECT email, name, avatar, expires_at FROM sessions WHERE id = $1',
            [sessionId]
        )
        if (rows.length === 0) return c.json({ user: null })
        const session = rows[0]
        if (new Date(session.expires_at) < new Date()) {
            await query('DELETE FROM sessions WHERE id = $1', [sessionId])
            return c.json({ user: null })
        }
        return c.json({ user: { email: session.email, name: session.name, avatar: session.avatar } })
    } catch {
        return c.json({ user: null })
    }
})

// ── POST /api/auth/logout ──────────────────────────────────────────────────
router.post('/logout', async (c) => {
    const authHeader = c.req.header('Authorization') ?? ''
    const sessionId = authHeader.replace('Bearer ', '').trim()
    if (sessionId) {
        await query('DELETE FROM sessions WHERE id = $1', [sessionId]).catch(() => null)
    }
    deleteCookie(c, 'session')
    return c.json({ success: true })
})

// ── Admin gate ─────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'sohamnigade08@gmail.com'

async function resolveSessionEmail(authHeader: string): Promise<string | null> {
    const sessionId = authHeader.replace('Bearer ', '').trim()
    if (!sessionId) return null
    try {
        const rows = await query<{ email: string; expires_at: string }>(
            'SELECT email, expires_at FROM sessions WHERE id = $1', [sessionId]
        )
        if (rows.length === 0) return null
        if (new Date(rows[0].expires_at) < new Date()) return null
        return rows[0].email
    } catch { return null }
}

async function requireAdmin(c: Parameters<Parameters<typeof router.get>[1]>[0]) {
    const email = await resolveSessionEmail(c.req.header('Authorization') ?? '')
    if (!email || email.toLowerCase() !== ADMIN_EMAIL) {
        return false
    }
    return true
}

// ── Admin: list allowed emails ─────────────────────────────────────────────
router.get('/allowed-emails', async (c) => {
    if (!await requireAdmin(c)) return c.json({ error: 'Forbidden' }, 403)
    try {
        const rows = await query<{ email: string; added_at: string; added_by: string }>(
            'SELECT email, added_at, added_by FROM allowed_emails ORDER BY added_at DESC'
        )
        return c.json(rows)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Admin: add allowed email ───────────────────────────────────────────────
router.post('/allowed-emails', async (c) => {
    if (!await requireAdmin(c)) return c.json({ error: 'Forbidden' }, 403)
    try {
        const { email, added_by } = await c.req.json()
        if (!email) return c.json({ error: 'email required' }, 400)
        await query(
            'INSERT INTO allowed_emails (email, added_by) VALUES (LOWER($1), $2) ON CONFLICT (email) DO NOTHING',
            [email, added_by ?? 'admin']
        )
        return c.json({ success: true, email: email.toLowerCase() })
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Admin: remove allowed email ────────────────────────────────────────────
router.delete('/allowed-emails/:email', async (c) => {
    if (!await requireAdmin(c)) return c.json({ error: 'Forbidden' }, 403)
    try {
        const email = decodeURIComponent(c.req.param('email'))
        await query('DELETE FROM allowed_emails WHERE LOWER(email) = LOWER($1)', [email])
        return c.json({ success: true })
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Trade log ──────────────────────────────────────────────────────────────
router.get('/trade-log', async (c) => {
    if (!await requireAdmin(c)) return c.json({ error: 'Forbidden' }, 403)
    try {
        const rows = await query(
            `SELECT * FROM trade_log ORDER BY created_at DESC LIMIT 100`
        )
        return c.json(rows)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Admin: clear trade log ─────────────────────────────────────────────────
router.delete('/trade-log', async (c) => {
    if (!await requireAdmin(c)) return c.json({ error: 'Forbidden' }, 403)
    try {
        await query('DELETE FROM trade_log')
        return c.json({ success: true })
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

export default router
