import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Apple, Dumbbell, LogOut, MessageCircle, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { NavAvatar } from '@/components/NavAvatar'

type Meal = {
  id: string
  users_raw_text: string
  logged_at: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  parse_status: 'pending' | 'success' | 'failed'
}

const PARSE_TIMEOUT_MS = 60000

export default function Nutrition() {
  const navigate = useNavigate()
  const [rawText, setRawText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loadingMeals, setLoadingMeals] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    loadTodaysMeals()
    loadAvatar()
  }, [])

  async function loadAvatar() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
    setAvatarUrl(data?.avatar_url ?? null)
  }

  async function loadTodaysMeals() {
    setLoadingMeals(true)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const { data } = await supabase
      .from('meals')
      .select('id, users_raw_text, logged_at, calories, protein_g, carbs_g, fat_g, parse_status')
      .gte('logged_at', startOfDay.toISOString())
      .lt('logged_at', endOfDay.toISOString())
      .order('logged_at', { ascending: false })

    setMeals(data ?? [])
    setLoadingMeals(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!rawText.trim()) return

    setSubmitting(true)
    setInfo(null)

    let macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null = null

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS)

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/meals/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: rawText }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        if (
          typeof data.calories === 'number' &&
          typeof data.protein_g === 'number' &&
          typeof data.carbs_g === 'number' &&
          typeof data.fat_g === 'number'
        ) {
          macros = data
        }
      }
    } catch {
      // network error, timeout, or abort — fall through and log without macros
    }

    const parseStatus = macros ? 'success' : 'failed'

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    const { data: inserted, error: insertError } = await supabase
      .from('meals')
      .insert({
        user_id: user.id,
        users_raw_text: rawText,
        calories: macros?.calories ?? null,
        protein_g: macros?.protein_g ?? null,
        carbs_g: macros?.carbs_g ?? null,
        fat_g: macros?.fat_g ?? null,
        parse_status: parseStatus,
      })
      .select()
      .single()

    if (insertError) {
      setInfo(`Could not save meal: ${insertError.message}`)
      setSubmitting(false)
      return
    }

    setMeals((prev) => [inserted, ...prev])
    setRawText('')
    setInfo(
      parseStatus === 'failed'
        ? 'Meal logged, but the nutrition estimate failed — no macros for this one.'
        : 'Meal logged.'
    )
    setSubmitting(false)
  }

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  return (
    <div className="min-h-svh bg-background">
      <nav className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 font-heading text-lg">
          <Apple className="size-5" />
          Nutrition
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <Dumbbell className="size-4" />
            Dashboard
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/health')}>
            <MessageCircle className="size-4" />
            Health
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/profile')} aria-label="Settings">
            <Settings className="size-4" />
          </Button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Profile"
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <NavAvatar avatarUrl={avatarUrl} />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut()
              navigate('/login')
            }}
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </nav>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Log a meal</CardTitle>
            <CardDescription>Describe what you ate, in your own words.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Textarea
                placeholder="e.g. grilled chicken breast with a cup of rice and broccoli"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                disabled={submitting}
                required
              />
              {info && <p className="text-sm text-muted-foreground">{info}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Logging…' : 'Log meal'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>
              {totals.calories.toFixed(0)} cal · {totals.protein_g.toFixed(0)}g protein ·{' '}
              {totals.carbs_g.toFixed(0)}g carbs · {totals.fat_g.toFixed(0)}g fat
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMeals ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : meals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meals logged today.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {meals.map((meal) => (
                  <li key={meal.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">{meal.users_raw_text}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs',
                          meal.parse_status === 'success' && 'bg-secondary text-secondary-foreground',
                          meal.parse_status === 'failed' && 'bg-destructive/10 text-destructive'
                        )}
                      >
                        {meal.parse_status === 'success' ? 'parsed' : 'not parsed'}
                      </span>
                    </div>
                    {meal.parse_status === 'success' ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {meal.calories} cal · {meal.protein_g}g protein · {meal.carbs_g}g carbs ·{' '}
                        {meal.fat_g}g fat
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Macros unavailable</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
