import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, Clock, Pause, Play, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { supabase } from '@/lib/supabase'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AppHeader } from '@/components/AppHeader'
import { RadialProgress } from '@/components/RadialProgress'

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
  const [accumulatedMs, setAccumulatedMs] = useState(0)
  const [runningSince, setRunningSince] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [resetting, setResetting] = useState(false)
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

  // On session load, seed accumulated active time from the elapsed wall time since
  // started_at and start the clock running. Pause/resume from here on tracks active
  // time only client-side (a refresh mid-pause falls back to this same seeding, i.e.
  // it re-derives from started_at rather than remembering the paused point).
  useEffect(() => {
    if (!session) return
    const startedAtMs = new Date(session.started_at).getTime()
    setAccumulatedMs(Math.max(0, Date.now() - startedAtMs))
    setRunningSince(Date.now())
  }, [session])

  useEffect(() => {
    if (!runningSince || summary) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [runningSince, summary])

  const displayMs = accumulatedMs + (runningSince ? Date.now() - runningSince : 0)
  const displaySeconds = Math.floor(displayMs / 1000)
  const isPaused = runningSince === null

  function handlePauseResume() {
    if (runningSince) {
      setAccumulatedMs((prev) => prev + (Date.now() - runningSince))
      setRunningSince(null)
    } else {
      setRunningSince(Date.now())
    }
  }

  const allSets = useMemo(() => Object.values(setsByExercise).flat(), [setsByExercise])
  const completedCount = allSets.filter((s) => s.status === 'completed').length

  async function handleResetWorkout() {
    setResetting(true)
    setError(null)

    const allSetIds = allSets.map((s) => s.id)
    const { error: resetError } = await supabase
      .from('session_sets')
      .update({ status: 'pending', completed_at: null })
      .in('id', allSetIds)

    if (resetError) {
      setError(resetError.message)
      setResetting(false)
      return
    }

    setSetsByExercise((prev) => {
      const next: Record<string, SessionSet[]> = {}
      for (const [key, sets] of Object.entries(prev)) {
        next[key] = sets.map((s) => ({ ...s, status: 'pending', completed_at: null }))
      }
      return next
    })

    setAccumulatedMs(0)
    setRunningSince(Date.now())
    setResetting(false)
  }

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
    const finalMs = accumulatedMs + (runningSince ? Date.now() - runningSince : 0)
    const durationSeconds = Math.max(0, Math.floor(finalMs / 1000))
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
      <div className="min-h-svh bg-background">
        <AppHeader />
        <div className="mx-auto max-w-4xl p-4 sm:p-6">
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
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-svh bg-background">
        <AppHeader />
        <div className="mx-auto max-w-4xl p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (summary) {
    return (
      <div className="min-h-svh bg-background">
        <AppHeader />
        <div className="mx-auto max-w-4xl p-4 sm:p-6">
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
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <Card>
        <CardHeader className="items-center">
          <div className="flex items-center justify-center gap-6">
            <div className="relative flex items-center justify-center">
              <RadialProgress value={allSets.length ? completedCount / allSets.length : 0} />
              <span className="absolute text-sm font-semibold tabular-nums">
                {completedCount}/{allSets.length}
              </span>
            </div>
            <CardTitle
              className={cn(
                'font-heading flex items-center gap-3 text-5xl tabular-nums transition-opacity sm:text-6xl',
                isPaused && 'opacity-40'
              )}
            >
              <Clock className="size-8 text-muted-foreground sm:size-10" />
              {formatDuration(displaySeconds)}
            </CardTitle>
          </div>
          <CardDescription>
            {completedCount} / {allSets.length} sets completed
            {isPaused && <span className="ml-2 text-accent">· paused</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePauseResume}>
            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>

          <AlertDialog.Root>
            <AlertDialog.Trigger className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <RotateCcw className="size-4" />
              Reset
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
              <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg">
                <AlertDialog.Title className="font-heading text-lg">Reset this workout?</AlertDialog.Title>
                <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
                  All progress will be cleared.
                </AlertDialog.Description>
                <div className="mt-4 flex justify-end gap-2">
                  <AlertDialog.Close className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    Cancel
                  </AlertDialog.Close>
                  <AlertDialog.Close
                    className={buttonVariants({ variant: 'destructive', size: 'sm' })}
                    onClick={handleResetWorkout}
                    disabled={resetting}
                  >
                    Reset
                  </AlertDialog.Close>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </CardContent>
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
                  <motion.button
                    key={set.id}
                    type="button"
                    disabled={isCompleted}
                    onClick={() => completeSet(se.id, set.id)}
                    whileTap={!isCompleted ? { scale: 0.94 } : undefined}
                    className={cn(
                      'flex min-h-18 min-w-28 flex-col items-center justify-center gap-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors',
                      isCompleted
                        ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30'
                        : 'border-border bg-muted/40 text-foreground hover:border-ring hover:bg-muted'
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <AnimatePresence>
                        {isCompleted && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          >
                            <Check className="size-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      Set {set.set_number}
                    </span>
                    <span className={isCompleted ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                      {target}
                    </span>
                  </motion.button>
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
    </div>
  )
}
