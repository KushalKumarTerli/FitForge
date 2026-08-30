import { CheckCircle2, ChevronRight, Circle, Dumbbell, Hash, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadialProgress } from '@/components/RadialProgress'
import { cn } from '@/lib/utils'

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

type WorkoutPlan = {
  id: string
  name: string
  type: string
  sequence_order: number | null
}

type TodaysWorkoutProps = {
  plans: WorkoutPlan[]
  selectedPlanId: string
  onSelectPlan: (id: string) => void
  planExercises: PlanExercise[]
  isRestDay: boolean
  nextUpPlan: WorkoutPlan | null | undefined
  hasWorkoutToday: boolean
  hasCustomPlans: boolean
  error: string | null
  starting: boolean
  inProgressSessionId: string | null
  todayProgress: { completed: number; total: number }
  completedExerciseIds: Set<string>
  onStart: () => void
  onContinue: () => void
  onCreatePlan: () => void
}

// "N Sets x R Reps" when every set in the exercise targets the same value (real, derived —
// not shown when sets differ, e.g. a pyramid scheme, since that would hide real data).
function formatSetsTargets(pe: PlanExercise) {
  const isReps = pe.exercises.tracking_type === 'reps'
  const targets = isReps ? pe.target_reps : pe.target_duration_seconds
  const unit = isReps ? 'Reps' : 'Sec'
  if (targets && targets.length > 0 && targets.every((t) => t === targets[0])) {
    return `${pe.sets} Sets × ${targets[0]} ${unit}`
  }
  return `${pe.sets} sets · ${(targets ?? []).join(', ')} ${unit.toLowerCase()}`
}

export function TodaysWorkout({
  plans,
  selectedPlanId,
  onSelectPlan,
  planExercises,
  isRestDay,
  nextUpPlan,
  hasWorkoutToday,
  hasCustomPlans,
  error,
  starting,
  inProgressSessionId,
  todayProgress,
  completedExerciseIds,
  onStart,
  onContinue,
  onCreatePlan,
}: TodaysWorkoutProps) {
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)
  const muscleGroups = [...new Set(planExercises.map((pe) => pe.exercises.muscle_group))]
  const totalSets = planExercises.reduce((sum, pe) => sum + pe.sets, 0)
  const progressPct = todayProgress.total > 0 ? todayProgress.completed / todayProgress.total : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Today's Workout</CardTitle>
          <div className="flex items-center gap-1.5">
            {plans.length > 0 && (
              <select
                value={selectedPlanId}
                disabled={!!inProgressSessionId}
                onChange={(e) => onSelectPlan(e.target.value)}
                className="h-7 max-w-32 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id} className="bg-card text-foreground">
                    {plan.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0"
              onClick={onCreatePlan}
              aria-label="Create plan"
              title="Create plan"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isRestDay && (
          <p className="text-sm text-accent">Rest day — start a workout anyway if you want.</p>
        )}

        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workout plans available.</p>
        ) : selectedPlan ? (
          <div className="flex items-center gap-4">
            <div className="relative flex shrink-0 items-center justify-center">
              <RadialProgress value={progressPct} size={72} strokeWidth={7} />
              <span className="absolute text-sm font-semibold tabular-nums">{Math.round(progressPct * 100)}%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">{selectedPlan.name}</p>
              {muscleGroups.length > 0 && (
                <p className="text-sm text-muted-foreground">{muscleGroups.join(' • ')}</p>
              )}
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Dumbbell className="size-3" />
                  {planExercises.length} Exercises
                </span>
                {totalSets > 0 && (
                  <span className="flex items-center gap-1">
                    <Hash className="size-3" />
                    {totalSets} Sets
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {nextUpPlan && <p className="text-sm text-muted-foreground">Next up: {nextUpPlan.name}</p>}
        {!hasWorkoutToday && (
          <p className="text-sm text-muted-foreground">
            Nothing logged yet today — your streak is waiting.
          </p>
        )}
        {!hasCustomPlans && (
          <p className="text-sm text-muted-foreground">
            Build a plan that's actually yours.{' '}
            <button type="button" onClick={onCreatePlan} className="text-accent underline underline-offset-2">
              Start here
            </button>
          </p>
        )}

        {planExercises.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <ul className="flex flex-col gap-2">
              {planExercises.map((pe) => {
                const isDone = completedExerciseIds.has(pe.exercise_id)
                return (
                  <li
                    key={pe.exercise_id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    {isDone ? (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-medium', isDone && 'text-muted-foreground line-through')}>
                        {pe.exercises.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{pe.exercises.muscle_group}</p>
                    </div>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {formatSetsTargets(pe)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
                  </li>
                )
              })}
            </ul>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full"
              disabled={starting}
              onClick={inProgressSessionId ? onContinue : onStart}
            >
              {starting ? 'Starting…' : inProgressSessionId ? 'Continue Workout' : 'Start Workout'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
