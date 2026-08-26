import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toDateStr } from '@/lib/date'

type DayStatus = 'none' | 'partial' | 'finished'

type SessionDetail = {
  id: string
  planName: string
  startedAt: string
  completedAt: string | null
  totalSets: number
  completedSets: number
}

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
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, SessionDetail[]>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
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
      .select(
        'id, date, started_at, completed_at, workout_plans(name), session_exercises(id, session_sets(id, status))'
      )
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lt('date', monthEnd)
      .order('started_at', { ascending: true })

    if (monthError) {
      setError('Could not load calendar data.')
      setLoading(false)
      return
    }

    // Group per-session (not one flat pool of sets per date) — a date can have more than one
    // workout_sessions row (a real completed one plus an abandoned/test one), and aggregating
    // their sets together before checking "every set completed" was exactly the bug: one
    // incomplete session dragged an otherwise-finished day down to "partial".
    const sessionsMap: Record<string, SessionDetail[]> = {}
    for (const s of monthSessions ?? []) {
      const sets = (s.session_exercises ?? []).flatMap(
        (se: { session_sets: { id: string; status: string }[] }) => se.session_sets ?? []
      )
      const completedSets = sets.filter((set) => set.status === 'completed').length
      const plan = s.workout_plans as unknown as { name: string } | null
      const detail: SessionDetail = {
        id: s.id,
        planName: plan?.name ?? 'Unknown plan',
        startedAt: s.started_at,
        completedAt: s.completed_at,
        totalSets: sets.length,
        completedSets,
      }
      if (!sessionsMap[s.date]) sessionsMap[s.date] = []
      sessionsMap[s.date].push(detail)
    }

    // Completed: at least one session that date has every set completed.
    // Partial: no session is fully complete, but at least one set (any session) is completed.
    // No activity: no completed sets at all that date.
    const byDate: Record<string, DayStatus> = {}
    for (const [date, sessions] of Object.entries(sessionsMap)) {
      const hasFullyCompletedSession = sessions.some((s) => s.totalSets > 0 && s.completedSets === s.totalSets)
      const hasAnyCompletedSet = sessions.some((s) => s.completedSets > 0)
      byDate[date] = hasFullyCompletedSession ? 'finished' : hasAnyCompletedSet ? 'partial' : 'none'
    }

    setSessionsByDate(sessionsMap)
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
          <>
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
                const isSelected = dateStr === selectedDate
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setSelectedDate((prev) => (prev === dateStr ? null : dateStr))}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-md py-0.5 outline-none transition-colors',
                      isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                    )}
                  >
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
                  </button>
                )
              })}
            </div>

            {selectedDate && (
              <div className="mt-3 rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                {(sessionsByDate[selectedDate] ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions logged this day.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {sessionsByDate[selectedDate].map((s) => {
                      const isFullyCompleted = s.totalSets > 0 && s.completedSets === s.totalSets
                      return (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.planName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.completedAt ? 'Finished' : 'Not finished'} · id {s.id.slice(0, 8)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                              isFullyCompleted
                                ? 'bg-[#22C55E]/20 text-[#22C55E]'
                                : s.completedSets > 0
                                  ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                                  : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {s.completedSets}/{s.totalSets} sets
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
