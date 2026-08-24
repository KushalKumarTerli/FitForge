import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  tracking_type: 'reps' | 'duration'
}

type DraftExercise = {
  key: string
  exercise_id: string
  name: string
  muscle_group: string
  tracking_type: 'reps' | 'duration'
  sets: number
  target: number
}

export default function PlanBuilder() {
  const navigate = useNavigate()
  const [planName, setPlanName] = useState('')
  const [planType, setPlanType] = useState('')
  const [exerciseCatalog, setExerciseCatalog] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('exercises')
      .select('id, name, muscle_group, tracking_type')
      .order('name')
      .then(({ data }) => setExerciseCatalog(data ?? []))
  }, [])

  const filteredExercises = search.trim()
    ? exerciseCatalog.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    : []

  function addExercise(ex: Exercise) {
    setDraftExercises((prev) => [
      ...prev,
      {
        key: `${ex.id}-${Date.now()}`,
        exercise_id: ex.id,
        name: ex.name,
        muscle_group: ex.muscle_group,
        tracking_type: ex.tracking_type,
        sets: 3,
        target: ex.tracking_type === 'reps' ? 10 : 30,
      },
    ])
    setSearch('')
  }

  function updateDraft(key: string, patch: Partial<DraftExercise>) {
    setDraftExercises((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  function removeDraft(key: string) {
    setDraftExercises((prev) => prev.filter((d) => d.key !== key))
  }

  function moveDraft(key: string, direction: -1 | 1) {
    setDraftExercises((prev) => {
      const idx = prev.findIndex((d) => d.key === key)
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
      return copy
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!planName.trim() || draftExercises.length === 0) return

    setSubmitting(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    const { data: plan, error: planError } = await supabase
      .from('workout_plans')
      .insert({ user_id: user.id, name: planName.trim(), type: planType.trim() || 'custom' })
      .select()
      .single()

    if (planError || !plan) {
      setError(planError?.message ?? 'Failed to create plan')
      setSubmitting(false)
      return
    }

    const rows = draftExercises.map((de, i) => ({
      plan_id: plan.id,
      exercise_id: de.exercise_id,
      sets: de.sets,
      exercise_order: i + 1,
      target_reps: de.tracking_type === 'reps' ? Array(de.sets).fill(de.target) : [],
      target_duration_seconds: de.tracking_type === 'duration' ? Array(de.sets).fill(de.target) : null,
    }))

    const { error: peError } = await supabase.from('plan_exercises').insert(rows)

    if (peError) {
      setError(peError.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    navigate('/')
  }

  return (
    <div className="min-h-svh bg-background">
      <nav className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <span className="font-heading text-lg">Create Plan</span>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          Cancel
        </Button>
      </nav>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan_name">Plan name</Label>
                <Input
                  id="plan_name"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g. Upper Body Blast"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan_type">Type</Label>
                <Input
                  id="plan_type"
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value)}
                  placeholder="e.g. push, pull, legs, custom"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add exercises</CardTitle>
              <CardDescription>Search the catalog and click one to add it.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="relative">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search exercises…"
                />
                {filteredExercises.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                    {filteredExercises.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => addExercise(ex)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span>{ex.name}</span>
                        <span className="text-muted-foreground">{ex.muscle_group}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {draftExercises.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exercises added yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {draftExercises.map((de, i) => (
                    <li
                      key={de.key}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <span className="w-6 text-sm text-muted-foreground">{i + 1}.</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{de.name}</span>
                        <span className="text-xs text-muted-foreground">{de.muscle_group}</span>
                      </div>

                      <div className="ml-auto flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label htmlFor={`sets-${de.key}`} className="text-xs text-muted-foreground">
                            Sets
                          </Label>
                          <Input
                            id={`sets-${de.key}`}
                            type="number"
                            min={1}
                            value={de.sets}
                            onChange={(e) =>
                              updateDraft(de.key, { sets: Math.max(1, Number(e.target.value)) })
                            }
                            className="w-16"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label htmlFor={`target-${de.key}`} className="text-xs text-muted-foreground">
                            {de.tracking_type === 'reps' ? 'Reps' : 'Sec'}
                          </Label>
                          <Input
                            id={`target-${de.key}`}
                            type="number"
                            min={1}
                            value={de.target}
                            onChange={(e) =>
                              updateDraft(de.key, { target: Math.max(1, Number(e.target.value)) })
                            }
                            className="w-16"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={i === 0}
                          onClick={() => moveDraft(de.key, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={i === draftExercises.length - 1}
                          onClick={() => moveDraft(de.key, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeDraft(de.key)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting || !planName.trim() || draftExercises.length === 0}>
            {submitting ? 'Creating…' : 'Create Plan'}
          </Button>
        </form>
      </div>
    </div>
  )
}
