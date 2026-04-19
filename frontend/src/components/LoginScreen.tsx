import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export function LoginScreen() {
    const [error, setError] = useState<string | null>(null)
    const [email, setEmail] = useState<string | null>(null)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const err = params.get('auth_error')
        const em = params.get('email')
        if (err) {
            if (err === 'not_authorized') {
                setError(`Access denied for ${em ?? 'this account'}. Your email is not on the authorized list.`)
                setEmail(em)
            } else if (err === 'callback_failed') {
                setError('Authentication failed. Please try again.')
            } else {
                setError('Sign-in error. Please try again.')
            }
        }
    }, [])

    const handleGoogleLogin = () => {
        window.location.href = `${API}/api/auth/google`
    }

    return (
        <div className="login-screen">
            <div className="login-bg-grid" />

            <div className="login-card">
                {/* Logo */}
                <div className="login-logo">
                    <span className="logo-dot" style={{ width: 8, height: 8 }} />
                    <span>BLOSSOM</span>
                </div>
                <div className="login-subtitle">INTELLIGENCE TERMINAL</div>

                <div className="login-divider" />

                <div className="login-tagline">
                    Secure access — authorized accounts only
                </div>

                {/* Error */}
                {error && (
                    <div className="login-error">
                        <AlertCircle size={12} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Google sign-in button */}
                <button className="login-google-btn" onClick={handleGoogleLogin}>
                    <GoogleIcon />
                    Continue with Google
                </button>

                <div className="login-footer">
                    Access is restricted to authorized accounts.
                    <br />
                    Contact your administrator to request access.
                </div>
            </div>
        </div>
    )
}

function GoogleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    )
}
