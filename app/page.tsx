import Game from '@/components/Game'

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col">
      {/* Hero section */}
      <section className="text-center py-8 px-4">
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Codzienny quiz piłkarski. Zgadnij zawodnika polskiej ligi!
        </p>
      </section>

      {/* Gra */}
      <section className="flex-1">
        <Game />
      </section>
    </div>
  )
}
