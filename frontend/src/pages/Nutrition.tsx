import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AppShell } from '@/components/AppShell'
import { NutritionTrend } from '@/components/NutritionTrend'
import { NutritionTargets } from '@/components/NutritionTargets'
import { QuickLog } from '@/components/QuickLog'

const NUTRITION_TIPS = [
  'Protein spread across meals is used more efficiently than one big dose.',
  'Fiber slows digestion and helps you feel full longer.',
  'Most people underestimate liquid calories — they still count.',
  'Whole foods generally keep you fuller than processed equivalents at the same calories.',
  'Consistent meal timing helps regulate hunger cues over time.',
]

export default function Nutrition() {
  const [tip] = useState(() => NUTRITION_TIPS[Math.floor(Math.random() * NUTRITION_TIPS.length)])
  const [nutritionRefreshKey, setNutritionRefreshKey] = useState(0)

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
        <Card>
          <CardContent className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <p className="text-sm text-muted-foreground">{tip}</p>
          </CardContent>
        </Card>

        <NutritionTrend />
        <NutritionTargets refreshKey={nutritionRefreshKey} />
        <QuickLog onMealLogged={() => setNutritionRefreshKey((k) => k + 1)} />
      </div>
    </AppShell>
  )
}
