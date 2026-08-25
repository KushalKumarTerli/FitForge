import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type DayBucket = {
  label: string
  calories: number
}

function startOfDay(d: Date) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function NutritionTrend() {
  const [data, setData] = useState<DayBucket[]>([])
  const [loading, setLoading] = useState(true)

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

    const today = startOfDay(new Date())
    const sixDaysAgo = new Date(today)
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: meals } = await supabase
      .from('meals')
      .select('logged_at, calories')
      .eq('user_id', user.id)
      .gte('logged_at', sixDaysAgo.toISOString())
      .lt('logged_at', tomorrow.toISOString())

    const buckets: DayBucket[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(sixDaysAgo)
      day.setDate(day.getDate() + i)
      const nextDay = new Date(day)
      nextDay.setDate(nextDay.getDate() + 1)

      const dayCalories = (meals ?? [])
        .filter((m) => {
          const loggedAt = new Date(m.logged_at)
          return loggedAt >= day && loggedAt < nextDay
        })
        .reduce((sum, m) => sum + (m.calories ?? 0), 0)

      buckets.push({
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        calories: Math.round(dayCalories),
      })
    }

    setData(buckets)
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>7-day calorie trend</CardTitle>
        <CardDescription>Logged meal calories, last 7 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: '#1F2937' }}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#F3F4F6',
                  }}
                  formatter={(value) => [`${value} cal`, 'Calories']}
                />
                <Bar dataKey="calories" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
