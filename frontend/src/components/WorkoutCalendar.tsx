import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toDateStr } from '@/lib/date'

type DayStatus = 'none' | 'partial' | 'finished'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const LEGEND: { status: DayStatus; label: string }[] = [
  { status: 'finished', label: 'Completed' },
  { status: 'partial', label: 'Partial' },
  { status: 'none', label: 'No Activity' },
]

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

    const { data: monthSessions, error: monthError } = await supabase
      .from('workout_sessions')
      .select('id, date, session_exercises(id, session_sets(id, status))')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lt('date', monthEnd)

    if (monthError) {
      setError('Could not load calendar data.')
      setLoading(false)
      return
    }

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

    setStatusByDate(byDate)
    setLoading(false)
  }

  const cells = getMonthCells(year, month)
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayStr = toDateStr(new Date())

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-heading text-sm">{monthLabel}</CardTitle>
          <div className="flex items-center gap-2.5">
            {LEGEND.map((item) => (
              <span key={item.status} className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    item.status === 'finished' && 'bg-[#22C55E]',
                    item.status === 'partial' && 'bg-[#F59E0B]',
                    item.status === 'none' && 'bg-muted-foreground/40'
                  )}
                />
                {item.label}
              </span>
            ))}
          </div>
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
          <div className="mx-auto grid max-w-xs grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="pb-0.5 text-center text-[0.6rem] font-medium text-muted-foreground">
                {label}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />
              const dateStr = toDateStr(new Date(year, month, day))
              const status = statusByDate[dateStr] ?? 'none'
              const isToday = dateStr === todayStr
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 py-0.5">
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[0.65rem] text-foreground',
                      isToday && 'ring-2 ring-[#22C55E] ring-offset-1 ring-offset-card'
                    )}
                  >
                    {day}
                  </span>
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      status === 'finished' && 'bg-[#22C55E]',
                      status === 'partial' && 'bg-[#F59E0B]',
                      status === 'none' && 'bg-muted-foreground/30'
                    )}
                  />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
