'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

type AuthMode = 'login' | 'register' | 'guest'

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn, signUp, signInWithOAuth } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      if (mode === 'register') {
        // Walidacja
        if (!email || !password || !username) {
          setError('Wszystkie pola są wymagane')
          setLoading(false)
          return
        }

        if (password.length < 6) {
          setError('Hasło musi mieć co najmniej 6 znaków')
          setLoading(false)
          return
        }

        if (username.length < 3) {
          setError('Nazwa użytkownika musi mieć co najmniej 3 znaki')
          setLoading(false)
          return
        }

        const { error } = await signUp(email, password, username)

        if (error) {
          if (error.message.includes('already registered')) {
            setError('Ten email jest już zarejestrowany')
          } else {
            setError(error.message)
          }
        } else {
          setSuccessMessage('Konto utworzone! Sprawdź email aby potwierdzić rejestrację.')
          setEmail('')
          setPassword('')
          setUsername('')
          setTimeout(() => {
            setMode('login')
            setSuccessMessage(null)
          }, 3000)
        }
      } else if (mode === 'login') {
        // Walidacja
        if (!email || !password) {
          setError('Email i hasło są wymagane')
          setLoading(false)
          return
        }

        const { error } = await signIn(email, password)

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Nieprawidłowy email lub hasło')
          } else {
            setError(error.message)
          }
        } else {
          // Sukces - modal zostanie zamknięty automatycznie przez AuthContext
          onClose()
        }
      } else if (mode === 'guest') {
        // Graj jako gość - po prostu zamknij modal
        onClose()
      }
    } catch (err) {
      setError('Wystąpił błąd. Spróbuj ponownie.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleGuestPlay = () => {
    onClose()
  }

  const handleOAuthLogin = async (provider: 'google' | 'azure') => {
    setError(null)
    setLoading(true)

    try {
      const { error } = await signInWithOAuth(provider)

      if (error) {
        setError(`Nie udało się zalogować przez ${provider === 'google' ? 'Google' : 'Microsoft'}`)
      }
      // OAuth przekieruje użytkownika, więc nie zamykamy modala tutaj
    } catch (err) {
      setError('Wystąpił błąd podczas logowania')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999 }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 overflow-y-auto"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'calc(100% - 2rem)',
          maxWidth: '28rem',
          maxHeight: '80vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
          {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>

        {/* Header */}
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {mode === 'register' ? 'Utwórz konto' : 'Zaloguj się'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {mode === 'register'
            ? 'Stwórz konto, aby zapisywać swoje statystyki'
            : 'Zaloguj się, aby zobaczyć swoje statystyki'}
        </p>

        {/* OAuth Buttons */}
        {mode === 'login' && (
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              disabled={loading}
              className="w-full py-3 px-4 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Kontynuuj z Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('azure')}
              disabled={loading}
              className="w-full py-3 px-4 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f25022" d="M0 0h11v11H0z"/>
                <path fill="#00a4ef" d="M12 0h11v11H12z"/>
                <path fill="#7fba00" d="M0 12h11v11H0z"/>
                <path fill="#ffb900" d="M12 12h11v11H12z"/>
              </svg>
              Kontynuuj z Microsoft
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  lub za pomocą email
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nazwa użytkownika
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-ekstra-green focus:border-transparent"
                placeholder="jankowalski"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-ekstra-green focus:border-transparent"
              placeholder="twoj@email.pl"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Hasło
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-ekstra-green focus:border-transparent"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-ekstra-green hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {mode === 'register' ? 'Tworzenie konta...' : 'Logowanie...'}
              </>
            ) : (
              mode === 'register' ? 'Utwórz konto' : 'Zaloguj się'
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
              setSuccessMessage(null)
            }}
            className="text-sm text-ekstra-green hover:underline"
            disabled={loading}
          >
            {mode === 'register' ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
          </button>
        </div>

        {/* Guest mode */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleGuestPlay}
            className="w-full py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Kontynuuj jako gość
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
