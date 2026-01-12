'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HelpCircle, Calendar, BarChart3, User, LogOut, LogIn } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import AuthModal from './AuthModal'

export default function HeaderNav() {
  const { user, profile, signOut } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    setShowUserMenu(false)
  }

  return (
    <>
      <nav className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/jak-grac"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Jak grać?"
        >
          <HelpCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <Link
          href="/archiwum"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Archiwum"
        >
          <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <button
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Statystyki"
          id="stats-button"
        >
          <BarChart3 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>

        {/* User menu */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
              title={profile?.display_name || user.email || 'Profil'}
            >
              <User className="w-5 h-5 text-ekstra-green" />
              {profile?.username && (
                <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-300">
                  {profile.username}
                </span>
              )}
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20">
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {profile?.display_name || 'Użytkownik'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Wyloguj się
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
            title="Zaloguj się"
          >
            <LogIn className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-300">
              Zaloguj się
            </span>
          </button>
        )}
      </nav>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  )
}
