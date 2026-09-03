import { useEffect, useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { CheckCircle2, Lock, MinusCircle, PlayCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toDateStr, startOfWeekMonday } from '@/lib/date'

type Plan = { id: string; name: string }
type DayStatus = 'none' | 'partial' | 'finished'

type WeekSessionRow = {
  date: string
  plan_id: string | null
  completed_at: string | null
  session_exercises: { session_sets: { status: string }[] }[] | null
}

type WeeklyScheduleProps = {
  plans: Plan[]
  scheduleByDow: Record<number, string | null>
  onAssign: (dow: number, planId: string | null) => Promise<void>
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// display index 0=Mon..6=Sun -> JS Date#getDay() value (0=Sun..6=Sat)
function displayIndexToDow(i: number) {
  return (i + 1) % 7
}

export function WeeklySchedule({ plans, scheduleByDow, onAssign }: WeeklyScheduleProps) {
  // For any date this week with a *completed* session, that day is locked to the plan that
  // was actually recorded for it — weekly_schedule no longer governs it, and it can't be
  // reassigned. Days without a completed session (today before finishing, or future days)
  // stay driven by scheduleByDow and remain editable.
  const [lockedByDate, setLockedByDate] = useState<Record<string, string | null>>({})
  // Same per-session completed/partial/none derivation WorkoutCalendar uses, scoped to this
  // week's date range — shown as a small dot per day so This Week reflects real session status,
  // not just the assigned plan name.
  const [statusByDate, setStatusByDate] = useState<Record<string, DayStatus>>({})
  const [loading, setLoading] = useState(true)
  const [savingDow, setSavingDow] = useState<number | null>(null)

  useEffect(() => {
    loadLocks()
  }, [])

  async function loadLocks() {
    setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      setLoading(false)
      return
    }

    const monday = startOfWeekMonday(new Date())
    const weekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      weekDates.push(toDateStr(d))
    }

    const { data: weekSessions } = await supabase
      .from('workout_sessions')
      .select('date, plan_id, completed_at, session_exercises(session_sets(status))')
      .eq('user_id', user.id)
      .gte('date', weekDates[0])
      .lte('date', weekDates[6])
      .order('completed_at', { ascending: false })

    const rowsByDate: Record<string, WeekSessionRow[]> = {}
    for (const row of (weekSessions ?? []) as unknown as WeekSessionRow[]) {
      if (!rowsByDate[row.date]) rowsByDate[row.date] = []
      rowsByDate[row.date].push(row)
    }

    const lockMap: Record<string, string | null> = {}
    const statusMap: Record<string, DayStatus> = {}
    for (const [date, rows] of Object.entries(rowsByDate)) {
      // most-recently-completed session for a date wins, if there happen to be more than one
      const completedRow = rows.find((r) => r.completed_at != null)
      if (completedRow) lockMap[date] = completedRow.plan_id

      let hasFullyCompletedSession = false
      let hasAnyCompletedSet = false
      for (const row of rows) {
        const sets = (row.session_exercises ?? []).flatMap((se) => se.session_sets ?? [])
        const completedSets = sets.filter((s) => s.status === 'completed').length
        if (sets.length > 0 && completedSets === sets.length) hasFullyCompletedSession = true
        if (completedSets > 0) hasAnyCompletedSet = true
      }
      statusMap[date] = hasFullyCompletedSession ? 'finished' : hasAnyCompletedSet ? 'partial' : 'none'
    }

    setLockedByDate(lockMap)
    setStatusByDate(statusMap)
    setLoading(false)
  }

  async function handleAssign(dow: number, planId: string | null) {
    setSavingDow(dow)
    await onAssign(dow, planId)
    setSavingDow(null)
  }

  const monday = startOfWeekMonday(new Date())
  const todayStr = toDateStr(new Date())

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Week</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {DAY_LABELS.map((label, i) => {
              const date = new Date(monday)
              date.setDate(date.getDate() + i)
              const dow = displayIndexToDow(i)
              const dateStr = toDateStr(date)
              const isToday = dateStr === todayStr
              const isLocked = dateStr in lockedByDate
              const effectivePlanId = isLocked ? lockedByDate[dateStr] : (scheduleByDow[dow] ?? null)
              const planName = effectivePlanId ? (plans.find((p) => p.id === effectivePlanId)?.name ?? '…') : 'Rest'
              const status = statusByDate[dateStr] ?? 'none'

              const cellClassName = cn(
                'flex w-full flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center outline-none transition-colors',
                isToday ? 'border-primary bg-primary/10' : 'border-border',
                isLocked ? 'cursor-default opacity-80' : 'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50'
              )

              const cellBody = (
                <>
                  <span className="flex items-center gap-0.5 text-[0.65rem] font-medium text-muted-foreground">
                    {label}
                    {isLocked && <Lock className="size-2.5" />}
                  </span>
                  <span className="text-sm font-semibold">{date.getDate()}</span>
                  {status === 'finished' ? (
                    <CheckCircle2 className="size-4 text-[#22C55E]" />
                  ) : isToday ? (
                    <PlayCircle className="size-4 text-primary" />
                  ) : (
                    <MinusCircle
                      className={cn('size-4', status === 'partial' ? 'text-[#F59E0B]' : 'text-muted-foreground/40')}
                    />
                  )}
                  <span
                    className={cn(
                      'line-clamp-1 min-h-4 text-[0.6rem] leading-tight break-words',
                      effectivePlanId ? 'text-accent' : 'text-muted-foreground'
                    )}
                  >
                    {savingDow === dow ? '…' : planName}
                  </span>
                </>
              )

              if (isLocked) {
                return (
                  <div key={i} className={cellClassName} title="This day is locked to the workout you actually completed">
                    {cellBody}
                  </div>
                )
              }

              return (
                <Menu.Root key={i}>
                  <Menu.Trigger className={cellClassName}>{cellBody}</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner sideOffset={6} className="z-50">
                      <Menu.Popup className="max-h-[240px] min-w-36 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                        <Menu.Item
                          onClick={() => handleAssign(dow, null)}
                          className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-primary/15 data-[highlighted]:to-accent/10"
                        >
                          Rest
                        </Menu.Item>
                        {plans.map((plan) => (
                          <Menu.Item
                            key={plan.id}
                            onClick={() => handleAssign(dow, plan.id)}
                            className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-primary/15 data-[highlighted]:to-accent/10"
                          >
                            {plan.name}
                          </Menu.Item>
                        ))}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
