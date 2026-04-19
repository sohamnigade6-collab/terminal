import app from './app.ts'

// Local dev entry point (Bun)
const PORT = parseInt(process.env.PORT ?? '3001', 10)
console.log(`AOB API running on http://localhost:${PORT}`)

export default {
    port: PORT,
    fetch: app.fetch,
}
