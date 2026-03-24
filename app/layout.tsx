import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { Trophy, HelpCircle, Calendar, BarChart3 } from 'lucide-react'
import { AuthProvider } from '@/lib/auth-context'
import HeaderNav from '@/components/HeaderNav'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ekstraklasaguess.pl'

export const metadata: Metadata = {
  title: 'Ekstra Typ - Codzienny Quiz Piłkarski',
  description: 'Zgadnij dzisiejszego zawodnika polskiej Ekstraklasy! Codzienny quiz w stylu Wordle dla fanów polskiej piłki.',
  keywords: ['ekstraklasa', 'quiz', 'piłka nożna', 'wordle', 'polska', 'zawodnik'],
  authors: [{ name: 'Ekstra Typ' }],
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Ekstra Typ - Codzienny Quiz Piłkarski',
    description: 'Zgadnij dzisiejszego zawodnika polskiej Ekstraklasy!',
    type: 'website',
    locale: 'pl_PL',
    siteName: 'Ekstra Typ',
    url: SITE_URL,
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Ekstra Typ - Codzienny Quiz Piłkarski' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ekstra Typ - Codzienny Quiz Piłkarski',
    description: 'Zgadnij dzisiejszego zawodnika polskiej Ekstraklasy!',
    images: ['/api/og'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ekstra Typ',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#00843d',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body className={`${inter.className} min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800`}>
        <AuthProvider>
          <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
            <div className="max-w-4xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                  <Trophy className="w-8 h-8 text-ekstra-green group-hover:scale-110 transition-transform" />
                  <span className="text-xl font-bold bg-gradient-to-r from-ekstra-green to-green-600 bg-clip-text text-transparent">
                    Ekstra Typ
                  </span>
                </Link>

                <HeaderNav />
              </div>
            </div>
          </header>

          <main className="flex-1">
            {children}
          </main>

          <footer className="mt-auto py-6 border-t border-slate-200 dark:border-slate-700">
            <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
              <p>
                Dane zawodników z{' '}
                <a
                  href="https://www.transfermarkt.pl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ekstra-green hover:underline"
                >
                  Transfermarkt
                </a>
              </p>
              <p className="mt-1">
                Inspiracja:{' '}
                <a
                  href="https://www.manmark.co.uk/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ekstra-green hover:underline"
                >
                  ManMark
                </a>
              </p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}
