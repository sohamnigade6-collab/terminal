import { useEffect, useRef } from 'react'

const MATURITIES = [
    { label: '3M', symbol: 'TVC:US03M' },
    { label: '6M', symbol: 'TVC:US06M' },
    { label: '1Y', symbol: 'TVC:US01Y' },
    { label: '2Y', symbol: 'TVC:US02Y' },
    { label: '5Y', symbol: 'TVC:US05Y' },
    { label: '10Y', symbol: 'TVC:US10Y' },
    { label: '30Y', symbol: 'TVC:US30Y' },
]

function MiniYieldChart({ symbol, label }: { symbol: string; label: string }) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        el.innerHTML = ''

        const wrapper = document.createElement('div')
        wrapper.style.width = '100%'
        wrapper.style.height = '100%'
        el.appendChild(wrapper)

        const script = document.createElement('script')
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
        script.async = true
        script.innerHTML = JSON.stringify({
            symbol,
            width: '100%',
            height: '100%',
            locale: 'en',
            dateRange: '3M',
            colorTheme: 'dark',
            isTransparent: true,
            autosize: true,
            largeChartUrl: '',
            noTimeScale: false,
        })
        el.appendChild(script)

        return () => { el.innerHTML = '' }
    }, [symbol])

    return (
        <div className="yield-mini-card">
            <div className="yield-mini-label">{label}</div>
            <div
                ref={containerRef}
                className="tradingview-widget-container"
                style={{ width: '100%', flex: 1 }}
            />
        </div>
    )
}

function YieldCurveChart() {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        el.innerHTML = ''

        const wrapper = document.createElement('div')
        wrapper.style.width = '100%'
        wrapper.style.height = '100%'
        el.appendChild(wrapper)

        const compareSymbols = MATURITIES.slice(1).map(m => ({
            symbol: m.symbol,
            position: 'SameScale',
        }))

        const script = document.createElement('script')
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
        script.async = true
        script.innerHTML = JSON.stringify({
            autosize: true,
            symbol: MATURITIES[0].symbol,
            interval: 'D',
            timezone: 'Etc/UTC',
            theme: 'dark',
            style: '2',
            locale: 'en',
            backgroundColor: 'rgba(0, 0, 0, 0)',
            gridColor: 'rgba(255, 255, 255, 0.04)',
            compareSymbols,
            allow_symbol_change: false,
            hide_side_toolbar: false,
            hide_legend: false,
            withdateranges: true,
        })
        el.appendChild(script)

        return () => { el.innerHTML = '' }
    }, [])

    return (
        <div
            ref={containerRef}
            className="tradingview-widget-container"
            style={{ width: '100%', height: '100%' }}
        />
    )
}

export function TVYieldCurve() {
    return (
        <div className="yield-curve-panel">
            {/* Top: comparison chart of all yields over time */}
            <div className="yield-curve-main">
                <div className="yield-curve-section-label">US TREASURY YIELDS — COMPARATIVE</div>
                <div className="yield-curve-chart-wrap">
                    <YieldCurveChart />
                </div>
            </div>

            {/* Bottom: mini charts per maturity */}
            <div className="yield-curve-section-label yield-curve-section-label--mini">MATURITY BREAKDOWN</div>
            <div className="yield-mini-grid">
                {MATURITIES.map(m => (
                    <MiniYieldChart key={m.symbol} symbol={m.symbol} label={m.label} />
                ))}
            </div>
        </div>
    )
}
