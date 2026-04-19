import { Hono } from 'hono'

const router = new Hono()

interface NasdaqRow {
    symbol: string
    name: string
    marketCap: string
    fiscalQuarterEnding: string
    epsForecast: string
    noOfEsts: string
    lastYearRptDt: string
    lastYearEPS: string
    time: string
}

router.get('/', async (c) => {
    const date = c.req.query('date') ?? new Date().toISOString().split('T')[0]
    try {
        const res = await fetch(
            `https://api.nasdaq.com/api/calendar/earnings?date=${date}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Accept: 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    Referer: 'https://www.nasdaq.com/',
                },
                signal: AbortSignal.timeout(12000),
            }
        )
        if (!res.ok) {
            const text = await res.text()
            return c.json({ rows: [], date, error: `NASDAQ ${res.status}: ${text.slice(0, 120)}` })
        }
        const data = await res.json() as {
            data?: { rows?: NasdaqRow[] | null }
        }
        const rows = data.data?.rows ?? []
        return c.json({ rows, date })
    } catch (e) {
        return c.json({ rows: [], date, error: String(e) })
    }
})

export default router
