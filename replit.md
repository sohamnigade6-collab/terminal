# Blossom Terminal

A Bloomberg-style intelligence terminal with a dark terminal aesthetic (near-black + neon green). Shows global news, markets, local weather, AI Intel Brief, and a Trading tab with live Alpaca paper trading.

## Architecture

- **Frontend**: React + Vite (TypeScript), port 5000
- **Backend**: Hono API server on Bun, port 3001
- **Database**: PostgreSQL (Replit-managed) for auth sessions, allowed emails, trade log
- Frontend proxies `/api/*` → backend via Vite dev proxy

## Project Structure

```
frontend/
  src/
    components/       - NewsPanel, MarketsPanel, LocalPanel, IntelPanel, TradingPanel, LoginScreen, SettingsModal
    contexts/         - AuthContext (Google OAuth session management)
    hooks/            - useDashboard, useSettings
    types.ts          - Shared types
  vite.config.ts      - host 0.0.0.0, port 5000, allowedHosts: true, /api proxy

backend/
  src/
    routes/           - news, markets, weather, intel, trading (Alpaca proxy), auth (Google OAuth)
    middleware/       - requireAuth (session validation)
    services/         - db (PostgreSQL pool)
    index.ts          - Bun serve entry
    app.ts            - Hono app with routes
```

## Auth System

- Google OAuth 2.0 (manual implementation, no library)
- Only emails in `allowed_emails` table can log in
- Sessions stored in `sessions` table (30-day TTL)
- Token passed as `Authorization: Bearer <token>` header
- Frontend: `AuthContext` reads session from URL `?session=` param on OAuth callback, then from localStorage

### Required env vars
- `GOOGLE_CLIENT_ID` — from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- Redirect URI to register: `https://<REPLIT_DEV_DOMAIN>/api/auth/google/callback`

## Trading System

- Alpaca paper trading API proxy in `/api/trading/*`
- Placing + canceling orders requires auth (session token)
- Every placed order is logged to `trade_log` table with user email/name
- TradingView widget for charting

### Required env vars
- `ALPACA_KEY_ID`
- `ALPACA_SECRET_KEY`
- `ALPACA_BASE_URL` (default: `https://paper-api.alpaca.markets`)

## Database Tables

```sql
allowed_emails (email PK, added_at, added_by)
sessions       (id PK, email, name, avatar, created_at, expires_at)
trade_log      (id serial PK, user_email, user_name, symbol, side, qty, order_type, time_in_force, limit_price, alpaca_order_id, alpaca_status, created_at)
```

## Theme

- `--bb-black: #060806` near-black background
- `--bb-orange: #00e676` neon green (primary accent)
- JetBrains Mono font
- Bloomberg-style terminal UI
