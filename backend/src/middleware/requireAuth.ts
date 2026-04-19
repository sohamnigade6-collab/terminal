import type { Context, Next } from 'hono'
import { query } from '../services/db.ts'

export interface AuthUser {
    email: string
    name: string
    avatar: string
}

declare module 'hono' {
    interface ContextVariableMap {
        user: AuthUser
    }
}

export async function requireAuth(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization') ?? ''
    const sessionId = authHeader.replace('Bearer ', '').trim()

    if (!sessionId) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
        const rows = await query<AuthUser & { expires_at: string }>(
            'SELECT email, name, avatar, expires_at FROM sessions WHERE id = $1',
            [sessionId]
        )
        if (rows.length === 0) return c.json({ error: 'Invalid session' }, 401)
        const session = rows[0]
        if (new Date(session.expires_at) < new Date()) {
            await query('DELETE FROM sessions WHERE id = $1', [sessionId])
            return c.json({ error: 'Session expired' }, 401)
        }
        c.set('user', { email: session.email, name: session.name, avatar: session.avatar })
        await next()
    } catch {
        return c.json({ error: 'Auth error' }, 500)
    }
}
