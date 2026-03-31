# Blossom Terminal

An intelligence terminal / dashboard with a dark terminal aesthetic. Shows global news, markets, local weather, and an AI Intel Brief.

## Architecture

- **Frontend**: React + Vite (TypeScript), running on port 5000
- **Backend**: Hono API server running on Bun, running on port 3001
- Frontend proxies `/api/*` requests to the backend via Vite dev proxy

## Project Structure

```
frontend/        - React + Vite frontend app
  src/
    components/  - Panel components (News, Markets, Local, Intel, Settings)
    hooks/       - useDashboard, useSettings
    types.ts     - Shared types
  vite.config.ts - Configured for host 0.0.0.0, port 5000, allowedHosts: true

backend/         - Hono API server (Bun runtime)
  src/
    app.ts       - Hono app with CORS and route setup
    index.ts     - Entry point (port 3001)
    routes/      - news, markets, weather, intel route handlers
    services/    - cache, threatClassifier
```

## Workflows

- **Start application**: `cd frontend && bun run dev` (port 5000, webview)
- **Backend API**: `cd backend && bun run dev` (port 3001, console)

## Environment Variables

Backend (copy from `backend/.env.example`):
- `OPENAI_API_KEY` - Required for the Intel Brief feature
- `PORT` - Backend port (default 3001)
- `FRONTEND_URL` - CORS allowed origin

## Key Notes

- Uses Bun as the JavaScript runtime and package manager for both frontend and backend
- Frontend uses `bun.lock` for lockfile
- The Intel Brief panel requires an OpenAI API key to function
