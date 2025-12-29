import { Trophy, ArrowUp, ArrowDown } from 'lucide-react'
import Link from 'next/link'

export default function JakGracPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
        Jak grać?
      </h1>

      {/* Podstawowe zasady */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Zasady gry
        </h2>
        <div className="space-y-3 text-slate-600 dark:text-slate-400">
          <p>
            <strong>1.</strong> Codziennie losowany jest jeden zawodnik z polskiej Ekstraklasy.
          </p>
          <p>
            <strong>2.</strong> Masz <strong>8 prób</strong>, żeby go odgadnąć.
          </p>
          <p>
            <strong>3.</strong> Po każdym strzale otrzymujesz podpowiedzi w formie kolorów.
          </p>
          <p>
            <strong>4.</strong> Wykorzystaj podpowiedzi, żeby zawęzić poszukiwania!
          </p>
        </div>
      </section>

      {/* Znaczenie kolorów */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Znaczenie kolorów
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-correct rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-medium text-slate-900 dark:text-white">Zielony</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Wartość jest identyczna jak u szukanego zawodnika
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-close rounded-lg flex items-center justify-center">
              <span className="text-black font-bold">±2</span>
            </div>
            <div>
              <div className="font-medium text-slate-900 dark:text-white">Żółty (tylko wiek)</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Wiek różni się o maksymalnie 2 lata
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
            <div className="w-12 h-12 bg-wrong rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">✗</span>
            </div>
            <div>
              <div className="font-medium text-slate-900 dark:text-white">Czerwony</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Wartość jest inna niż u szukanego zawodnika
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kategorie */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Kategorie podpowiedzi
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CategoryCard
            title="Narodowość"
            description="Flaga kraju pochodzenia zawodnika"
            example="🇵🇱 Polska"
          />
          <CategoryCard
            title="Pozycja"
            description="Ogólna pozycja na boisku"
            example="BR, OB, PO, NA"
          />
          <CategoryCard
            title="Klub"
            description="Aktualny klub zawodnika"
            example="LEG, LPO, RAK..."
          />
          <CategoryCard
            title="Liga"
            description="W jakiej lidze gra"
            example="EKL = Ekstraklasa"
          />
          <CategoryCard
            title="Wiek"
            description="Wiek zawodnika + kierunek"
            example={
              <span className="flex items-center gap-1">
                25 <ArrowUp className="w-3 h-3" /> = starszy
              </span>
            }
          />
          <CategoryCard
            title="Wspólne kluby"
            description="Kluby, w których grali obaj"
            example="Pokazane pod wynikiem"
          />
        </div>
      </section>

      {/* Przykład */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Przykład
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Załóżmy, że szukany zawodnik to polski pomocnik Legii Warszawa w wieku 28 lat.
            Jeśli typujesz brazylijskiego napastnika Rakowa w wieku 25 lat:
          </p>
          <div className="flex items-center gap-2 justify-center">
            <div className="w-10 h-10 bg-wrong rounded-lg flex items-center justify-center text-lg">
              🇧🇷
            </div>
            <div className="w-10 h-10 bg-wrong rounded-lg flex items-center justify-center text-white text-xs font-medium">
              NA
            </div>
            <div className="w-10 h-10 bg-wrong rounded-lg flex items-center justify-center text-white text-xs font-medium">
              RAK
            </div>
            <div className="w-10 h-10 bg-correct rounded-lg flex items-center justify-center text-white text-xs font-medium">
              EKL
            </div>
            <div className="w-10 h-10 bg-close rounded-lg flex items-center justify-center text-black text-xs font-medium">
              <span className="flex items-center">25<ArrowUp className="w-3 h-3" /></span>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
            Liga jest poprawna (Ekstraklasa), wiek bliski (±2), reszta niepoprawna.
          </p>
        </div>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-ekstra-green text-white rounded-xl font-medium hover:bg-ekstra-green/90 transition-colors"
        >
          <Trophy className="w-5 h-5" />
          Zagraj teraz!
        </Link>
      </div>
    </div>
  )
}

interface CategoryCardProps {
  title: string
  description: string
  example: React.ReactNode
}

function CategoryCard({ title, description, example }: CategoryCardProps) {
  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
      <div className="font-medium text-slate-900 dark:text-white mb-1">{title}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">{description}</div>
      <div className="text-sm font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded inline-block">
        {example}
      </div>
    </div>
  )
}
