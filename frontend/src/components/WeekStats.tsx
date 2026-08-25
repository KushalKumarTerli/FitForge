import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'

function toDateStr(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function longestConsecutiveRun(dateStrs: string[]) {
  const dates = new Set(dateStrs)
  let longest = 0
  for (const dateStr of dates) {
    const d = new Date(dateStr)
    const prev = new Date(d)
    prev.setDate(prev.getDate() - 1)
    if (dates.has(toDateStr(prev))) continue // not the start of a run

    let len = 1
    const cursor = new Date(d)
    while (true) {
      cursor.setDate(cursor.getDate() + 1)
      if (dates.has(toDateStr(cursor))) len++
      else break
    }
    longest = Math.max(longest, len)
  }
  return longest
}

export function WeekStats() {
  const [loading, setLoading] = useState(true)
  const [workoutsCompleted, setWorkoutsCompleted] = useState(0)
  const [caloriesBurned, setCaloriesBurned] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)

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

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

    const [weekResult, allDatesResult] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('id, total_calories, session_exercises(id, session_sets(id, status))')
        .eq('user_id', user.id)
        .gte('date', toDateStr(sevenDaysAgo)),
      supabase.from('workout_sessions').select('date').eq('user_id', user.id),
    ])

    if (weekResult.error || allDatesResult.error) {
      setLoading(false)
      return
    }

    const weekSessions = weekResult.data ?? []
    let completed = 0
    let calories = 0
    for (const s of weekSessions) {
      const sets = (s.session_exercises ?? []).flatMap(
        (se: { session_sets: { id: string; status: string }[] }) => se.session_sets ?? []
      )
      if (sets.length > 0 && sets.every((set) => set.status === 'completed')) {
        completed++
      }
      calories += s.total_calories ?? 0
    }

    const allDates = (allDatesResult.data ?? []).map((s) => s.date)

    setWorkoutsCompleted(completed)
    setCaloriesBurned(calories)
    setLongestStreak(longestConsecutiveRun(allDates))
    setLoading(false)
  }

  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-3">
        {loading ? (
          <p className="col-span-3 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold">{workoutsCompleted}</p>
              <p className="text-xs text-muted-foreground">workouts this week</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold">{Math.round(caloriesBurned)}</p>
              <p className="text-xs text-muted-foreground">calories this week</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold">{longestStreak}</p>
              <p className="text-xs text-muted-foreground">longest streak ever</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
