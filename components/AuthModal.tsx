'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

type AuthMode = 'login' | 'register' | 'guest'

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
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
}
