'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const oauthError = params.get('error')
      const errorDescription = params.get('error_description')

      if (oauthError) {
        setError(errorDescription || oauthError)
        setTimeout(() => router.replace('/'), 3000)
        return
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError)
          setError('Nie udało się zalogować. Spróbuj ponownie.')
          setTimeout(() => router.replace('/'), 3000)
          return
        }
      }

      router.replace('/')
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-red-500 text-center mb-2">Błąd logowania</p>
        <p className="text-slate-500 text-sm text-center">{error}</p>
        <p className="text-slate-400 text-xs mt-2">Przekierowanie za chwilę...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-ekstra-green animate-spin" />
      <p className="mt-4 text-slate-500 dark:text-slate-400">Logowanie...</p>
    </div>
  )
}
