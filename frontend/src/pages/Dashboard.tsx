import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Apple, Dumbbell, LogOut, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { WorkoutCalendar } from '@/components/WorkoutCalendar'

type Profile = {
  full_name: string
  weight_kg: number
  height_cm: number
}

type WorkoutPlan = {
  id: string
  name: string
  type: string
  sequence_order: number
}

type Exercise = {
  id: string
  name: string
  muscle_group: string
  met_value: number
  tracking_type: 'reps' | 'duration'
}

type PlanExercise = {
  plan_id: string
  exercise_id: string
  sets: number
  target_reps: number[] | null
  target_duration_seconds: number[] | null
  exercise_order: number
  exercises: Exercise
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [planExercises, setPlanExercises] = useState<PlanExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profileData }, { data: planData }] = await Promise.all([
        supabase.from('profiles').select('full_name, weight_kg, height_cm').eq('id', user.id).single(),
        supabase
          .from('workout_plans')
          .select('id, name, type, sequence_order')
          .is('user_id', null)
          .order('sequence_order'),
      ])

      setProfile(profileData)
      setPlans(planData ?? [])
      if (planData && planData.length > 0) {
        setSelectedPlanId(planData[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedPlanId) {
      setPlanExercises([])
      return
    }
    async function loadExercises() {
      const { data } = await supabase
        .from('plan_exercises')
        .select(
          'plan_id, exercise_id, sets, target_reps, target_duration_seconds, exercise_order, exercises(id, name, muscle_group, met_value, tracking_type)'
        )
        .eq('plan_id', selectedPlanId)
        .order('exercise_order')
      setPlanExercises((data as unknown as PlanExercise[]) ?? [])
    }
    loadExercises()
  }, [selectedPlanId])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleStartWorkout() {
    setError(null)
    setStarting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setStarting(false)
      return
    }

    const today = new Date().toISOString().slice(0, 10)

    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        plan_id: selectedPlanId,
        date: today,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (sessionError || !session) {
      setError(sessionError?.message ?? 'Failed to start workout')
      setStarting(false)
      return
    }

    const { data: sessionExercises, error: seError } = await supabase
      .from('session_exercises')
      .insert(
        planExercises.map((pe) => ({
          session_id: session.id,
          exercise_id: pe.exercise_id,
          sets: pe.sets,
        }))
      )
      .select()

    if (seError || !sessionExercises) {
      setError(seError?.message ?? 'Failed to set up session exercises')
      setStarting(false)
      return
    }

    const sessionExerciseIdByExercise = new Map(
      sessionExercises.map((se) => [se.exercise_id, se.id])
    )

    const setsRows = planExercises.flatMap((pe) => {
      const sessionExerciseId = sessionExerciseIdByExercise.get(pe.exercise_id)
      return Array.from({ length: pe.sets }, (_, i) => ({
        session_exercise_id: sessionExerciseId,
        set_number: i + 1,
        target_reps: pe.exercises.tracking_type === 'reps' ? (pe.target_reps?.[i] ?? null) : null,
        target_duration_seconds:
          pe.exercises.tracking_type === 'duration' ? (pe.target_duration_seconds?.[i] ?? null) : null,
        status: 'pending',
      }))
    })

    const { error: setsError } = await supabase.from('session_sets').insert(setsRows)

    if (setsError) {
      setError(setsError.message)
      setStarting(false)
      return
    }

    setStarting(false)
    navigate('/workout', { state: { sessionId: session.id } })
  }

  return (
    <div className="min-h-svh bg-background">
      <nav className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 font-heading text-lg">
          <Dumbbell className="size-5" />
          Dashboard
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/nutrition')}>
            <Apple className="size-4" />
            Nutrition
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/health')}>
            <MessageCircle className="size-4" />
            Health
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </nav>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <WorkoutCalendar />

            <Card>
              <CardHeader>
                <CardTitle>
                  {profile ? `Welcome back, ${profile.full_name}` : 'Welcome'}
                </CardTitle>
                <CardDescription>Pick a plan and start today's workout.</CardDescription>
              </CardHeader>
              <CardContent>
                {plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No workout plans available.</p>
                ) : (
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                )}
              </CardContent>
            </Card>

            {planExercises.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Exercises</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {planExercises.map((pe) => (
                      <li
                        key={pe.exercise_id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{pe.exercises.name}</p>
                          <p className="text-sm text-muted-foreground">{pe.exercises.muscle_group}</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{pe.sets} sets</p>
                          <p>
                            {pe.exercises.tracking_type === 'reps'
                              ? `${pe.target_reps?.join(', ')} reps`
                              : `${pe.target_duration_seconds?.join(', ')} sec`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

                  <Button
                    className="mt-4 w-full"
                    disabled={starting}
                    onClick={handleStartWorkout}
                  >
                    {starting ? 'Starting…' : 'Start Workout'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
