'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { SearchResult } from '@/lib/types'
import { getFlagEmoji, debounce } from '@/lib/utils'
import Image from 'next/image'

interface GuessInputProps {
  onGuess: (player: SearchResult) => void
  disabled?: boolean
}

export default function GuessInput({ onGuess, disabled }: GuessInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounced search function
  const searchPlayers = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([])
        setIsOpen(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=8`)
        const data = await response.json()
        setResults(data.players || [])
        setIsOpen(data.players?.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300),
    []
  )

  // Wyszukaj po zmianie zapytania
  useEffect(() => {
    searchPlayers(query)
  }, [query, searchPlayers])

  // Zamknij dropdown po kliknięciu poza
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Obsługa klawiatury
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          selectPlayer(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  const selectPlayer = (player: SearchResult) => {
    onGuess(player)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Wpisz nazwę zawodnika..."
          disabled={disabled}
          className="w-full px-4 py-3 pl-11 pr-10 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:border-ekstra-green focus:outline-none focus:ring-2 focus:ring-ekstra-green/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        {isLoading && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
        )}
      </div>

      {/* Dropdown z wynikami */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
        >
          {results.map((player, index) => (
            <button
              key={player.id}
              onClick={() => selectPlayer(player)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-slate-100 dark:bg-slate-700'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {/* Zdjęcie zawodnika */}
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-600 flex-shrink-0">
                {player.photo_url ? (
                  <Image
                    src={player.photo_url}
                    alt={player.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                    ?
                  </div>
                )}
              </div>

              {/* Dane zawodnika */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-white truncate">
                    {player.name}
                  </span>
                  <span className="text-lg flex-shrink-0">
                    {getFlagEmoji(player.nationality_code)}
                  </span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {player.club_name || 'Brak klubu'} • {player.position}
                </div>
              </div>

              {/* Skrót klubu */}
              {player.club_short && (
                <span className="px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 flex-shrink-0">
                  {player.club_short}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Brak wyników */}
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 text-center text-slate-500 dark:text-slate-400">
          Nie znaleziono zawodnika
        </div>
      )}
    </div>
  )
}
