import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from '@base-ui/react/menu'
import { Apple, ChevronsLeft, ChevronsRight, Dumbbell, LogOut, MessageCircle, Plus, User as UserIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { NavAvatar } from '@/components/NavAvatar'
import { cn } from '@/lib/utils'

const SIDEBAR_COLLAPSED_KEY = 'fitforge:sidebar-collapsed'

function getInitialCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function toDateStr(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Apple },
  { to: '/health', label: 'Health', icon: MessageCircle },
]

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [hasRecentStreak, setHasRecentStreak] = useState(false)
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
    } catch {
      // ignore — collapsed state just won't persist across reloads
    }
  }, [collapsed])

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

  function isActive(to: string) {
    return location.pathname === to
  }

  // Quick Log already lives on both Dashboard and Nutrition — this is a faster entry point to
  // it, not a new feature. Scroll straight to it if it's already on screen, otherwise navigate
  // to Dashboard and let it scroll once loaded (see Dashboard.tsx's scrollToQuickLog effect).
  function handleQuickAdd() {
    if (location.pathname === '/' || location.pathname === '/nutrition') {
      document.getElementById('quick-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      navigate('/', { state: { scrollToQuickLog: true } })
    }
  }

  const navButtonClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors',
      collapsed && 'justify-center px-0',
      active
        ? 'bg-primary/15 text-primary'
        : 'text-muted-foreground hover:bg-gradient-to-r hover:from-primary/15 hover:to-accent/10 hover:text-foreground'
    )

  return (
    <div className="min-h-svh bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className={cn('flex items-center overflow-hidden py-5 outline-none', collapsed ? 'justify-center px-0' : 'px-5')}
        >
          <img src={collapsed ? '/favicon.png' : '/logo.png'} alt="FitForge" className="h-8 w-auto" />
        </button>

        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                title={collapsed ? item.label : undefined}
                className={navButtonClass(isActive(item.to))}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && item.label}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'mx-3 mb-1 flex items-center gap-2 rounded-lg py-2 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground',
            collapsed ? 'justify-center px-0' : 'px-3'
          )}
        >
          {collapsed ? <ChevronsRight className="size-4 shrink-0" /> : <ChevronsLeft className="size-4 shrink-0" />}
          {!collapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>

        <div className="flex flex-col gap-1 border-t border-border px-3 py-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            title={collapsed ? 'Profile' : undefined}
            className={navButtonClass(isActive('/profile'))}
          >
            <NavAvatar avatarUrl={avatarUrl} />
            {!collapsed && 'Profile'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/10',
              collapsed && 'justify-center px-0'
            )}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
        <button type="button" onClick={() => navigate('/')} className="flex items-center outline-none">
          <img src="/logo.png" alt="FitForge" className="h-8 w-auto" />
        </button>

        <div className="flex items-center gap-2">
          {hasRecentStreak && (
            <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
              🔥 Streak
            </span>
          )}

          <Menu.Root>
            <Menu.Trigger
              className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Account menu"
            >
              <NavAvatar avatarUrl={avatarUrl} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={8} className="z-50">
                <Menu.Popup className="min-w-40 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                  <Menu.Item
                    onClick={() => navigate('/profile')}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-primary/15 data-[highlighted]:to-accent/10"
                  >
                    <UserIcon className="size-4" />
                    Profile
                  </Menu.Item>
                  <Menu.Item
                    onClick={handleLogout}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>

      {/* Content column */}
      <div className={cn('transition-[padding-left] duration-200', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <main className="pb-20 lg:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav — Dashboard, Nutrition, [+ Quick Add], Health, Profile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon
          const active = isActive(item.to)
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium outline-none transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </button>
          )
        })}

        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={handleQuickAdd}
            aria-label="Quick add"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-gradient-to-b from-[#16A34A] to-[#22C55E] text-primary-foreground shadow-lg shadow-primary/30 outline-none transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        </div>

        {[...NAV_ITEMS.slice(2), { to: '/profile', label: 'Profile', icon: UserIcon }].map((item) => {
          const Icon = item.icon
          const active = isActive(item.to)
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium outline-none transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
