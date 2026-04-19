import { useEffect, useRef } from 'react'

export function TVScreener() {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        el.innerHTML = ''

        const wrapper = document.createElement('div')
        wrapper.className = 'tradingview-widget-container__widget'
        wrapper.style.width = '100%'
        wrapper.style.height = '100%'
        el.appendChild(wrapper)

        const script = document.createElement('script')
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-screener.js'
        script.async = true
        script.innerHTML = JSON.stringify({
            width: '100%',
            height: '100%',
            defaultColumn: 'overview',
            defaultScreen: 'most_capitalized',
            market: 'america',
            showToolbar: true,
            colorTheme: 'dark',
            locale: 'en',
            isTransparent: true,
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
