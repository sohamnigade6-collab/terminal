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

// ── Stock news (Alpaca data API) ───────────────────────────────────────────
router.get('/stock-news/:symbol', async (c) => {
    try {
        const symbol = c.req.param('symbol').toUpperCase()
        const res = await fetch(
            `https://data.alpaca.markets/v1beta1/news?symbols=${symbol}&limit=12&sort=desc`,
            {
                headers: {
                    'APCA-API-KEY-ID': KEY_ID,
                    'APCA-API-SECRET-KEY': SECRET_KEY,
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(10000),
            }
        )
        if (!res.ok) throw new Error(`Alpaca news ${res.status}`)
        const data = await res.json() as { news: Array<{ id: number; headline: string; summary: string; author: string; created_at: string; url: string; source: string; symbols: string[] }> }
        return c.json(data.news ?? [])
    } catch (e) {
        return c.json({ error: String(e) }, 500)
    }
})

// ── Latest quote / price via Yahoo Finance ────────────────────────────────
router.get('/quote/:symbol', async (c) => {
    const symbol = c.req.param('symbol').toUpperCase()
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
            {
                headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(8000),
            }
        )
        if (!res.ok) return c.json({ symbol, price: null, error: `YF ${res.status}` })
        const data = await res.json() as {
            chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }>; error?: unknown }
        }
        const price = data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
        return c.json({ symbol, price })
    } catch (e) {
        return c.json({ symbol, price: null, error: String(e) })
    }
})

// ── Company overview via Yahoo Finance + Wikipedia (fully free, no API key) ─
router.get('/stock-brief/:symbol', async (c) => {
    const symbol = c.req.param('symbol').toUpperCase()
    try {
        // Step 1: get company longName from Yahoo Finance v8 chart (already working)
        const chartRes = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
            {
                headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(8000),
            }
        )
        const chartData = await chartRes.json() as {
            chart?: { result?: Array<{ meta?: { longName?: string; shortName?: string; currency?: string; exchangeName?: string } }> }
        }
        const meta = chartData.chart?.result?.[0]?.meta
        const longName = meta?.longName ?? meta?.shortName ?? symbol
        const exchange = meta?.exchangeName ?? null

        // Step 2: Wikipedia REST API for company description (completely free, no key)
        const wikiRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(longName)}`,
            {
                headers: { 'User-Agent': 'AOBTerminal/1.0 (financial dashboard; contact: user)' },
                signal: AbortSignal.timeout(8000),
            }
        )
        let brief: string | null = null
        if (wikiRes.ok) {
            const wikiData = await wikiRes.json() as { extract?: string; type?: string }
            if (wikiData.extract && wikiData.type !== 'disambiguation') {
                // Trim to ~5 sentences
                const sentences = wikiData.extract.split(/(?<=[.!?])\s+/)
                brief = sentences.slice(0, 5).join(' ')
            }
        }
        // If Wikipedia failed (e.g. obscure ticker), try with shortName
        if (!brief && meta?.shortName && meta.shortName !== longName) {
            const wikiRes2 = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(meta.shortName)}`,
                {
                    headers: { 'User-Agent': 'AOBTerminal/1.0' },
                    signal: AbortSignal.timeout(6000),
                }
            )
            if (wikiRes2.ok) {
                const d = await wikiRes2.json() as { extract?: string; type?: string }
                if (d.extract && d.type !== 'disambiguation') {
                    const sentences = d.extract.split(/(?<=[.!?])\s+/)
                    brief = sentences.slice(0, 5).join(' ')
                }
            }
        }

        return c.json({
            brief,
            longName,
            exchange,
            sector: null,
            industry: null,
        })
    } catch (e) {
        return c.json({ brief: null, error: String(e) })
    }
})

export default router
