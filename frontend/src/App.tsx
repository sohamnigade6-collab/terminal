import { useState, useEffect } from 'react'
import {
  Globe, TrendingUp, MapPin, Brain,
  AlertTriangle, RefreshCw, Settings as SettingsIcon,
  Wifi, WifiOff, CandlestickChart, LogOut, User, ShieldCheck,
  Calendar, Filter,
} from 'lucide-react'
import { useSettings } from './hooks/useSettings.ts'
import { useDashboard } from './hooks/useDashboard.ts'
import { useAuth } from './contexts/AuthContext.tsx'
import { NewsPanel } from './components/NewsPanel.tsx'
import { MarketsPanel } from './components/MarketsPanel.tsx'
import { LocalPanel } from './components/LocalPanel.tsx'
import { IntelPanel } from './components/IntelPanel.tsx'
import { TradingPanel } from './components/TradingPanel.tsx'
import { EarningsPanel } from './components/EarningsPanel.tsx'
import { TVScreener } from './components/TVScreener.tsx'
import { LoginScreen } from './components/LoginScreen.tsx'
import { SettingsModal } from './components/SettingsModal.tsx'
import { AdminPanel } from './components/AdminPanel.tsx'
import './index.css'

type TabId = 'news' | 'markets' | 'local' | 'intel' | 'trading' | 'earnings' | 'screener'

const TABS: Array<{ id: TabId; label: string; fkey: string; icon: React.ReactNode }> = [
  { id: 'news',     label: 'GLOBAL NEWS',  fkey: 'F1', icon: <Globe size={11} /> },
  { id: 'markets',  label: 'MARKETS',      fkey: 'F2', icon: <TrendingUp size={11} /> },
  { id: 'local',    label: 'LOCAL',        fkey: 'F3', icon: <MapPin size={11} /> },
  { id: 'intel',    label: 'INTEL BRIEF',  fkey: 'F4', icon: <Brain size={11} /> },
  { id: 'trading',  label: 'TRADING',      fkey: 'F5', icon: <CandlestickChart size={11} /> },
  { id: 'earnings', label: 'EARNINGS',     fkey: 'F6', icon: <Calendar size={11} /> },
  { id: 'screener', label: 'SCREENER',     fkey: 'F7', icon: <Filter size={11} /> },
]

