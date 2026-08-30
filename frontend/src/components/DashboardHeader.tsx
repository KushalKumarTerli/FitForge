import { Flame } from 'lucide-react'
import { NavAvatar } from '@/components/NavAvatar'

export function DashboardHeader({
  date,
  greeting,
  motivationalLine,
  streak,
  avatarUrl,
  fullName,
}: {
  date: string
  greeting: string
  motivationalLine: string
  streak: number
  avatarUrl: string | null
  fullName: string
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Desktop-only identity row — mobile already gets this from AppShell's top bar */}
      <div className="hidden items-center justify-between lg:flex">
        <p className="text-sm text-muted-foreground">{date}</p>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Flame className="size-3.5" />
              {streak} DAY STREAK
            </span>
          )}
          <div className="flex items-center gap-2">
            <NavAvatar avatarUrl={avatarUrl} />
            <span className="text-sm font-medium">{fullName}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{greeting}</h1>
        <p className="text-sm text-muted-foreground">{motivationalLine}</p>
      </div>
    </div>
  )
}
