import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import Game from '@/components/Game'

interface Props {
  params: { date: string }
}

function isValidPastDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) return false
  const d = new Date(date)
  if (isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

export default function PracticePage({ params }: Props) {
  if (!isValidPastDate(params.date)) notFound()

  return (
    <div className="py-4">
      <div className="max-w-2xl mx-auto px-4 mb-2">
        <Link
          href="/archiwum"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-ekstra-green transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Powrót do archiwum
        </Link>
      </div>
      <Game practiceDate={params.date} />
    </div>
  )
}
