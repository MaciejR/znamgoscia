import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Jeśli wystąpił błąd podczas OAuth
  if (error) {
    console.error('OAuth error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  // Jeśli mamy kod, wymień go na sesję
  if (code) {
    try {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Error exchanging code for session:', exchangeError)
        return NextResponse.redirect(
          new URL('/?auth_error=authentication_failed', requestUrl.origin)
        )
      }

      // Sukces - przekieruj do strony głównej
      return NextResponse.redirect(new URL('/', requestUrl.origin))
    } catch (err) {
      console.error('Unexpected error during OAuth callback:', err)
      return NextResponse.redirect(
        new URL('/?auth_error=unexpected_error', requestUrl.origin)
      )
    }
  }

  // Brak kodu i błędu - coś poszło nie tak
  return NextResponse.redirect(
    new URL('/?auth_error=missing_code', requestUrl.origin)
  )
}
