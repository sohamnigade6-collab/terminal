import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: (process.env.DATABASE_URL?.includes('sslmode=require') ||
              process.env.DATABASE_URL?.includes('neon.tech'))
                ? { rejectUnauthorized: false }
                : false,
        })
    }
    return pool
}

export async function query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const client = getPool()
    const result = await client.query(sql, params)
    return result.rows as T[]
}