export default function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const { settings, save } = useSettings()
  const { state, fetchData, fetchIntel } = useDashboard(settings)
  const [activeTab, setActiveTab] = useState<TabId>('news')
  const [showSettings, setShowSettings] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (state.globalNews.length > 0 && !state.intel && !state.loading.intel && !state.errors.intel) {
      fetchIntel(state.globalNews)
    }
  }, [state.globalNews.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'F1') { e.preventDefault(); setActiveTab('news') }
      if (e.key === 'F2') { e.preventDefault(); setActiveTab('markets') }
      if (e.key === 'F3') { e.preventDefault(); setActiveTab('local') }
      if (e.key === 'F4') { e.preventDefault(); setActiveTab('intel') }
      if (e.key === 'F5') { e.preventDefault(); setActiveTab('trading') }
      if (e.key === 'F6') { e.preventDefault(); setActiveTab('earnings') }
      if (e.key === 'F7') { e.preventDefault(); setActiveTab('screener') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fetchData])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bb-black)', color: 'var(--bb-orange)', fontFamily: 'var(--font-mono)',
        fontSize: 11, letterSpacing: '0.1em', gap: 8,
      }}>
        <span className="spinner" style={{ borderTopColor: 'var(--bb-orange)' }} />
        AUTHENTICATING...
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />
  }

  const criticalCount = state.globalNews.filter((n) => n.level === 'CRITICAL').length
  const isRefreshing = state.loading.globalNews || state.loading.markets

  const tabCount: Partial<Record<TabId, number | null>> = {
    news: state.globalNews.length || null,
    markets: state.markets ? (state.markets.crypto.length + state.markets.indices.length + state.markets.commodities.length) : null,
    local: state.localNews.length || null,
    intel: state.intel ? state.intel.countryRisks.length : null,
  }

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <>
      {/* ── Header bar ───────────────────────────────────────────────── */}
      <div className="titlebar">
        <div className="titlebar-logo">
          <span className="logo-dot" />
          AOB
        </div>

        <div className="titlebar-sep" />
        <span className="titlebar-path">INTELLIGENCE TERMINAL</span>

        {criticalCount > 0 && (
          <>
            <div className="titlebar-sep" />
            <span className="titlebar-alert">
              <AlertTriangle size={9} />
              {criticalCount} CRITICAL
            </span>
          </>
        )}

        <div className="titlebar-spacer" />

        <div className="titlebar-right">
          {/* Logged-in user */}
          <span className="titlebar-user">
            {user.avatar ? (
              <img src={user.avatar} className="titlebar-avatar" alt="" referrerPolicy="no-referrer" />
            ) : (
              <User size={9} />
            )}
            <span>{user.email}</span>
          </span>
          <div className="titlebar-sep" />
          <span className="titlebar-loc">
            <MapPin size={9} />
            {settings.city.toUpperCase()}
          </span>
          <div className="titlebar-sep" />
          <span className="titlebar-clock">
            {isRefreshing
              ? <WifiOff size={9} style={{ display: 'inline', marginRight: 3 }} />
              : <Wifi size={9} style={{ display: 'inline', marginRight: 3 }} />
            }
            {fmtTime(now)}
          </span>
          <div className="titlebar-sep" />
          <button className="titlebar-btn" onClick={fetchData} title="REFRESH" disabled={isRefreshing}>
            <RefreshCw size={9} className={isRefreshing ? 'spin-icon' : ''} />
            F6
          </button>
          {user.email === 'sohamnigade08@gmail.com' && (
            <button className="titlebar-btn" onClick={() => setShowAdmin(true)} title="ADMIN">
              <ShieldCheck size={9} />
              ADM
            </button>
          )}
          <button className="titlebar-btn" onClick={() => setShowSettings(true)} title="SETTINGS">
            <SettingsIcon size={9} />
            CFG
          </button>
          <button className="titlebar-btn" onClick={logout} title="LOGOUT">
            <LogOut size={9} />
          </button>
        </div>
      </div>

      {/* ── Function key tab bar ─────────────────────────────────────── */}
      <div className="tabbar">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          const loading =
            (tab.id === 'news' && state.loading.globalNews) ||
            (tab.id === 'markets' && state.loading.markets) ||
            (tab.id === 'local' && (state.loading.localNews || state.loading.weather)) ||
            (tab.id === 'intel' && state.loading.intel)

          return (
            <button
              key={tab.id}
              className={`tab ${isActive ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {isActive && <span className="tab-indicator" />}
              <span className="tab-inner">
                <span className="tab-fkey">{tab.fkey}</span>
                {tab.icon}
                <span className="tab-label">{tab.label}</span>
                {loading
                  ? <span className="tab-spinner" />
                  : tabCount[tab.id] !== null && tabCount[tab.id] !== undefined
                    ? <span className="tab-count">{tabCount[tab.id]}</span>
                    : null
                }
              </span>
            </button>
          )
        })}

        <div className="tabbar-spacer" />

        {state.markets && (
          <div className="tabbar-status">
            {state.markets.indices.slice(0, 3).map((idx) => (
              <span key={idx.symbol} className="tabbar-stat-item">
                <span style={{ color: 'var(--bb-orange)', fontWeight: 700 }}>
                  {idx.name.includes('S&P') ? 'SPX' : idx.name.includes('Dow') ? 'DJIA' : 'NDX'}
                </span>
                <span style={{ color: idx.changePct >= 0 ? 'var(--bb-up)' : 'var(--bb-down)' }}>
                  {idx.changePct >= 0 ? '▲' : '▼'}{Math.abs(idx.changePct).toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        )}

        {state.lastUpdated && (
          <span className="tabbar-updated">
            {fmtTime(state.lastUpdated)}
          </span>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <main className={`tab-content ${['trading', 'screener'].includes(activeTab) ? 'tab-content-trading' : ''}`}>
        {activeTab === 'news' && (
          <div className="tab-pane tab-pane-news">
            <NewsPanel items={state.globalNews} loading={state.loading.globalNews} error={state.errors.globalNews} />
          </div>
        )}
        {activeTab === 'markets' && (
          <div className="tab-pane">
            <MarketsPanel data={state.markets} loading={state.loading.markets} error={state.errors.markets} />
          </div>
        )}
        {activeTab === 'local' && (
          <div className="tab-pane">
            <LocalPanel
              weather={state.weather}
              localNews={state.localNews}
              loadingWeather={state.loading.weather}
              loadingNews={state.loading.localNews}
              errorWeather={state.errors.weather}
              errorNews={state.errors.localNews}
              city={settings.city}
            />
          </div>
        )}
        {activeTab === 'intel' && (
          <div className="tab-pane">
            <IntelPanel
              intel={state.intel}
              loading={state.loading.intel}
              error={state.errors.intel}
              globalNews={state.globalNews}
              onFetchIntel={fetchIntel}
            />
          </div>
        )}
        {activeTab === 'trading' && (
          <div className="tab-pane tab-pane-trading">
            <TradingPanel />
          </div>
        )}
        {activeTab === 'earnings' && (
          <div className="tab-pane">
            <EarningsPanel />
          </div>
        )}
        {activeTab === 'screener' && (
          <div className="tab-pane tab-pane-tv">
            <TVScreener />
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsModal settings={settings} onSave={save} onClose={() => setShowSettings(false)} />
      )}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
    </>
  )
}
