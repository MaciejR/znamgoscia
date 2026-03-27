import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { AuthProvider } from '@/lib/auth-context'
import { StatsProvider } from '@/lib/stats-context'
import HeaderNav from '@/components/HeaderNav'
import GlobalStatsModal from '@/components/GlobalStatsModal'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://znamgoscia.pl'

export const metadata: Metadata = {
  title: 'Znam Gościa - Codzienny Quiz Piłkarski',
  description: 'Zgadnij dzisiejszego zawodnika polskiej Ekstraklasy! Codzienny quiz w stylu Wordle dla fanów polskiej piłki.',
  keywords: ['ekstraklasa', 'quiz', 'piłka nożna', 'wordle', 'polska', 'zawodnik'],
  authors: [{ name: 'Znam Gościa' }],
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Znam Gościa - Codzienny Quiz Piłkarski',
    description: 'Zgadnij dzisiejszego zawodnika polskiej Ekstraklasy!',
    type: 'website',
    locale: 'pl_PL',
    siteName: 'Znam Gościa',
    url: SITE_URL,
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Znam Gościa - Codzienny Quiz Piłkarski' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Znam Gościa - Codzienny Quiz Piłkarski',
    description: 'Zgadnij dzisiejszego zawodnika polskiej Ekstraklasy!',
    images: ['/api/og'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Znam Gościa',
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
        <StatsProvider>
          <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
            <div className="max-w-4xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                  <Trophy className="w-8 h-8 text-ekstra-green group-hover:scale-110 transition-transform" />
                  <span className="text-xl font-bold bg-gradient-to-r from-ekstra-green to-green-600 bg-clip-text text-transparent">
                    Znam Gościa
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
              <p>© {new Date().getFullYear()} Znam Gościa</p>
            </div>
          </footer>
          <GlobalStatsModal />
        </StatsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
