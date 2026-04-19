import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export interface AuthUser {
    email: string
    name: string
    avatar: string
}

interface AuthState {
    user: AuthUser | null
    token: string | null
    loading: boolean
}

interface AuthContextValue extends AuthState {
    logout: () => Promise<void>
    setToken: (token: string) => void
    authHeader: () => Record<string, string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_KEY = 'aob_session'

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: null,
        loading: true,
    })

    const verify = useCallback(async (token: string) => {
        try {
            const res = await fetch(`${API}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (data.user) {
                setState({ user: data.user, token, loading: false })
                localStorage.setItem(SESSION_KEY, token)
            } else {
                localStorage.removeItem(SESSION_KEY)
                setState({ user: null, token: null, loading: false })
            }
        } catch {
            localStorage.removeItem(SESSION_KEY)
            setState({ user: null, token: null, loading: false })
        }
    }, [])

    // On mount: check for session token in URL or localStorage
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const urlSession = params.get('session')
        const urlError = params.get('auth_error')

        // Clean URL params
        if (urlSession || urlError) {
            const clean = window.location.pathname
            window.history.replaceState({}, '', clean)
        }

        if (urlSession) {
            verify(urlSession)
        } else {
            const stored = localStorage.getItem(SESSION_KEY)
            if (stored) {
                verify(stored)
            } else {
                setState((s) => ({ ...s, loading: false }))
            }
        }
    }, [verify])

    const logout = useCallback(async () => {
        const token = localStorage.getItem(SESSION_KEY)
        if (token) {
            await fetch(`${API}/api/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            }).catch(() => null)
        }
        localStorage.removeItem(SESSION_KEY)
        setState({ user: null, token: null, loading: false })
    }, [])

    const setToken = useCallback((token: string) => {
        verify(token)
    }, [verify])

    const authHeader = useCallback(() => {
        const token = state.token ?? localStorage.getItem(SESSION_KEY) ?? ''
        return token ? { Authorization: `Bearer ${token}` } : {}
    }, [state.token])

    return (
        <AuthContext.Provider value={{ ...state, logout, setToken, authHeader }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
