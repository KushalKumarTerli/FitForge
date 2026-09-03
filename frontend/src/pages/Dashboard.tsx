import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { WorkoutCalendar } from '@/components/WorkoutCalendar'
import { DashboardStats } from '@/components/DashboardStats'
import { WeeklySchedule } from '@/components/WeeklySchedule'
import { NutritionTargets } from '@/components/NutritionTargets'
import { QuickLog } from '@/components/QuickLog'
import { DashboardHeader } from '@/components/DashboardHeader'
import { TodaysWorkout } from '@/components/TodaysWorkout'
import { AppShell } from '@/components/AppShell'
import { toDateStr } from '@/lib/date'

type Profile = {
  full_name: string
  weight_kg: number
  height_cm: number
  avatar_url: string | null
}

type WorkoutPlan = {
  id: string
  name: string
  type: string
  sequence_order: number | null
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

const MOTIVATIONAL_LINES = [
  'Discipline is choosing between what you want now and what you want most.',
  'Small reps. Big transformation.',
  "You don't have to be extreme, just consistent.",
  "The only bad workout is the one that didn't happen.",
  "Progress isn't loud. It's daily.",
]

function getGreeting(name: string) {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return `Good morning, ${name}. Let's build something today.`
  if (hour >= 12 && hour < 17) return `Good afternoon, ${name}. Halfway through — keep the momentum.`
  if (hour >= 17 && hour < 21) return `Good evening, ${name}. Finish strong.`
  return `Still here, ${name}? Respect the grind — or respect the rest.`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [planExercises, setPlanExercises] = useState<PlanExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false)
  const [isRestDay, setIsRestDay] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [motivationalLine] = useState(
    () => MOTIVATIONAL_LINES[Math.floor(Math.random() * MOTIVATIONAL_LINES.length)]
  )
  const [nutritionRefreshKey, setNutritionRefreshKey] = useState(0)
  const [streak, setStreak] = useState(0)
  // Today's set-completion, derived from whichever of today's sessions was started most
  // recently — feeds Today's Workout's progress ring and per-exercise checkmarks. Real data
  // from the same table already queried for hasWorkoutToday, not a second round-trip.
  const [todayProgress, setTodayProgress] = useState({ completed: 0, total: 0 })
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set())

  // The single shared source of truth for "what plan is assigned to which day of week" —
  // both the This Week strip and the plan dropdown below read and write this same state, so
  // a change in either place is reflected in the other immediately, no reload required.
  const [scheduleByDow, setScheduleByDow] = useState<Record<number, string | null>>({})
  const [inProgressSessionId, setInProgressSessionId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const todayDow = new Date().getDay()
      const todayStr = toDateStr(new Date())

      const [
        { data: profileData },
        { data: planData },
        { data: todaySessions },
        { data: scheduleRows },
        { data: inProgress },
      ] = await Promise.all([
        supabase.from('profiles').select('full_name, weight_kg, height_cm, avatar_url').eq('id', user.id).single(),
        supabase
          .from('workout_plans')
          .select('id, name, type, sequence_order')
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .order('sequence_order', { nullsFirst: false }),
        supabase
          .from('workout_sessions')
          .select('id, session_exercises(exercise_id, session_sets(status))')
          .eq('user_id', user.id)
          .eq('date', todayStr)
          .order('started_at', { ascending: false }),
        supabase.from('weekly_schedule').select('day_of_week, plan_id').eq('user_id', user.id),
        supabase
          .from('workout_sessions')
          .select('id, plan_id')
          .eq('user_id', user.id)
          .eq('date', todayStr)
          .is('completed_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      setProfile(profileData)
      setPlans(planData ?? [])
      setHasWorkoutToday((todaySessions?.length ?? 0) > 0)

      // Progress ring + per-exercise checkmarks on Today's Workout reflect whichever of
      // today's sessions was started most recently (same priority order as `inProgress` below).
      const latestToday = todaySessions?.[0] as
        | { session_exercises: { exercise_id: string; session_sets: { status: string }[] }[] }
        | undefined
      if (latestToday) {
        const sets = (latestToday.session_exercises ?? []).flatMap((se) => se.session_sets ?? [])
        setTodayProgress({ completed: sets.filter((s) => s.status === 'completed').length, total: sets.length })
        setCompletedExerciseIds(
          new Set(
            (latestToday.session_exercises ?? [])
              .filter((se) => (se.session_sets ?? []).length > 0 && se.session_sets.every((s) => s.status === 'completed'))
              .map((se) => se.exercise_id)
          )
        )
      } else {
        setTodayProgress({ completed: 0, total: 0 })
        setCompletedExerciseIds(new Set())
      }

      const scheduleMap: Record<number, string | null> = {}
      for (const row of scheduleRows ?? []) scheduleMap[row.day_of_week] = row.plan_id
      setScheduleByDow(scheduleMap)

      // Default plan selection, in priority order:
      // a) today's weekly_schedule row has a plan_id -> default to it
      // b) today's weekly_schedule row exists but plan_id is null -> rest day;
      //    fall back to the existing "first plan" default so Start Workout still works
      // c) no weekly_schedule row at all -> existing default, unchanged
      const rowExistsToday = todayDow in scheduleMap
      if (rowExistsToday && scheduleMap[todayDow]) {
        setIsRestDay(false)
        setSelectedPlanId(scheduleMap[todayDow]!)
      } else {
        setIsRestDay(rowExistsToday)
        if (planData && planData.length > 0) {
          setSelectedPlanId(planData[0].id)
        }
      }

      // An unfinished session for today takes priority over any of the above — continuing
      // resumes the exact plan that session was already started with.
      if (inProgress) {
        setInProgressSessionId(inProgress.id)
        if (inProgress.plan_id) {
          setIsRestDay(false)
          setSelectedPlanId(inProgress.plan_id)
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  async function assignPlan(dow: number, planId: string | null) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error: assignError } = await supabase
      .from('weekly_schedule')
      .upsert({ user_id: user.id, day_of_week: dow, plan_id: planId }, { onConflict: 'user_id,day_of_week' })
    if (assignError) return

    setScheduleByDow((prev) => ({ ...prev, [dow]: planId }))

    if (dow === new Date().getDay()) {
      if (planId) {
        setIsRestDay(false)
        setSelectedPlanId(planId)
      } else {
        setIsRestDay(true)
        setSelectedPlanId((prev) => prev || (plans[0]?.id ?? ''))
      }
    }
  }

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

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)
  const nextUpPlan =
    selectedPlan?.sequence_order != null
      ? plans.find((p) => p.sequence_order === (selectedPlan.sequence_order! % 4) + 1)
      : null
  const hasCustomPlans = plans.some((p) => p.sequence_order == null)

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

    const today = toDateStr(new Date())
    const startedAt = new Date().toISOString()

    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        plan_id: selectedPlanId,
        date: today,
        started_at: startedAt,
        accumulated_seconds: 0,
        last_resumed_at: startedAt,
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

  function handleContinueWorkout() {
    if (!inProgressSessionId) return
    navigate('/workout', { state: { sessionId: inProgressSessionId } })
  }

  // The mobile bottom-nav "+" button navigates here with this state when Quick Log isn't
  // already on screen (e.g. tapped from Health/Profile) — scroll to it once loaded, then clear
  // the state so it doesn't re-fire on a later back-navigation to this same history entry.
  // WorkoutCalendar/WeeklySchedule/NutritionTargets/QuickLog each fetch independently of this
  // page's own `loading` flag, so the page is still growing taller for a bit after that flips
  // false — re-issue the scroll a couple of times as that settles instead of firing once too
  // early and landing short.
  useEffect(() => {
    if (!loading && (location.state as { scrollToQuickLog?: boolean } | null)?.scrollToQuickLog) {
      const scroll = () => document.getElementById('quick-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      scroll()
      const t1 = setTimeout(scroll, 400)
      const t2 = setTimeout(scroll, 900)
      navigate(location.pathname, { replace: true, state: {} })
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <DashboardHeader
              date={new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              greeting={profile ? getGreeting(profile.full_name) : 'Welcome'}
              motivationalLine={motivationalLine}
              streak={streak}
              avatarUrl={profile?.avatar_url ?? null}
              fullName={profile?.full_name ?? ''}
            />

            <DashboardStats onStreakComputed={setStreak} />

            <WeeklySchedule plans={plans} scheduleByDow={scheduleByDow} onAssign={assignPlan} />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              <WorkoutCalendar />
              <TodaysWorkout
                plans={plans}
                selectedPlanId={selectedPlanId}
                onSelectPlan={(id) => {
                  setSelectedPlanId(id)
                  assignPlan(new Date().getDay(), id)
                }}
                planExercises={planExercises}
                isRestDay={isRestDay}
                nextUpPlan={nextUpPlan}
                hasWorkoutToday={hasWorkoutToday}
                hasCustomPlans={hasCustomPlans}
                error={error}
                starting={starting}
                inProgressSessionId={inProgressSessionId}
                todayProgress={todayProgress}
                completedExerciseIds={completedExerciseIds}
                onStart={handleStartWorkout}
                onContinue={handleContinueWorkout}
                onCreatePlan={() => navigate('/plans/new')}
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              <NutritionTargets refreshKey={nutritionRefreshKey} />
              <div id="quick-log">
                <QuickLog onMealLogged={() => setNutritionRefreshKey((k) => k + 1)} />
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
