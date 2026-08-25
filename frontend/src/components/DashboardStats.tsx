import { useEffect, useState, type ReactNode } from 'react'
import { Activity, Clock, Flame, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { toDateStr, startOfWeekMonday } from '@/lib/date'
import { MAX_REASONABLE_SESSION_SECONDS } from '@/lib/workout'
import { cn } from '@/lib/utils'

type SessionTotals = { total_calories: number | null; total_duration_seconds: number | null }

// Sessions with an absurd duration (a tab left open without pausing, from before that was
// fixed, or simply old bad data still sitting in the table) drag both the shown totals and
// the vs-yesterday percentage into nonsense — exclude them rather than display them.
function isTrustworthy(row: SessionTotals) {
  return (row.total_duration_seconds ?? 0) <= MAX_REASONABLE_SESSION_SECONDS
}

function sumTotals(rows: SessionTotals[] | null) {
  return (rows ?? []).filter(isTrustworthy).reduce(
    (acc, r) => ({
      calories: acc.calories + (r.total_calories ?? 0),
      duration: acc.duration + (r.total_duration_seconds ?? 0),
    }),
    { calories: 0, duration: 0 }
  )
}

function pctChange(today: number, yesterday: number | null) {
  if (yesterday == null || yesterday <= 0) return null
  return ((today - yesterday) / yesterday) * 100
}

export function DashboardStats() {
  const [loading, setLoading] = useState(true)
  const [todayCalories, setTodayCalories] = useState(0)
  const [yesterdayCalories, setYesterdayCalories] = useState<number | null>(null)
  const [todayDuration, setTodayDuration] = useState(0)
  const [yesterdayDuration, setYesterdayDuration] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [consistency, setConsistency] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      setLoading(false)
      return
    }

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const monday = startOfWeekMonday(today)
    const weekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      weekDates.push(toDateStr(d))
    }

    const [
      { data: todaySessions },
      { data: yesterdaySessions },
      { data: allDates },
      { data: scheduleRows },
      { data: weekSessions },
    ] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('total_calories, total_duration_seconds')
        .eq('user_id', user.id)
        .eq('date', toDateStr(today)),
      supabase
        .from('workout_sessions')
        .select('total_calories, total_duration_seconds')
        .eq('user_id', user.id)
        .eq('date', toDateStr(yesterday)),
      supabase.from('workout_sessions').select('date').eq('user_id', user.id),
      supabase.from('weekly_schedule').select('day_of_week, plan_id').eq('user_id', user.id),
      supabase
        .from('workout_sessions')
        .select('date')
        .eq('user_id', user.id)
        .gte('date', weekDates[0])
        .lte('date', weekDates[6]),
    ])

    const todayTotals = sumTotals(todaySessions)
    setTodayCalories(todayTotals.calories)
    setTodayDuration(todayTotals.duration)

    // Only compare against yesterday if yesterday actually has a trustworthy finished session
    // AND today isn't hiding an untrustworthy one behind a filtered-down "0" — otherwise the
    // "vs yesterday" line would be comparing against a meaningless zero, or against a bad/
    // absurd stored value (e.g. a session that ran for days because a tab was left open).
    const todayHasUntrustworthySession = (todaySessions ?? []).some((s) => !isTrustworthy(s))
    const hasFinishedYesterday =
      !todayHasUntrustworthySession &&
      (yesterdaySessions ?? []).filter(isTrustworthy).some((s) => s.total_calories != null)
    if (hasFinishedYesterday) {
      const yTotals = sumTotals(yesterdaySessions)
      setYesterdayCalories(yTotals.calories)
      setYesterdayDuration(yTotals.duration)
    } else {
      setYesterdayCalories(null)
      setYesterdayDuration(null)
    }

    const sessionDates = new Set((allDates ?? []).map((s) => s.date))
    let streakCount = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    while (sessionDates.has(toDateStr(cursor))) {
      streakCount++
      cursor.setDate(cursor.getDate() - 1)
    }
    setStreak(streakCount)

    const scheduleByDow = new Map<number, string | null>()
    for (const row of scheduleRows ?? []) scheduleByDow.set(row.day_of_week, row.plan_id)
    const weekSessionDates = new Set((weekSessions ?? []).map((s) => s.date))
    const todayStr = toDateStr(today)
    let total = 0
    let done = 0
    for (const dateStr of weekDates) {
      const dow = new Date(dateStr + 'T00:00:00').getDay()
      const planId = scheduleByDow.get(dow)
      if (planId != null) {
        total++
        if (dateStr <= todayStr && weekSessionDates.has(dateStr)) done++
      }
    }
    setConsistency(total > 0 ? { done, total } : null)

    setLoading(false)
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    )
  }

  const caloriesPct = pctChange(todayCalories, yesterdayCalories)
  const durationPct = pctChange(todayDuration, yesterdayDuration)

  return (
    <div className={cn('grid grid-cols-2 gap-3', consistency ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
      <StatCard
        icon={<Flame className="size-4" />}
        label="Calories Burned"
        value={`${Math.round(todayCalories)} kcal`}
        pct={caloriesPct}
      />
      <StatCard
        icon={<Clock className="size-4" />}
        label="Workout Duration"
        value={`${Math.round(todayDuration / 60)} mins`}
        pct={durationPct}
      />
      <StatCard
        icon={<Trophy className="size-4" />}
        label="Workout Streak"
        value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
        sub={streak > 0 ? 'Keep it going!' : undefined}
      />
      {consistency && (
        <StatCard
          icon={<Activity className="size-4" />}
          label="Weekly Consistency"
          value={`${Math.round((consistency.done / consistency.total) * 100)}%`}
          sub={`${consistency.done} of ${consistency.total} days`}
        />
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  pct,
  sub,
}: {
  icon: ReactNode
  label: string
  value: string
  pct?: number | null
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-xl font-semibold sm:text-2xl">{value}</p>
        {pct != null && (
          <p className={cn('flex items-center gap-1 text-xs', pct >= 0 ? 'text-primary' : 'text-muted-foreground')}>
            {pct >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(Math.round(pct))}% vs yesterday
          </p>
        )}
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}
