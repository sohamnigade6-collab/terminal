import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import newsRouter from './routes/news.ts'
import marketsRouter from './routes/markets.ts'
import weatherRouter from './routes/weather.ts'
import intelRouter from './routes/intel.ts'
import tradingRouter from './routes/trading.ts'
import authRouter from './routes/auth.ts'

const app = new Hono().basePath('/api')

const allowedOrigins = (process.env.FRONTEND_URL ?? '').split(',').filter(Boolean)
app.use(
    '*',
    cors({
        origin: (origin) => {
            if (!origin) return '*'
            if (allowedOrigins.length === 0) return origin
            if (allowedOrigins.some((o) => origin.startsWith(o.trim()))) return origin
            if (origin.includes('localhost') || origin.includes('vercel.app') || origin.includes('replit.dev')) return origin
            return origin
        },
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    })
)

app.use('*', logger())

app.get('/', (c) => c.json({ name: 'aob-api', version: '1.0.0', status: 'ok' }))

app.route('/auth', authRouter)
app.route('/news', newsRouter)
app.route('/markets', marketsRouter)
app.route('/weather', weatherRouter)
app.route('/intel', intelRouter)
app.route('/trading', tradingRouter)

export default app
