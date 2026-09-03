import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'

const HEALTH_TIPS = [
  'Consistency beats intensity — a moderate workout done regularly outperforms an occasional extreme one.',
  'Sleep is when muscle repair actually happens — aim for 7-9 hours, especially after strength training.',
  "A proper warm-up targeting the muscles you're about to train lowers injury risk more than general stretching.",
  'Progressive overload — small, gradual increases in weight or reps — is what drives long-term strength gains.',
  "Rest days aren't wasted days; they're when adaptation actually happens.",
  'Staying hydrated improves your energy, focus, and workout performance.',
  'Stress raises cortisol, which can interfere with recovery — a short walk or breathing break helps more than it seems.',
  'Tracking your workouts, even loosely, makes it much easier to spot real progress over time.',
]

export function HealthTip() {
  const [tip] = useState(() => HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)])

  return (
    <Card>
      <CardContent className="flex items-center gap-2">
        <span className="text-lg">💡</span>
        <p className="text-sm text-muted-foreground">{tip}</p>
      </CardContent>
    </Card>
  )
}
