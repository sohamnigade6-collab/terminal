import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, RefreshCw, ShieldCheck, BarChart2, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.tsx'

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

interface AllowedEmail {
    email: string
    added_at: string
    added_by: string
}

interface TradeEntry {
    id: number
    user_email: string
    user_name: string
    symbol: string
    side: string
    qty: string
    order_type: string
    time_in_force: string
    limit_price: string | null
    alpaca_order_id: string | null
    alpaca_status: string
    created_at: string
}

interface Props {
    onClose: () => void
}

export function AdminPanel({ onClose }: Props) {
    const { authHeader, user } = useAuth()
    const [tab, setTab] = useState<'emails' | 'trades'>('emails')

    const [emails, setEmails] = useState<AllowedEmail[]>([])
    const [trades, setTrades] = useState<TradeEntry[]>([])
    const [loadingEmails, setLoadingEmails] = useState(false)
    const [loadingTrades, setLoadingTrades] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const fetchEmails = useCallback(async () => {
        setLoadingEmails(true)
        try {
            const res = await fetch(`${API}/api/auth/allowed-emails`, { headers: authHeader() })
            setEmails(await res.json())
        } catch { /* ignore */ } finally {
            setLoadingEmails(false)
        }
    }, [authHeader])

    const fetchTrades = useCallback(async () => {
        setLoadingTrades(true)
        try {
            const res = await fetch(`${API}/api/auth/trade-log`, { headers: authHeader() })
            setTrades(await res.json())
        } catch { /* ignore */ } finally {
            setLoadingTrades(false)
        }
    }, [authHeader])

    useEffect(() => { fetchEmails() }, [fetchEmails])
    useEffect(() => { if (tab === 'trades') fetchTrades() }, [tab, fetchTrades])

    const addEmail = async () => {
        const e = newEmail.trim().toLowerCase()
        if (!e || !e.includes('@')) { setError('Enter a valid email address'); return }
        setAdding(true); setError(null); setSuccess(null)
        try {
            const res = await fetch(`${API}/api/auth/allowed-emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({ email: e, added_by: user?.email }),
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setSuccess(`${e} added`)
            setNewEmail('')
            fetchEmails()
        } catch (err) {
            setError(String(err).replace('Error: ', ''))
        } finally {
            setAdding(false)
        }
    }

    const [clearingLogs, setClearingLogs] = useState(false)

    const clearLogs = async () => {
        if (!confirm('Clear all trade log entries? This cannot be undone.')) return
        setClearingLogs(true)
        try {
            await fetch(`${API}/api/auth/trade-log`, {
                method: 'DELETE',
                headers: authHeader(),
            })
            setTrades([])
            setSuccess('Trade log cleared')
        } catch {
            setError('Failed to clear log')
        } finally {
            setClearingLogs(false)
        }
    }

    const removeEmail = async (email: string) => {
        try {
            await fetch(`${API}/api/auth/allowed-emails/${encodeURIComponent(email)}`, {
                method: 'DELETE',
                headers: authHeader(),
            })
            setEmails((prev) => prev.filter((e) => e.email !== email))
        } catch { /* ignore */ }
    }

    const fmtDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <span className="modal-title">
                        <ShieldCheck size={11} style={{ color: 'var(--bb-orange)' }} />
                        ADMIN PANEL
                    </span>
                    <button className="modal-close" onClick={onClose}><X size={12} /></button>
                </div>

                {/* Tabs */}
                <div className="admin-tabs">
                    <button
                        className={`admin-tab ${tab === 'emails' ? 'admin-tab-active' : ''}`}
                        onClick={() => setTab('emails')}
                    >
                        <ShieldCheck size={10} /> AUTHORIZED USERS
                    </button>
                    <button
                        className={`admin-tab ${tab === 'trades' ? 'admin-tab-active' : ''}`}
                        onClick={() => setTab('trades')}
                    >
                        <BarChart2 size={10} /> TRADE LOG
                    </button>
                </div>

                <div className="admin-body">
                    {/* ── Authorized emails tab ── */}
                    {tab === 'emails' && (
                        <div className="admin-section">
                            {/* Add email */}
                            <div className="admin-add-row">
                                <input
                                    className="admin-input"
                                    placeholder="email@example.com"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                                />
                                <button className="admin-btn-add" onClick={addEmail} disabled={adding}>
                                    {adding ? <RefreshCw size={10} className="spin-icon" /> : <Plus size={10} />}
                                    ADD
                                </button>
                            </div>

                            {error && (
                                <div className="admin-msg admin-msg-err">
                                    <AlertCircle size={10} /> {error}
                                </div>
                            )}
                            {success && (
                                <div className="admin-msg admin-msg-ok">
                                    {success}
                                </div>
                            )}

                            {/* Email list */}
                            <div className="admin-list-header">
                                <span>EMAIL</span>
                                <span>ADDED</span>
                                <span>BY</span>
                                <span />
                            </div>

                            {loadingEmails ? (
                                <div className="admin-loading"><RefreshCw size={10} className="spin-icon" /> Loading...</div>
                            ) : emails.length === 0 ? (
                                <div className="admin-empty">No authorized users</div>
                            ) : (
                                <div className="admin-list">
                                    {emails.map((e) => (
                                        <div key={e.email} className="admin-list-row">
                                            <span className="admin-email">{e.email}</span>
                                            <span className="admin-meta">{fmtDate(e.added_at)}</span>
                                            <span className="admin-meta">{e.added_by}</span>
                                            <button
                                                className="admin-btn-remove"
                                                onClick={() => removeEmail(e.email)}
                                                title="Remove access"
                                                disabled={e.email === user?.email}
                                            >
                                                <Trash2 size={9} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Trade log tab ── */}
                    {tab === 'trades' && (
                        <div className="admin-section">
                            <div className="admin-list-header admin-trade-header">
                                <span>USER</span>
                                <span>SYMBOL</span>
                                <span>SIDE</span>
                                <span>QTY</span>
                                <span>TYPE</span>
                                <span>STATUS</span>
                                <span>TIME</span>
                            </div>

                            {loadingTrades ? (
                                <div className="admin-loading"><RefreshCw size={10} className="spin-icon" /> Loading...</div>
                            ) : trades.length === 0 ? (
                                <div className="admin-empty">No trades yet</div>
                            ) : (
                                <div className="admin-list">
                                    {trades.map((t) => (
                                        <div key={t.id} className="admin-list-row admin-trade-row">
                                            <span className="admin-meta" title={t.user_email}>
                                                {t.user_email.split('@')[0]}
                                            </span>
                                            <span style={{ color: 'var(--bb-orange)', fontWeight: 700 }}>{t.symbol}</span>
                                            <span style={{ color: t.side === 'buy' ? 'var(--bb-up)' : 'var(--bb-down)', fontWeight: 700 }}>
                                                {t.side.toUpperCase()}
                                            </span>
                                            <span>{t.qty}</span>
                                            <span className="admin-meta">{t.order_type}</span>
                                            <span className="admin-meta">{t.alpaca_status}</span>
                                            <span className="admin-meta">{fmtDate(t.created_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="admin-log-actions">
                                <button className="admin-refresh-btn" onClick={fetchTrades}>
                                    <RefreshCw size={9} /> REFRESH
                                </button>
                                <button
                                    className="admin-clear-btn"
                                    onClick={clearLogs}
                                    disabled={clearingLogs || trades.length === 0}
                                    title="Clear all trade logs"
                                >
                                    {clearingLogs
                                        ? <><RefreshCw size={9} className="spin-icon" /> CLEARING...</>
                                        : <><Trash2 size={9} /> CLEAR ALL</>
                                    }
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
