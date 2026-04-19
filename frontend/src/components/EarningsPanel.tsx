import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Calendar, Clock } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? ''

interface EarningsRow {
    symbol: string
    name: string
    marketCap: string
    fiscalQuarterEnding: string
    epsForecast: string
    noOfEsts: string
    lastYearRptDt: string
    lastYearEPS: string
    time: string
}

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
}

function labelDate(d: Date, today: Date): string {
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
    if (diff === 0) return 'TODAY'
    if (diff === 1) return 'TOMORROW'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

function timeBadge(time: string) {
    if (time === 'time-pre-market') {
        return (
            <span className="earn-badge earn-badge-pre">
                <Clock size={8} /> PRE
            </span>
        )
    }
    if (time === 'time-after-hours') {
        return (
            <span className="earn-badge earn-badge-post">
                <Clock size={8} /> POST
            </span>
        )
    }
    return <span className="earn-badge earn-badge-unk">—</span>
}

function fmtEps(v: string | undefined) {
    if (!v || v === 'N/A' || v === '') return <span style={{ color: 'var(--bb-gray)' }}>—</span>
    const n = parseFloat(v)
    if (isNaN(n)) return <span style={{ color: 'var(--bb-gray)' }}>—</span>
    return (
        <span style={{ color: n >= 0 ? 'var(--bb-up)' : 'var(--bb-down)' }}>
            {n >= 0 ? '+' : ''}{n.toFixed(2)}
        </span>
    )
}

export function EarningsPanel() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        return d
    })

    const [selectedDate, setSelectedDate] = useState(formatDate(today))
    const [rows, setRows] = useState<EarningsRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState('')

    const fetchEarnings = useCallback(async (date: string) => {
        setLoading(true)
        setError(null)
        setRows([])
        try {
            const res = await fetch(`${API}/api/earnings?date=${date}`)
            const data = await res.json() as { rows: EarningsRow[]; error?: string }
            if (data.error) setError(data.error)
            setRows(data.rows ?? [])
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchEarnings(selectedDate)
    }, [selectedDate, fetchEarnings])

    const filtered = filter.trim()
        ? rows.filter(r =>
            r.symbol.toLowerCase().includes(filter.toLowerCase()) ||
            r.name.toLowerCase().includes(filter.toLowerCase())
        )
        : rows

    return (
        <div className="earnings-panel">
            {/* Header */}
            <div className="earnings-header">
                <div className="earnings-title">
                    <Calendar size={11} style={{ color: 'var(--bb-orange)' }} />
                    EARNINGS CALENDAR
                </div>
                <button
                    className="earn-refresh-btn"
                    onClick={() => fetchEarnings(selectedDate)}
                    disabled={loading}
                    title="Refresh"
                >
                    <RefreshCw size={9} className={loading ? 'spin-icon' : ''} />
                    REFRESH
                </button>
            </div>

            {/* Date tabs */}
            <div className="earnings-date-tabs">
                {days.map(d => {
                    const key = formatDate(d)
                    return (
                        <button
                            key={key}
                            className={`earn-date-tab ${selectedDate === key ? 'active' : ''}`}
                            onClick={() => setSelectedDate(key)}
                        >
                            {labelDate(d, today)}
                        </button>
                    )
                })}
            </div>

            {/* Search */}
            <div className="earnings-filter-row">
                <input
                    className="earnings-filter"
                    placeholder="FILTER BY SYMBOL OR NAME..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
                {filtered.length > 0 && (
                    <span className="earnings-count">{filtered.length} REPORTS</span>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <div className="earn-loading">
                    <RefreshCw size={13} className="spin-icon" /> LOADING EARNINGS DATA...
                </div>
            ) : error ? (
                <div className="earn-error">
                    DATA UNAVAILABLE — {error.slice(0, 120)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="earn-empty">
                    <Calendar size={24} style={{ opacity: 0.25 }} />
                    <span>NO EARNINGS SCHEDULED FOR THIS DATE</span>
                </div>
            ) : (
                <div className="earn-table-wrap">
                    <table className="earn-table">
                        <thead>
                            <tr>
                                <th>SYMBOL</th>
                                <th>COMPANY</th>
                                <th>TIME</th>
                                <th>QTR</th>
                                <th>EST EPS</th>
                                <th>PRIOR EPS</th>
                                <th>MKT CAP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r, i) => (
                                <tr key={`${r.symbol}-${i}`} className="earn-row">
                                    <td className="earn-sym">{r.symbol}</td>
                                    <td className="earn-name">{r.name}</td>
                                    <td>{timeBadge(r.time)}</td>
                                    <td className="earn-qtr">{r.fiscalQuarterEnding || '—'}</td>
                                    <td className="earn-eps">{fmtEps(r.epsForecast)}</td>
                                    <td className="earn-eps">{fmtEps(r.lastYearEPS)}</td>
                                    <td className="earn-mktcap">{r.marketCap || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
