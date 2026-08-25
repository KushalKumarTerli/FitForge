import { useEffect, useState, type FormEvent } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import { Droplet, StickyNote, Utensils, Weight as WeightIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getTodayBounds } from '@/lib/date'
import { VoiceInputButton } from '@/components/VoiceInputButton'

type Meal = {
  id: string
  users_raw_text: string
  logged_at: string
  calories: number | null
  parse_status: 'pending' | 'success' | 'failed'
}
type WaterLog = { id: string; amount_ml: number; logged_at: string }
type WeightLog = { id: string; weight_kg: number; logged_at: string }
type Note = { id: string; content: string; logged_at: string }

const PARSE_TIMEOUT_MS = 60000

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function QuickLog({ onMealLogged }: { onMealLogged?: () => void } = {}) {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [meals, setMeals] = useState<Meal[]>([])
  const [mealText, setMealText] = useState('')
  const [mealSubmitting, setMealSubmitting] = useState(false)
  const [mealInfo, setMealInfo] = useState<string | null>(null)

  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([])
  const [waterInput, setWaterInput] = useState('')
  const [waterSubmitting, setWaterSubmitting] = useState(false)

  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [weightInput, setWeightInput] = useState('')
  const [weightSubmitting, setWeightSubmitting] = useState(false)

  const [notes, setNotes] = useState<Note[]>([])
  const [noteInput, setNoteInput] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)

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
    setUserId(user.id)

    const { start: startIso, end: endIso } = getTodayBounds()

    const [{ data: mealData }, { data: waterData }, { data: weightData }, { data: noteData }] = await Promise.all([
      supabase
        .from('meals')
        .select('id, users_raw_text, logged_at, calories, parse_status')
        .eq('user_id', user.id)
        .gte('logged_at', startIso)
        .lt('logged_at', endIso)
        .order('logged_at', { ascending: false }),
      supabase
        .from('water_logs')
        .select('id, amount_ml, logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', startIso)
        .lt('logged_at', endIso)
        .order('logged_at', { ascending: false }),
      supabase
        .from('weight_logs')
        .select('id, weight_kg, logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', startIso)
        .lt('logged_at', endIso)
        .order('logged_at', { ascending: false }),
      supabase
        .from('notes')
        .select('id, content, logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', startIso)
        .lt('logged_at', endIso)
        .order('logged_at', { ascending: false }),
    ])

    setMeals(mealData ?? [])
    setWaterLogs(waterData ?? [])
    setWeightLogs(weightData ?? [])
    setNotes(noteData ?? [])
    setLoading(false)
  }

  async function handleMealSubmit(e: FormEvent) {
    e.preventDefault()
    if (!mealText.trim() || !userId) return

    setMealSubmitting(true)
    setMealInfo(null)

    let macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null = null
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS)
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/meals/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: mealText }),
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
    const { data: inserted, error } = await supabase
      .from('meals')
      .insert({
        user_id: userId,
        users_raw_text: mealText,
        calories: macros?.calories ?? null,
        protein_g: macros?.protein_g ?? null,
        carbs_g: macros?.carbs_g ?? null,
        fat_g: macros?.fat_g ?? null,
        parse_status: parseStatus,
      })
      .select()
      .single()

    if (error) {
      setMealInfo(`Could not save meal: ${error.message}`)
      setMealSubmitting(false)
      return
    }

    setMeals((prev) => [inserted, ...prev])
    setMealText('')
    setMealInfo(
      parseStatus === 'failed' ? 'Meal logged, but the nutrition estimate failed.' : 'Meal logged.'
    )
    setMealSubmitting(false)
    onMealLogged?.()
  }

  async function handleWaterSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(waterInput)
    if (!amount || amount <= 0 || !userId) return

    setWaterSubmitting(true)
    const { data: inserted, error } = await supabase
      .from('water_logs')
      .insert({ user_id: userId, amount_ml: amount })
      .select()
      .single()

    if (!error && inserted) {
      setWaterLogs((prev) => [inserted, ...prev])
      setWaterInput('')
    }
    setWaterSubmitting(false)
  }

  async function handleWeightSubmit(e: FormEvent) {
    e.preventDefault()
    const kg = Number(weightInput)
    if (!kg || kg <= 0 || !userId) return

    setWeightSubmitting(true)
    const { data: inserted, error } = await supabase
      .from('weight_logs')
      .insert({ user_id: userId, weight_kg: kg })
      .select()
      .single()

    if (!error && inserted) {
      await supabase.from('profiles').update({ weight_kg: kg }).eq('id', userId)
      setWeightLogs((prev) => [inserted, ...prev])
      setWeightInput('')
    }
    setWeightSubmitting(false)
  }

  async function handleNoteSubmit(e: FormEvent) {
    e.preventDefault()
    if (!noteInput.trim() || !userId) return

    setNoteSubmitting(true)
    const { data: inserted, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, content: noteInput.trim() })
      .select()
      .single()

    if (!error && inserted) {
      setNotes((prev) => [inserted, ...prev])
      setNoteInput('')
    }
    setNoteSubmitting(false)
  }

  const waterTotal = waterLogs.reduce((sum, w) => sum + w.amount_ml, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Log</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Tabs.Root defaultValue="meal">
            <Tabs.List className="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-muted/40 p-1">
              <QuickLogTab value="meal" icon={<Utensils className="size-4" />} label="Meal" />
              <QuickLogTab value="water" icon={<Droplet className="size-4" />} label="Water" />
              <QuickLogTab value="weight" icon={<WeightIcon className="size-4" />} label="Weight" />
              <QuickLogTab value="note" icon={<StickyNote className="size-4" />} label="Note" />
            </Tabs.List>

            <Tabs.Panel value="meal" className="flex flex-col gap-3">
              <form onSubmit={handleMealSubmit} className="flex flex-col gap-2">
                <div className="relative">
                  <Textarea
                    placeholder="Describe your meal…"
                    value={mealText}
                    onChange={(e) => setMealText(e.target.value)}
                    disabled={mealSubmitting}
                    className="min-h-12 pr-10"
                  />
                  <div className="absolute top-1.5 right-1.5">
                    <VoiceInputButton onResult={(text) => setMealText(text)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">AI will estimate calories & macros</p>
                {mealInfo && <p className="text-xs text-muted-foreground">{mealInfo}</p>}
                <Button type="submit" size="sm" disabled={mealSubmitting || !mealText.trim()}>
                  {mealSubmitting ? 'Logging…' : 'Add'}
                </Button>
              </form>
              <EntryList
                empty="No meals logged today."
                items={meals.map((m) => ({
                  id: m.id,
                  primary: m.users_raw_text,
                  secondary:
                    m.parse_status === 'success' && m.calories != null
                      ? `${Math.round(m.calories)} kcal · ${formatTime(m.logged_at)}`
                      : `not parsed · ${formatTime(m.logged_at)}`,
                }))}
              />
            </Tabs.Panel>

            <Tabs.Panel value="water" className="flex flex-col gap-3">
              <form onSubmit={handleWaterSubmit} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">Amount (ml)</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="250"
                    value={waterInput}
                    onChange={(e) => setWaterInput(e.target.value)}
                    disabled={waterSubmitting}
                  />
                </div>
                <Button type="submit" size="sm" disabled={waterSubmitting || !waterInput}>
                  Add
                </Button>
              </form>
              <p className="text-sm text-muted-foreground">
                Today's total: <span className="font-medium text-foreground">{waterTotal} ml</span>
              </p>
              <EntryList
                empty="No water logged today."
                items={waterLogs.map((w) => ({
                  id: w.id,
                  primary: `${w.amount_ml} ml`,
                  secondary: formatTime(w.logged_at),
                }))}
              />
            </Tabs.Panel>

            <Tabs.Panel value="weight" className="flex flex-col gap-3">
              <form onSubmit={handleWeightSubmit} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">Weight (kg)</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="70.0"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    disabled={weightSubmitting}
                  />
                </div>
                <Button type="submit" size="sm" disabled={weightSubmitting || !weightInput}>
                  Log
                </Button>
              </form>
              <EntryList
                empty="No weight logged today."
                items={weightLogs.map((w) => ({
                  id: w.id,
                  primary: `${w.weight_kg} kg`,
                  secondary: formatTime(w.logged_at),
                }))}
              />
            </Tabs.Panel>

            <Tabs.Panel value="note" className="flex flex-col gap-3">
              <form onSubmit={handleNoteSubmit} className="flex flex-col gap-2">
                <Textarea
                  placeholder="Jot something down…"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  disabled={noteSubmitting}
                  className="min-h-12"
                />
                <Button type="submit" size="sm" disabled={noteSubmitting || !noteInput.trim()}>
                  Save
                </Button>
              </form>
              <EntryList
                empty="No notes today."
                items={notes.map((n) => ({
                  id: n.id,
                  primary: n.content,
                  secondary: formatTime(n.logged_at),
                }))}
              />
            </Tabs.Panel>
          </Tabs.Root>
        )}
      </CardContent>
    </Card>
  )
}

function QuickLogTab({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <Tabs.Tab
      value={value}
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors',
        'data-[active]:bg-card data-[active]:text-foreground data-[active]:shadow-sm'
      )}
    >
      {icon}
      {label}
    </Tabs.Tab>
  )
}

function EntryList({ items, empty }: { items: { id: string; primary: string; secondary: string }[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
          <span className="truncate">{item.primary}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{item.secondary}</span>
        </li>
      ))}
    </ul>
  )
}
