import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type DayStatus = 'none' | 'partial' | 'finished'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toDateStr(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthCells(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

export function WorkoutCalendar() {
  const [statusByDate, setStatusByDate] = useState<Record<string, DayStatus>>({})
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      setError('Could not load calendar data.')
      setLoading(false)
      return
    }

    const monthStart = toDateStr(new Date(year, month, 1))
    const monthEnd = toDateStr(new Date(year, month + 1, 1))

    const [monthResult, allResult] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('id, date, session_exercises(id, session_sets(id, status))')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lt('date', monthEnd),
      supabase.from('workout_sessions').select('date').eq('user_id', user.id),
    ])

    if (monthResult.error || allResult.error) {
      setError('Could not load calendar data.')
      setLoading(false)
      return
    }

    const monthSessions = monthResult.data
    const allSessions = allResult.data

    const setsByDate: Record<string, { status: string }[]> = {}
    for (const session of monthSessions ?? []) {
      const sets = (session.session_exercises ?? []).flatMap(
        (se: { session_sets: { id: string; status: string }[] }) => se.session_sets ?? []
      )
      if (!setsByDate[session.date]) setsByDate[session.date] = []
      setsByDate[session.date].push(...sets)
    }

    const byDate: Record<string, DayStatus> = {}
    for (const [date, sets] of Object.entries(setsByDate)) {
      byDate[date] = sets.length > 0 && sets.every((s) => s.status === 'completed') ? 'finished' : 'partial'
    }

    const sessionDates = new Set((allSessions ?? []).map((s) => s.date))
    let streakCount = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    while (sessionDates.has(toDateStr(cursor))) {
      streakCount++
      cursor.setDate(cursor.getDate() - 1)
    }

    setStatusByDate(byDate)
    setStreak(streakCount)
    setLoading(false)
  }

  const cells = getMonthCells(year, month)
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayStr = toDateStr(now)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-2xl">{monthLabel}</CardTitle>
          {!error && <span className="text-sm font-medium">🔥 {streak} day streak</span>}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="pb-1 text-center text-xs font-medium text-muted-foreground">
                {label}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />
              const dateStr = toDateStr(new Date(year, month, day))
              const status = statusByDate[dateStr] ?? 'none'
              const isToday = dateStr === todayStr
              return (
                <div
                  key={i}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-lg text-sm backdrop-blur-sm',
                    status === 'finished' && 'bg-[#22C55E]/30 text-foreground',
                    status === 'partial' && 'bg-[#F59E0B]/30 text-foreground',
                    status === 'none' && 'bg-transparent text-muted-foreground',
                    isToday && 'ring-2 ring-[#22C55E] ring-offset-1 ring-offset-card'
                  )}
                >
                  {day}
                  {status === 'finished' && (
                    <Check className="absolute bottom-0.5 right-0.5 size-3 text-[#22C55E]" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
