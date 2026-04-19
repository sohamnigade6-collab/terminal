import { useEffect, useRef, useState, useCallback } from 'react'
import {
    TrendingUp, TrendingDown, RefreshCw, X, ChevronDown,
    DollarSign, Activity, BarChart2, Clock, AlertCircle, Newspaper, Brain,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.tsx'

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// ── Types ──────────────────────────────────────────────────────────────────

interface Account {
    equity: string
    cash: string
    buying_power: string
    portfolio_value: string
    unrealized_pl: string
    unrealized_plpc: string
    daytrade_count: number
    status: string
}

interface Position {
    symbol: string
    qty: string
    avg_entry_price: string
    current_price: string
    market_value: string
    unrealized_pl: string
    unrealized_plpc: string
    side: string
}

interface Order {
    id: string
    symbol: string
    qty: string
    filled_qty: string
    side: string
    type: string
    status: string
    created_at: string
    filled_avg_price: string | null
    limit_price: string | null
}

interface StockNewsItem {
    id: number
    headline: string
    summary: string
    author: string
    created_at: string
    url: string
    source: string
    symbols: string[]
}

type OrderSide = 'buy' | 'sell'
type OrderType = 'market' | 'limit'
type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok'
type RightTab = 'order' | 'positions' | 'orders' | 'info'

// ── TradingView Widget ─────────────────────────────────────────────────────

function TradingViewChart({ symbol }: { symbol: string }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scriptRef = useRef<HTMLScriptElement | null>(null)

    useEffect(() => {
        if (!containerRef.current) return
        containerRef.current.innerHTML = ''

        const script = document.createElement('script')
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
        script.async = true
        script.innerHTML = JSON.stringify({
            autosize: true,
            symbol: `NASDAQ:${symbol}`,
            interval: 'D',
            timezone: 'Etc/UTC',
            theme: 'dark',
            style: '1',
            locale: 'en',
            backgroundColor: '#060806',
            gridColor: '#1a1f1a',
            allow_symbol_change: false,
            save_image: false,
            hide_top_toolbar: false,
            hide_side_toolbar: false,
            withdateranges: true,
            details: false,
            hotlist: false,
            calendar: false,
            overrides: {
                'paneProperties.background': '#060806',
                'paneProperties.backgroundType': 'solid',
                'scalesProperties.textColor': '#6a7a6a',
                'mainSeriesProperties.candleStyle.upColor': '#00e676',
                'mainSeriesProperties.candleStyle.downColor': '#ff3d3d',
                'mainSeriesProperties.candleStyle.borderUpColor': '#00e676',
                'mainSeriesProperties.candleStyle.borderDownColor': '#ff3d3d',
            },
        })
        document.head.appendChild(script)
        scriptRef.current = script

        return () => {
            if (scriptRef.current && document.head.contains(scriptRef.current)) {
                document.head.removeChild(scriptRef.current)
            }
        }
    }, [symbol])

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: string | number | null | undefined, decimals = 2) {
    const n = parseFloat(String(v ?? '0'))
    if (isNaN(n)) return '—'
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtMoney(v: string | number | null | undefined) {
    const n = parseFloat(String(v ?? '0'))
    if (isNaN(n)) return '—'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function plColor(v: string | number | null | undefined) {
    const n = parseFloat(String(v ?? '0'))
    if (isNaN(n) || n === 0) return 'var(--bb-gray)'
    return n > 0 ? 'var(--bb-up)' : 'var(--bb-down)'
}

function fmtPct(v: string | number | null | undefined) {
    const n = parseFloat(String(v ?? '0')) * 100
    if (isNaN(n)) return '—'
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

// ── Main Component ─────────────────────────────────────────────────────────

const MIN_CHART_PCT = 25
const MAX_CHART_PCT = 82
const DEFAULT_CHART_PCT = 65

export function TradingPanel() {
    const { authHeader } = useAuth()

    // Layout
    const [chartWidthPct, setChartWidthPct] = useState(DEFAULT_CHART_PCT)
    const layoutRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)

    // Data
    const [account, setAccount] = useState<Account | null>(null)
    const [positions, setPositions] = useState<Position[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [loadingAccount, setLoadingAccount] = useState(true)
    const [loadingOrders, setLoadingOrders] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [orderError, setOrderError] = useState<string | null>(null)
    const [orderSuccess, setOrderSuccess] = useState<string | null>(null)
    const [rightTab, setRightTab] = useState<RightTab>('order')

    // Stock info
    const [stockNews, setStockNews] = useState<StockNewsItem[]>([])
    const [stockBrief, setStockBrief] = useState<string | null>(null)
    const [loadingInfo, setLoadingInfo] = useState(false)
    const [infoSymbol, setInfoSymbol] = useState('')

    // Order form
    const [symbol, setSymbol] = useState('AAPL')
    const [chartSymbol, setChartSymbol] = useState('AAPL')
    const [side, setSide] = useState<OrderSide>('buy')
    const [orderType, setOrderType] = useState<OrderType>('market')
    const [qty, setQty] = useState('')
    const [limitPrice, setLimitPrice] = useState('')
    const [tif, setTif] = useState<TimeInForce>('day')

    // ── Resize drag ──────────────────────────────────────────────────────────
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current || !layoutRef.current) return
            e.preventDefault()
            const rect = layoutRef.current.getBoundingClientRect()
            const pct = ((e.clientX - rect.left) / rect.width) * 100
            setChartWidthPct(Math.min(MAX_CHART_PCT, Math.max(MIN_CHART_PCT, pct)))
        }
        const onUp = () => { isDragging.current = false; document.body.style.cursor = '' }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
    }, [])

    const onDragHandleDown = (e: React.MouseEvent) => {
        e.preventDefault()
        isDragging.current = true
        document.body.style.cursor = 'col-resize'
    }

    // ── Data fetching ────────────────────────────────────────────────────────
    const fetchAccount = useCallback(async () => {
        setLoadingAccount(true)
        try {
            const [accRes, posRes] = await Promise.all([
                fetch(`${API}/api/trading/account`),
                fetch(`${API}/api/trading/positions`),
            ])
            const acc = await accRes.json()
            const pos = await posRes.json()
            if (acc.error) throw new Error(acc.error)
            setAccount(acc)
            setPositions(Array.isArray(pos) ? pos : [])
            setError(null)
        } catch (e) {
            setError(String(e))
        } finally {
            setLoadingAccount(false)
        }
    }, [])

    const fetchOrders = useCallback(async () => {
        setLoadingOrders(true)
        try {
            const res = await fetch(`${API}/api/trading/orders?status=all&limit=30`)
            const data = await res.json()
            setOrders(Array.isArray(data) ? data : [])
        } catch { /* ignore */ } finally {
            setLoadingOrders(false)
        }
    }, [])

    const fetchStockInfo = useCallback(async (sym: string) => {
        if (!sym) return
        setLoadingInfo(true)
        setStockNews([])
        setStockBrief(null)
        setInfoSymbol(sym)
        try {
            const [newsRes, briefRes] = await Promise.all([
                fetch(`${API}/api/trading/stock-news/${sym}`),
                fetch(`${API}/api/trading/stock-brief/${sym}`),
            ])
            const news = await newsRes.json()
            const brief = await briefRes.json()
            setStockNews(Array.isArray(news) ? news : [])
            setStockBrief(brief.brief ?? null)
        } catch { /* ignore */ } finally {
            setLoadingInfo(false)
        }
    }, [])

    useEffect(() => {
        fetchAccount()
        fetchOrders()
        const t = setInterval(() => { fetchAccount(); fetchOrders() }, 10000)
        return () => clearInterval(t)
    }, [fetchAccount, fetchOrders])

    // Auto-fetch info when INFO tab opens or symbol changes
    useEffect(() => {
        if (rightTab === 'info' && chartSymbol !== infoSymbol) {
            fetchStockInfo(chartSymbol)
        }
    }, [rightTab, chartSymbol, infoSymbol, fetchStockInfo])

    // ── Actions ──────────────────────────────────────────────────────────────
    const placeOrder = useCallback(async () => {
        if (!symbol || !qty) { setOrderError('Symbol and quantity are required'); return }
        setSubmitting(true)
        setOrderError(null)
        setOrderSuccess(null)
        try {
            const body: Record<string, string> = {
                symbol: symbol.toUpperCase(),
                qty,
                side,
                type: orderType,
                time_in_force: tif,
            }
            if (orderType === 'limit') {
                if (!limitPrice) { setOrderError('Limit price required for limit orders'); setSubmitting(false); return }
                body.limit_price = limitPrice
            }
            const res = await fetch(`${API}/api/trading/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setOrderSuccess(`${side.toUpperCase()} order placed: ${qty} × ${symbol.toUpperCase()} (${data.id?.slice(0, 8)}...)`)
            setQty('')
            setLimitPrice('')
            setTimeout(() => { fetchAccount(); fetchOrders() }, 1500)
        } catch (e) {
            setOrderError(String(e).replace('Error: ', ''))
        } finally {
            setSubmitting(false)
        }
    }, [symbol, qty, side, orderType, limitPrice, tif, fetchAccount, fetchOrders, authHeader])

    const cancelOrder = useCallback(async (id: string) => {
        try {
            await fetch(`${API}/api/trading/orders/${id}`, { method: 'DELETE', headers: authHeader() })
            setTimeout(fetchOrders, 800)
        } catch { /* ignore */ }
    }, [fetchOrders, authHeader])

    const loadSymbol = () => {
        const s = symbol.trim().toUpperCase()
        if (s) {
            setChartSymbol(s)
            setInfoSymbol('') // reset so info refetches
        }
    }

    const pendingOrderCount = orders.filter(o =>
        ['new', 'accepted', 'pending_new', 'partially_filled'].includes(o.status)
    ).length

    return (
        <div className="trading-layout" ref={layoutRef}>
            {/* ── Left: TradingView Chart ─────────────────────────────── */}
            <div className="trading-chart-col" style={{ width: `${chartWidthPct}%` }}>
                <div className="trading-chart-header">
                    <span className="trading-chart-label">
                        <BarChart2 size={11} style={{ color: 'var(--bb-orange)' }} />
                        CHART
                    </span>
                    <span style={{ color: 'var(--bb-orange)', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em' }}>
                        {chartSymbol}
                    </span>
                    <div style={{ flex: 1 }} />
                    <div className="trading-symbol-bar">
                        <input
                            className="trading-symbol-input"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && loadSymbol()}
                            placeholder="SYMBOL"
                            maxLength={10}
                        />
                        <button className="trading-symbol-btn" onClick={loadSymbol}>LOAD</button>
                    </div>
                </div>
                <div className="trading-chart-body">
                    <TradingViewChart symbol={chartSymbol} />
                </div>
            </div>

            {/* ── Resize Handle ───────────────────────────────────────── */}
            <div
                className="trading-resize-handle"
                onMouseDown={onDragHandleDown}
                title="Drag to resize"
            >
                <div className="trading-resize-grip" />
            </div>

            {/* ── Right: Account + Order Panel ────────────────────────── */}
            <div className="trading-right-col">
                {/* Account summary */}
                <div className="trading-account-strip">
                    {loadingAccount && !account ? (
                        <div className="trading-loading-mini"><RefreshCw size={10} className="spin-icon" />&nbsp;LOADING</div>
                    ) : error ? (
                        <div className="trading-err-mini"><AlertCircle size={10} />&nbsp;{error}</div>
                    ) : account ? (
                        <>
                            <div className="trading-acc-stat">
                                <span className="trading-acc-label">EQUITY</span>
                                <span className="trading-acc-val">{fmtMoney(account.equity)}</span>
                            </div>
                            <div className="trading-acc-divider" />
                            <div className="trading-acc-stat">
                                <span className="trading-acc-label">CASH</span>
                                <span className="trading-acc-val">{fmtMoney(account.cash)}</span>
                            </div>
                            <div className="trading-acc-divider" />
                            <div className="trading-acc-stat">
                                <span className="trading-acc-label">BUY PWR</span>
                                <span className="trading-acc-val">{fmtMoney(account.buying_power)}</span>
                            </div>
                            <div className="trading-acc-divider" />
                            <div className="trading-acc-stat">
                                <span className="trading-acc-label">DAY P&L</span>
                                <span className="trading-acc-val" style={{ color: plColor(account.unrealized_pl) }}>
                                    {parseFloat(account.unrealized_pl ?? '0') >= 0 ? '+' : ''}
                                    {fmtMoney(account.unrealized_pl)}
                                </span>
                            </div>
                            <div className="trading-acc-divider" />
                            <button className="trading-refresh-btn" onClick={() => { fetchAccount(); fetchOrders() }} title="REFRESH">
                                <RefreshCw size={9} />
                            </button>
                        </>
                    ) : null}
                </div>

                {/* Right sub-tabs */}
                <div className="trading-right-tabs">
                    {([
                        { id: 'order', icon: <Activity size={9} />, label: 'ORDER' },
                        { id: 'positions', icon: <TrendingUp size={9} />, label: 'POSITIONS', badge: positions.length > 0 ? positions.length : 0 },
                        { id: 'orders', icon: <Clock size={9} />, label: 'ORDERS', badge: pendingOrderCount },
                        { id: 'info', icon: <Newspaper size={9} />, label: 'INFO' },
                    ] as Array<{ id: RightTab; icon: React.ReactNode; label: string; badge?: number }>).map((t) => (
                        <button
                            key={t.id}
                            className={`trading-rtab ${rightTab === t.id ? 'trading-rtab-active' : ''}`}
                            onClick={() => setRightTab(t.id)}
                        >
                            {t.icon}
                            {t.label}
                            {!!t.badge && <span className="trading-rtab-badge">{t.badge}</span>}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="trading-right-body">
                    {/* ── Order Form ──────────────────────────────────────── */}
                    {rightTab === 'order' && (
                        <div className="order-form">
                            <div className="order-side-toggle">
                                <button
                                    className={`order-side-btn order-side-buy ${side === 'buy' ? 'active' : ''}`}
                                    onClick={() => setSide('buy')}
                                >
                                    <TrendingUp size={11} /> BUY
                                </button>
                                <button
                                    className={`order-side-btn order-side-sell ${side === 'sell' ? 'active' : ''}`}
                                    onClick={() => setSide('sell')}
                                >
                                    <TrendingDown size={11} /> SELL
                                </button>
                            </div>

                            <div className="order-field">
                                <label className="order-label">SYMBOL</label>
                                <input
                                    className="order-input"
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                    placeholder="AAPL"
                                    maxLength={10}
                                />
                            </div>

                            <div className="order-field">
                                <label className="order-label">ORDER TYPE</label>
                                <div className="order-type-toggle">
                                    {(['market', 'limit'] as const).map((t) => (
                                        <button
                                            key={t}
                                            className={`order-type-btn ${orderType === t ? 'active' : ''}`}
                                            onClick={() => setOrderType(t)}
                                        >
                                            {t.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="order-field">
                                <label className="order-label">QUANTITY (SHARES)</label>
                                <input
                                    className="order-input"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={qty}
                                    onChange={(e) => setQty(e.target.value)}
                                    placeholder="0"
                                />
                            </div>

                            {orderType === 'limit' && (
                                <div className="order-field">
                                    <label className="order-label">LIMIT PRICE ($)</label>
                                    <input
                                        className="order-input"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={limitPrice}
                                        onChange={(e) => setLimitPrice(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            )}

                            <div className="order-field">
                                <label className="order-label">TIME IN FORCE</label>
                                <div className="order-select-wrap">
                                    <select
                                        className="order-select"
                                        value={tif}
                                        onChange={(e) => setTif(e.target.value as TimeInForce)}
                                    >
                                        <option value="day">DAY</option>
                                        <option value="gtc">GTC (GOOD TIL CANCELLED)</option>
                                        <option value="ioc">IOC (IMMEDIATE OR CANCEL)</option>
                                        <option value="fok">FOK (FILL OR KILL)</option>
                                    </select>
                                    <ChevronDown size={10} className="order-select-icon" />
                                </div>
                            </div>

                            <button
                                className={`order-submit-btn ${side === 'buy' ? 'order-submit-buy' : 'order-submit-sell'}`}
                                onClick={placeOrder}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <><RefreshCw size={11} className="spin-icon" /> SUBMITTING...</>
                                ) : side === 'buy' ? (
                                    <><TrendingUp size={11} /> BUY {qty && symbol ? `${qty} × ${symbol}` : 'ORDER'}</>
                                ) : (
                                    <><TrendingDown size={11} /> SELL {qty && symbol ? `${qty} × ${symbol}` : 'ORDER'}</>
                                )}
                            </button>

                            {orderError && (
                                <div className="order-feedback order-feedback-err">
                                    <AlertCircle size={10} /> {orderError}
                                </div>
                            )}
                            {orderSuccess && (
                                <div className="order-feedback order-feedback-ok">
                                    <TrendingUp size={10} /> {orderSuccess}
                                </div>
                            )}

                            {qty && symbol && (
                                <div className="order-summary">
                                    <div className="order-summary-row">
                                        <span>SIDE</span>
                                        <span style={{ color: side === 'buy' ? 'var(--bb-up)' : 'var(--bb-down)', fontWeight: 700 }}>
                                            {side.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="order-summary-row">
                                        <span>SYMBOL</span><span>{symbol}</span>
                                    </div>
                                    <div className="order-summary-row">
                                        <span>QTY</span><span>{qty}</span>
                                    </div>
                                    <div className="order-summary-row">
                                        <span>TYPE</span><span>{orderType.toUpperCase()}</span>
                                    </div>
                                    {orderType === 'limit' && limitPrice && (
                                        <div className="order-summary-row">
                                            <span>LIMIT</span><span>${limitPrice}</span>
                                        </div>
                                    )}
                                    <div className="order-summary-row">
                                        <span>TIF</span><span>{tif.toUpperCase()}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Positions ────────────────────────────────────────── */}
                    {rightTab === 'positions' && (
                        <div className="positions-panel">
                            {positions.length === 0 ? (
                                <div className="trading-empty">
                                    <DollarSign size={20} style={{ opacity: 0.3 }} />
                                    <span>NO OPEN POSITIONS</span>
                                </div>
                            ) : (
                                <>
                                    <div className="positions-header">
                                        <span>SYMBOL</span>
                                        <span>QTY</span>
                                        <span>AVG</span>
                                        <span>MKT VAL</span>
                                        <span>P&L</span>
                                    </div>
                                    {positions.map((p) => (
                                        <div key={p.symbol} className="position-row">
                                            <div className="position-symbol">
                                                <span className="pos-sym">{p.symbol}</span>
                                                <span className="pos-side">{p.side}</span>
                                            </div>
                                            <span className="pos-qty">{fmt(p.qty, 0)}</span>
                                            <span className="pos-avg">${fmt(p.avg_entry_price)}</span>
                                            <span className="pos-val">{fmtMoney(p.market_value)}</span>
                                            <div className="pos-pl" style={{ color: plColor(p.unrealized_pl) }}>
                                                <span>{parseFloat(p.unrealized_pl ?? '0') >= 0 ? '+' : ''}{fmtMoney(p.unrealized_pl)}</span>
                                                <span className="pos-plpct">{fmtPct(p.unrealized_plpc)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Orders History ───────────────────────────────────── */}
                    {rightTab === 'orders' && (
                        <div className="orders-panel">
                            {loadingOrders && orders.length === 0 ? (
                                <div className="trading-loading-mini" style={{ padding: '20px 12px' }}>
                                    <RefreshCw size={10} className="spin-icon" /> LOADING ORDERS...
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="trading-empty">
                                    <Clock size={20} style={{ opacity: 0.3 }} />
                                    <span>NO RECENT ORDERS</span>
                                </div>
                            ) : (
                                orders.map((o) => {
                                    const isPending = ['new', 'accepted', 'pending_new', 'partially_filled'].includes(o.status)
                                    const isFilled = o.status === 'filled'
                                    const isCancelled = ['cancelled', 'canceled', 'rejected', 'expired'].includes(o.status)
                                    return (
                                        <div key={o.id} className={`order-row ${isPending ? 'order-row-pending' : ''}`}>
                                            <div className="order-row-top">
                                                <span className={`order-row-side ${o.side === 'buy' ? 'buy' : 'sell'}`}>
                                                    {o.side.toUpperCase()}
                                                </span>
                                                <span className="order-row-sym">{o.symbol}</span>
                                                <span className="order-row-qty">{o.qty} sh</span>
                                                <span
                                                    className="order-row-status"
                                                    style={{
                                                        color: isFilled ? 'var(--bb-up)' : isCancelled ? 'var(--bb-down)' : 'var(--bb-yellow)',
                                                    }}
                                                >
                                                    {o.status.toUpperCase().replace('_', ' ')}
                                                </span>
                                                {isPending && (
                                                    <button className="order-cancel-btn" onClick={() => cancelOrder(o.id)} title="CANCEL">
                                                        <X size={9} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="order-row-meta">
                                                <span>{o.type.toUpperCase()}</span>
                                                {o.limit_price && <span>LMT ${fmt(o.limit_price)}</span>}
                                                {o.filled_avg_price && <span>FILL ${fmt(o.filled_avg_price)}</span>}
                                                <span>{timeAgo(o.created_at)}</span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* ── Stock Info ───────────────────────────────────────── */}
                    {rightTab === 'info' && (
                        <div className="stock-info-panel">
                            {/* Refresh button */}
                            <div className="stock-info-topbar">
                                <span className="stock-info-sym">{chartSymbol}</span>
                                <button
                                    className="stock-info-refresh"
                                    onClick={() => { setInfoSymbol(''); fetchStockInfo(chartSymbol) }}
                                    disabled={loadingInfo}
                                    title="Refresh"
                                >
                                    <RefreshCw size={9} className={loadingInfo ? 'spin-icon' : ''} />
                                    REFRESH
                                </button>
                            </div>

                            {loadingInfo ? (
                                <div className="trading-loading-mini" style={{ padding: '20px 12px' }}>
                                    <RefreshCw size={10} className="spin-icon" /> LOADING...
                                </div>
                            ) : (
                                <>
                                    {/* AI Brief */}
                                    <div className="stock-brief-card">
                                        <div className="stock-brief-label">
                                            <Brain size={9} style={{ color: 'var(--bb-orange)' }} />
                                            AI BRIEF
                                        </div>
                                        {stockBrief ? (
                                            <p className="stock-brief-text">{stockBrief}</p>
                                        ) : (
                                            <p className="stock-brief-text" style={{ color: 'var(--bb-gray)', fontStyle: 'italic' }}>
                                                No AI brief available — OPENAI_API_KEY required.
                                            </p>
                                        )}
                                    </div>

                                    {/* News */}
                                    <div className="stock-news-label">
                                        <Newspaper size={9} style={{ color: 'var(--bb-orange)' }} />
                                        LATEST NEWS
                                    </div>
                                    {stockNews.length === 0 ? (
                                        <div className="trading-empty" style={{ minHeight: 60 }}>
                                            <span>No recent news found</span>
                                        </div>
                                    ) : (
                                        stockNews.map((n) => (
                                            <a
                                                key={n.id}
                                                href={n.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="stock-news-item"
                                            >
                                                <div className="stock-news-headline">{n.headline}</div>
                                                {n.summary && (
                                                    <div className="stock-news-summary">{n.summary}</div>
                                                )}
                                                <div className="stock-news-meta">
                                                    <span>{n.source}</span>
                                                    <span>{timeAgo(n.created_at)}</span>
                                                </div>
                                            </a>
                                        ))
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
