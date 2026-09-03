import { useEffect, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Separate carousel mechanism from Nutrition's static single-tip card — that one stays
// exactly as it is, unchanged.
const HEALTH_TIPS = [
  'Consistency beats intensity — a moderate workout done regularly outperforms an occasional extreme one.',
  'Sleep is when muscle repair actually happens — aim for 7-9 hours, especially after strength training.',
  "A proper warm-up targeting the muscles you're about to train lowers injury risk more than general stretching.",
  'Progressive overload — small, gradual increases in weight or reps — is what drives long-term strength gains.',
  "Rest days aren't wasted days; they're when adaptation actually happens.",
  'Staying hydrated improves your energy, focus, and workout performance.',
  'Stress raises cortisol, which can interfere with recovery — a short walk or breathing break helps more than it seems.',
  'Tracking your workouts, even loosely, makes it much easier to spot real progress over time.',
  'Two-minute rest between hard sets is often too short for full strength recovery — 3–5 minutes suits heavy compound lifts better.',
  'Muscle soreness (DOMS) typically peaks 24–48 hours after a workout — normal, not a sign you overdid it.',
  'Exhaling during the hardest part of a lift helps maintain core stability.',
  'A short walk after a big meal can help regulate blood sugar.',
]

const AUTO_ADVANCE_MS = 7000
const SWIPE_THRESHOLD = 50

export function HealthTip() {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [paused, setPaused] = useState(false)

  function goTo(i: number) {
    setDirection(i > index ? 1 : -1)
    setIndex(i)
  }

  function step(delta: 1 | -1) {
    setDirection(delta)
    setIndex((i) => (i + delta + HEALTH_TIPS.length) % HEALTH_TIPS.length)
  }

  // Restart the countdown from a fresh 7s window after every navigation — auto-advance,
  // manual dot click, or swipe alike — so a manual interaction doesn't get immediately
  // overridden by an auto-advance that was already halfway through its interval.
  useEffect(() => {
    if (paused) return
    const id = setTimeout(() => step(1), AUTO_ADVANCE_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused])

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_THRESHOLD) step(1)
    else if (info.offset.x > SWIPE_THRESHOLD) step(-1)
  }

  return (
    <Card onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <CardContent className="flex flex-col gap-3">
        <div className="relative min-h-16 overflow-hidden">
          <AnimatePresence initial={false}>
            <motion.div
              key={index}
              initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -40 : 40, opacity: 0, position: 'absolute' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragStart={() => setPaused(true)}
              onDragEnd={(e, info) => {
                handleDragEnd(e, info)
                setPaused(false)
              }}
              className="flex touch-pan-y items-start gap-2"
            >
              <span className="shrink-0 text-lg">💡</span>
              <p className="text-sm text-muted-foreground">{HEALTH_TIPS[index]}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-1.5">
          {HEALTH_TIPS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show tip ${i + 1} of ${HEALTH_TIPS.length}`}
              onClick={() => goTo(i)}
              className={cn(
                'size-1.5 rounded-full transition-colors',
                i === index ? 'bg-primary' : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
