import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu } from '@base-ui/react/menu'
import { Apple, Dumbbell, LogOut, MessageCircle, User as UserIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { NavAvatar } from '@/components/NavAvatar'

function toDateStr(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function AppHeader() {
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [hasRecentStreak, setHasRecentStreak] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const [{ data: profile }, { data: sessions }] = await Promise.all([
      supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
      supabase
        .from('workout_sessions')
        .select('date')
        .eq('user_id', user.id)
        .in('date', [toDateStr(today), toDateStr(yesterday)]),
    ])

    setAvatarUrl(profile?.avatar_url ?? null)
    setHasRecentStreak((sessions?.length ?? 0) > 0)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
      <button type="button" onClick={() => navigate('/')} className="flex items-center outline-none">
        <img src="/logo.png" alt="FitForge" className="h-8 w-auto sm:h-9" />
      </button>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <Dumbbell className="size-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/nutrition')}>
          <Apple className="size-4" />
          <span className="hidden sm:inline">Nutrition</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/health')}>
          <MessageCircle className="size-4" />
          <span className="hidden sm:inline">Health</span>
        </Button>

        {hasRecentStreak && (
          <span className="ml-1 hidden shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent sm:flex">
            🔥 Streak
          </span>
        )}

        <Menu.Root>
          <Menu.Trigger
            className="ml-1 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Account menu"
          >
            <NavAvatar avatarUrl={avatarUrl} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner align="end" sideOffset={8} className="z-50">
              <Menu.Popup className="min-w-40 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                <Menu.Item
                  onClick={() => navigate('/profile')}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                >
                  <UserIcon className="size-4" />
                  Profile
                </Menu.Item>
                <Menu.Item
                  onClick={handleLogout}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none data-[highlighted]:bg-muted"
                >
                  <LogOut className="size-4" />
                  Logout
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </nav>
  )
}
