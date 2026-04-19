import { Hono } from 'hono'
import { requireAuth } from '../middleware/requireAuth.ts'
import { query } from '../services/db.ts'

const router = new Hono()

const ALPACA_BASE = (process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets').replace(/\/$/, '')
const KEY_ID = process.env.ALPACA_KEY_ID ?? ''
const SECRET_KEY = process.env.ALPACA_SECRET_KEY ?? ''

function alpacaHeaders() {
    return {
        'APCA-API-KEY-ID': KEY_ID,
        'APCA-API-SECRET-KEY': SECRET_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    }
}

async function alpacaFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${ALPACA_BASE}${path}`, {
        ...options,
        headers: { ...alpacaHeaders(), ...(options.headers ?? {}) },
        signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Alpaca ${res.status}: ${text}`)
    }
    return res.json()
}

// ── Public read endpoints (no auth required for account/positions/orders view) ─
router.get('/account', async (c) => {
    try {
        const data = await alpacaFetch('/v2/account')
        return c.json(data)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

router.get('/positions', async (c) => {
    try {
        const data = await alpacaFetch('/v2/positions')
        return c.json(data)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

router.get('/orders', async (c) => {
    try {
        const status = c.req.query('status') ?? 'all'
        const limit = c.req.query('limit') ?? '20'
        const data = await alpacaFetch(`/v2/orders?status=${status}&limit=${limit}&direction=desc`)
        return c.json(data)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Place order — requires auth, logs trade ────────────────────────────────
router.post('/orders', requireAuth, async (c) => {
    try {
        const user = c.get('user')
        const body = await c.req.json()

        const data = await alpacaFetch('/v2/orders', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as { id?: string; status?: string }

        // Log trade to database
        await query(
            `INSERT INTO trade_log
             (user_email, user_name, symbol, side, qty, order_type, time_in_force, limit_price, alpaca_order_id, alpaca_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                user.email,
                user.name,
                body.symbol,
                body.side,
                parseFloat(body.qty),
                body.type,
                body.time_in_force ?? 'day',
                body.limit_price ? parseFloat(body.limit_price) : null,
                data.id ?? null,
                data.status ?? 'submitted',
            ]
        ).catch((err) => console.error('Trade log error:', err))

        return c.json(data)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Cancel order — requires auth ───────────────────────────────────────────
router.delete('/orders/:id', requireAuth, async (c) => {
    try {
        const id = c.req.param('id')
        const res = await fetch(`${ALPACA_BASE}/v2/orders/${id}`, {
            method: 'DELETE',
            headers: alpacaHeaders(),
            signal: AbortSignal.timeout(15000),
        })
        if (!res.ok && res.status !== 204) {
            const text = await res.text().catch(() => '')
            throw new Error(`Alpaca ${res.status}: ${text}`)
        }
        return c.json({ success: true })
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Quote ──────────────────────────────────────────────────────────────────
router.get('/quote/:symbol', async (c) => {
    try {
        const symbol = c.req.param('symbol').toUpperCase()
        const data = await alpacaFetch(`/v2/stocks/${symbol}/quotes/latest`)
        return c.json(data)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

export default router
