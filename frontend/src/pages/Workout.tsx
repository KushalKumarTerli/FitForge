import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

type SessionRow = {
  id: string
  started_at: string
  completed_at: string | null
  total_calories: number | null
  total_duration_seconds: number | null
}

type SessionSet = {
  id: string
  session_exercise_id: string
  set_number: number
  target_reps: number | null
  target_duration_seconds: number | null
  status: 'pending' | 'completed' | 'skipped' | 'failed'
  completed_at: string | null
}

type SessionExercise = {
  id: string
  exercise_id: string
  sets: number
  exercises: {
    id: string
    name: string
    muscle_group: string
    met_value: number
    tracking_type: 'reps' | 'duration'
  }
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export default function Workout() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionId = (location.state as { sessionId?: string } | null)?.sessionId

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionRow | null>(null)
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [setsByExercise, setSetsByExercise] = useState<Record<string, SessionSet[]>>({})
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ calories: number; durationSeconds: number } | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const [{ data: sessionRow }, { data: profileRow }, { data: sessionExercises }] = await Promise.all([
        supabase
          .from('workout_sessions')
          .select('id, started_at, completed_at, total_calories, total_duration_seconds')
          .eq('id', sessionId)
          .single(),
        user
          ? supabase.from('profiles').select('weight_kg').eq('id', user.id).single()
          : Promise.resolve({ data: null }),
        supabase
          .from('session_exercises')
          .select('id, exercise_id, sets, exercises(id, name, muscle_group, met_value, tracking_type)')
          .eq('session_id', sessionId)
          .order('created_at'),
      ])

      setSession(sessionRow)
      setWeightKg(profileRow?.weight_kg ?? null)
      setExercises((sessionExercises as unknown as SessionExercise[]) ?? [])

      if (sessionRow?.completed_at && sessionRow.total_duration_seconds != null) {
        setSummary({
          calories: sessionRow.total_calories ?? 0,
          durationSeconds: sessionRow.total_duration_seconds,
        })
      }

      const exerciseIds = (sessionExercises ?? []).map((se) => se.id)
      if (exerciseIds.length > 0) {
        const { data: sets } = await supabase
          .from('session_sets')
          .select('*')
          .in('session_exercise_id', exerciseIds)
          .order('set_number')

        const grouped: Record<string, SessionSet[]> = {}
        for (const set of sets ?? []) {
          if (!grouped[set.session_exercise_id]) grouped[set.session_exercise_id] = []
          grouped[set.session_exercise_id].push(set)
        }
        setSetsByExercise(grouped)
      }

      setLoading(false)
    }

    load()
  }, [sessionId])

  useEffect(() => {
    if (!session || summary) return
    const startedAt = new Date(session.started_at).getTime()
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session, summary])

  const allSets = useMemo(() => Object.values(setsByExercise).flat(), [setsByExercise])
  const completedCount = allSets.filter((s) => s.status === 'completed').length

  async function completeSet(sessionExerciseId: string, setId: string) {
    const completedAt = new Date().toISOString()
    setSetsByExercise((prev) => ({
      ...prev,
      [sessionExerciseId]: prev[sessionExerciseId].map((s) =>
        s.id === setId ? { ...s, status: 'completed', completed_at: completedAt } : s
      ),
    }))
    await supabase
      .from('session_sets')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', setId)
  }

  async function handleFinishWorkout() {
    if (!session) return
    setError(null)
    setFinishing(true)

    const completedAt = new Date()
    const startedAt = new Date(session.started_at)
    const durationSeconds = Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000))
    const durationHours = durationSeconds / 3600
    const numExercises = exercises.length || 1

    const totalCalories = exercises.reduce((sum, se) => {
      const perExerciseHours = durationHours / numExercises
      return sum + se.exercises.met_value * (weightKg ?? 0) * perExerciseHours
    }, 0)

    const { error: finishError } = await supabase
      .from('workout_sessions')
      .update({
        completed_at: completedAt.toISOString(),
        total_duration_seconds: durationSeconds,
        total_calories: totalCalories,
      })
      .eq('id', session.id)

    if (finishError) {
      setError(finishError.message)
      setFinishing(false)
      return
    }

    setSummary({ calories: totalCalories, durationSeconds })
    setFinishing(false)
  }

  if (!sessionId) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>No active workout</CardTitle>
            <CardDescription>Start a workout from the dashboard first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (summary) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Workout complete</CardTitle>
            <CardDescription>Nice work.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-2xl font-semibold">{Math.round(summary.calories)}</p>
                <p className="text-sm text-muted-foreground">calories</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-2xl font-semibold">{formatDuration(summary.durationSeconds)}</p>
                <p className="text-sm text-muted-foreground">total time</p>
              </div>
            </div>
            <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{formatDuration(elapsedSeconds)}</CardTitle>
          <CardDescription>
            {completedCount} / {allSets.length} sets completed
          </CardDescription>
        </CardHeader>
      </Card>

      {exercises.map((se) => (
        <Card key={se.id}>
          <CardHeader>
            <CardTitle className="text-base">{se.exercises.name}</CardTitle>
            <CardDescription>{se.exercises.muscle_group}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(setsByExercise[se.id] ?? []).map((set) => {
                const isCompleted = set.status === 'completed'
                const target =
                  se.exercises.tracking_type === 'reps'
                    ? `${set.target_reps} reps`
                    : `${set.target_duration_seconds}s`
                return (
                  <button
                    key={set.id}
                    type="button"
                    disabled={isCompleted}
                    onClick={() => completeSet(se.id, set.id)}
                    className={cn(
                      'flex min-h-11 min-w-20 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                      isCompleted
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted'
                    )}
                  >
                    <span className="flex items-center gap-1 font-medium">
                      {isCompleted && <Check className="size-3.5" />}
                      Set {set.set_number}
                    </span>
                    <span className={isCompleted ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                      {target}
                    </span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button disabled={finishing} onClick={handleFinishWorkout}>
        {finishing ? 'Finishing…' : 'Finish Workout'}
      </Button>
    </div>
  )
}
