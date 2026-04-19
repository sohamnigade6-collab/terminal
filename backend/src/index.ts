import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { join, resolve } from 'path'
import newsRouter from './routes/news.ts'
import marketsRouter from './routes/markets.ts'
import weatherRouter from './routes/weather.ts'
import intelRouter from './routes/intel.ts'
import tradingRouter from './routes/trading.ts'
import authRouter from './routes/auth.ts'
import earningsRouter from './routes/earnings.ts'
import { query } from './services/db.ts'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const PUBLIC_DIR = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : ''

// Run schema migrations and seed on startup
async function migrate() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id         VARCHAR(128) PRIMARY KEY,
                email      VARCHAR(255) NOT NULL,
                name       VARCHAR(255),
                avatar     VARCHAR(512),
                created_at TIMESTAMP DEFAULT now(),
                expires_at TIMESTAMP NOT NULL
            )
        `)
        await query(`
            CREATE TABLE IF NOT EXISTS allowed_emails (
                id       SERIAL PRIMARY KEY,
                email    VARCHAR(255) NOT NULL UNIQUE,
                added_at TIMESTAMP DEFAULT now(),
                added_by VARCHAR(255)
            )
        `)
        await query(`
            CREATE TABLE IF NOT EXISTS trade_log (
                id              SERIAL PRIMARY KEY,
                user_email      VARCHAR(255) NOT NULL,
                user_name       VARCHAR(255),
                symbol          VARCHAR(20)  NOT NULL,
                side            VARCHAR(10)  NOT NULL,
                qty             NUMERIC(18,8) NOT NULL,
                order_type      VARCHAR(20)  NOT NULL,
                time_in_force   VARCHAR(10),
                limit_price     NUMERIC(18,4),
                alpaca_order_id VARCHAR(100),
                alpaca_status   VARCHAR(50),
                created_at      TIMESTAMP DEFAULT now()
            )
        `)

        // Seed admin email from env var (idempotent)
        const adminEmail = process.env.ADMIN_EMAIL
        if (adminEmail) {
            await query(
                `INSERT INTO allowed_emails (email, added_by)
                 VALUES ($1, 'startup-seed')
                 ON CONFLICT (email) DO NOTHING`,
                [adminEmail]
            )
            console.log(`[migrate] ensured ${adminEmail} in allowed_emails`)
        }

        console.log('[migrate] schema ready')
    } catch (err) {
        console.error('[migrate] error:', err)
    }
}

// Build a Hono app with all API routes mounted at /api/*
function buildApp() {
    const app = new Hono()

    const allowedOrigins = (process.env.FRONTEND_URL ?? '').split(',').filter(Boolean)
    app.use(
        '*',
        cors({
            origin: (origin) => {
                if (!origin) return '*'
                if (allowedOrigins.length === 0) return origin
                if (allowedOrigins.some((o) => origin.startsWith(o.trim()))) return origin
                if (
                    origin.includes('localhost') ||
                    origin.includes('vercel.app') ||
                    origin.includes('replit.dev') ||
                    origin.includes('replit.app')
                )
                    return origin
                return origin
            },
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
        })
    )
    app.use('*', logger())

    // API routes — mounted directly at /api/* (no basePath proxy needed)
    app.route('/api/auth', authRouter)
    app.route('/api/news', newsRouter)
    app.route('/api/markets', marketsRouter)
    app.route('/api/weather', weatherRouter)
    app.route('/api/intel', intelRouter)
    app.route('/api/trading', tradingRouter)
    app.route('/api/earnings', earningsRouter)
    app.get('/api', (c) => c.json({ name: 'aob-api', version: '1.0.0', status: 'ok' }))

    // Static file serving (production only — when PUBLIC_DIR is set)
    if (PUBLIC_DIR) {
        const MIME: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.js':   'text/javascript; charset=utf-8',
            '.mjs':  'text/javascript; charset=utf-8',
            '.css':  'text/css; charset=utf-8',
            '.json': 'application/json',
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif':  'image/gif',
            '.svg':  'image/svg+xml',
            '.ico':  'image/x-icon',
            '.woff': 'font/woff',
            '.woff2':'font/woff2',
            '.ttf':  'font/ttf',
            '.map':  'application/json',
        }

        function mimeFor(filePath: string): string {
            const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
            return MIME[ext] ?? 'application/octet-stream'
        }

        app.get('*', async (c) => {
            const reqPath = c.req.path
            const filePath = join(PUBLIC_DIR, reqPath === '/' ? 'index.html' : reqPath)
            const file = Bun.file(filePath)

            if (await file.exists()) {
                return new Response(file, {
                    headers: { 'Content-Type': mimeFor(filePath) },
                })
            }

            // SPA fallback
            return new Response(Bun.file(join(PUBLIC_DIR, 'index.html')), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
        })
    }

    return app
}

const app = buildApp()

migrate().then(() => {
    console.log(
        PUBLIC_DIR
            ? `AOB Terminal running on http://localhost:${PORT} (serving from ${PUBLIC_DIR})`
            : `AOB API running on http://localhost:${PORT}`
    )
})

export default {
    port: PORT,
    fetch: app.fetch,
}
