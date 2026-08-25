import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RadialProgress } from '@/components/RadialProgress'
import { cn } from '@/lib/utils'

type Profile = {
  age: number | null
  gender: string | null
  weight_kg: number | null
  height_cm: number | null
}

type Targets = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

const ACTIVITY_MULTIPLIER = 1.55 // moderate activity

// Mifflin-St Jeor. Gender offset: Male +5, Female -161, else the midpoint of the two.
function computeTargets(profile: Profile): Targets | null {
  const { age, gender, weight_kg, height_cm } = profile
  if (!age || !weight_kg || !height_cm) return null

  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age
  const offset = gender === 'Male' ? 5 : gender === 'Female' ? -161 : -78
  const bmr = base + offset
  const calories = bmr * ACTIVITY_MULTIPLIER

  return {
    calories,
    protein_g: (calories * 0.3) / 4,
    carbs_g: (calories * 0.4) / 4,
    fat_g: (calories * 0.3) / 9,
  }
}

function startOfDay(d: Date) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function NutritionTargets({ refreshKey }: { refreshKey?: number } = {}) {
  const [loading, setLoading] = useState(true)
  const [targets, setTargets] = useState<Targets | null>(null)
  const [totals, setTotals] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

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

    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [{ data: profile }, { data: meals }] = await Promise.all([
      supabase.from('profiles').select('age, gender, weight_kg, height_cm').eq('id', user.id).single(),
      supabase
        .from('meals')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', user.id)
        .gte('logged_at', today.toISOString())
        .lt('logged_at', tomorrow.toISOString()),
    ])

    if (profile) setTargets(computeTargets(profile))

    const summed = (meals ?? []).reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein_g: acc.protein_g + (m.protein_g ?? 0),
        carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
        fat_g: acc.fat_g + (m.fat_g ?? 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    )
    setTotals(summed)
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrition Summary</CardTitle>
        <CardDescription>Estimated Target — not a precise number</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !targets ? (
          <p className="text-sm text-muted-foreground">
            Add your age, gender, weight, and height on{' '}
            <Link to="/profile" className="text-accent underline underline-offset-2">
              your profile
            </Link>{' '}
            to see an estimated daily target.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div className="relative flex shrink-0 items-center justify-center">
              <RadialProgress value={targets.calories > 0 ? totals.calories / targets.calories : 0} size={120} strokeWidth={10} />
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-semibold tabular-nums">{Math.round(totals.calories)}</span>
                <span className="text-xs text-muted-foreground">/ {Math.round(targets.calories)} kcal</span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3">
              <MacroBar label="Protein" value={totals.protein_g} target={targets.protein_g} color="#22C55E" />
              <MacroBar label="Carbs" value={totals.carbs_g} target={targets.carbs_g} color="#F59E0B" />
              <MacroBar label="Fats" value={totals.fat_g} target={targets.fat_g} color="#EF4444" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {Math.round(value)}g / {Math.round(target)}g · {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all')}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
