import apiApp from './app.ts'
import { Hono } from 'hono'
import { join, resolve } from 'path'

const PORT = parseInt(process.env.PORT ?? '3001', 10)

// When PUBLIC_DIR is set (production), serve the frontend build + API together.
// Otherwise (local dev), serve API only — the Vite dev server handles the frontend.
const PUBLIC_DIR = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : ''

let serverFetch: (req: Request) => Response | Promise<Response>

if (PUBLIC_DIR) {
    const root = new Hono()

    // Forward all /api/* requests to the API app (which uses basePath('/api'))
    root.all('/api/*', (c) => apiApp.fetch(c.req.raw, c.env))

    // Serve static files for everything else, with SPA fallback
    root.get('*', async (c) => {
        const reqPath = c.req.path
        const filePath = join(PUBLIC_DIR, reqPath === '/' ? 'index.html' : reqPath)
        const file = Bun.file(filePath)

        if (await file.exists()) {
            return new Response(file)
        }

        // SPA fallback: return index.html for unknown paths (client-side routing)
        return new Response(Bun.file(join(PUBLIC_DIR, 'index.html')), {
            headers: { 'Content-Type': 'text/html' },
        })
    })

    serverFetch = root.fetch
    console.log(`AOB Terminal running on http://localhost:${PORT} (serving from ${PUBLIC_DIR})`)
} else {
    serverFetch = apiApp.fetch
    console.log(`AOB API running on http://localhost:${PORT}`)
}

export default {
    port: PORT,
    fetch: serverFetch,
}
