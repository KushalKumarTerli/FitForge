import { useEffect, useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toDateStr, startOfWeekMonday } from '@/lib/date'

type Plan = { id: string; name: string }

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// display index 0=Mon..6=Sun -> JS Date#getDay() value (0=Sun..6=Sat)
function displayIndexToDow(i: number) {
  return (i + 1) % 7
}

export function WeeklySchedule() {
  const [userId, setUserId] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [scheduleByDow, setScheduleByDow] = useState<Record<number, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [savingDow, setSavingDow] = useState<number | null>(null)

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

    const [{ data: planData }, { data: scheduleData }] = await Promise.all([
      supabase
        .from('workout_plans')
        .select('id, name')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('sequence_order', { nullsFirst: false }),
      supabase.from('weekly_schedule').select('day_of_week, plan_id').eq('user_id', user.id),
    ])

    setPlans(planData ?? [])
    const map: Record<number, string | null> = {}
    for (const row of scheduleData ?? []) map[row.day_of_week] = row.plan_id
    setScheduleByDow(map)
    setLoading(false)
  }

  async function assignPlan(dow: number, planId: string | null) {
    if (!userId) return
    setSavingDow(dow)
    const { error } = await supabase
      .from('weekly_schedule')
      .upsert({ user_id: userId, day_of_week: dow, plan_id: planId }, { onConflict: 'user_id,day_of_week' })
    if (!error) {
      setScheduleByDow((prev) => ({ ...prev, [dow]: planId }))
    }
    setSavingDow(null)
  }

  const monday = startOfWeekMonday(new Date())
  const todayStr = toDateStr(new Date())

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Week</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {DAY_LABELS.map((label, i) => {
              const date = new Date(monday)
              date.setDate(date.getDate() + i)
              const dow = displayIndexToDow(i)
              const dateStr = toDateStr(date)
              const isToday = dateStr === todayStr
              const planId = scheduleByDow[dow] ?? null
              const planName = planId ? (plans.find((p) => p.id === planId)?.name ?? '…') : 'Rest'

              return (
                <Menu.Root key={i}>
                  <Menu.Trigger
                    className={cn(
                      'flex w-full flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                      isToday ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                    )}
                  >
                    <span className="text-[0.65rem] font-medium text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold">{date.getDate()}</span>
                    <span
                      className={cn(
                        'line-clamp-2 min-h-8 text-[0.65rem] leading-tight break-words',
                        planId ? 'text-accent' : 'text-muted-foreground'
                      )}
                    >
                      {savingDow === dow ? '…' : planName}
                    </span>
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner sideOffset={6} className="z-50">
                      <Menu.Popup className="max-h-[240px] min-w-36 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                        <Menu.Item
                          onClick={() => assignPlan(dow, null)}
                          className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                        >
                          Rest
                        </Menu.Item>
                        {plans.map((plan) => (
                          <Menu.Item
                            key={plan.id}
                            onClick={() => assignPlan(dow, plan.id)}
                            className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                          >
                            {plan.name}
                          </Menu.Item>
                        ))}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
