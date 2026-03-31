import { Hono } from 'hono'

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

// ── Account ────────────────────────────────────────────────────────────────
router.get('/account', async (c) => {
    try {
        const data = await alpacaFetch('/v2/account')
        return c.json(data)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Positions ──────────────────────────────────────────────────────────────
router.get('/positions', async (c) => {
    try {
        const data = await alpacaFetch('/v2/positions')
        return c.json(data)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Orders ─────────────────────────────────────────────────────────────────
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

// ── Place order ────────────────────────────────────────────────────────────
router.post('/orders', async (c) => {
    try {
        const body = await c.req.json()
        const data = await alpacaFetch('/v2/orders', {
            method: 'POST',
            body: JSON.stringify(body),
        })
        return c.json(data)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Cancel order ───────────────────────────────────────────────────────────
router.delete('/orders/:id', async (c) => {
    try {
        const id = c.req.param('id')
        await fetch(`${ALPACA_BASE}/v2/orders/${id}`, {
            method: 'DELETE',
            headers: alpacaHeaders(),
            signal: AbortSignal.timeout(15000),
        })
        return c.json({ success: true })
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Asset search (for autocomplete) ───────────────────────────────────────
router.get('/assets', async (c) => {
    try {
        const q = c.req.query('q') ?? ''
        const data = await alpacaFetch(`/v2/assets?status=active&asset_class=us_equity`)
        const assets = (data as Array<{ symbol: string; name: string; tradable: boolean }>)
            .filter((a) => a.tradable && (
                a.symbol.toUpperCase().includes(q.toUpperCase()) ||
                a.name.toLowerCase().includes(q.toLowerCase())
            ))
            .slice(0, 10)
            .map((a) => ({ symbol: a.symbol, name: a.name }))
        return c.json(assets)
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Latest quote for a symbol ──────────────────────────────────────────────
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
