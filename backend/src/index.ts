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

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const PUBLIC_DIR = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : ''

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
        app.get('*', async (c) => {
            const reqPath = c.req.path
            const filePath = join(PUBLIC_DIR, reqPath === '/' ? 'index.html' : reqPath)
            const file = Bun.file(filePath)

            if (await file.exists()) {
                return new Response(file)
            }

            // SPA fallback
            return new Response(Bun.file(join(PUBLIC_DIR, 'index.html')), {
                headers: { 'Content-Type': 'text/html' },
            })
        })
    }

    return app
}

const app = buildApp()

console.log(
    PUBLIC_DIR
        ? `AOB Terminal running on http://localhost:${PORT} (serving from ${PUBLIC_DIR})`
        : `AOB API running on http://localhost:${PORT}`
)

export default {
    port: PORT,
    fetch: app.fetch,
}
