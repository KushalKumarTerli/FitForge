import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function ProtectedRoute() {
  const [status, setStatus] = useState<'checking' | 'authed' | 'anon'>('checking')

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setStatus(data.session ? 'authed' : 'anon')
    })
    return () => {
      active = false
    }
  }, [])

  if (status === 'checking') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (status === 'anon') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
