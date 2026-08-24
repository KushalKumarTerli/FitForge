import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Apple, Dumbbell, LogOut, MessageCircle, Settings } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { NavAvatar } from '@/components/NavAvatar'

const markdownComponents: Components = {
  h1: ({ node, ...props }) => <h3 className="mt-3 mb-1 text-base font-semibold first:mt-0" {...props} />,
  h2: ({ node, ...props }) => <h3 className="mt-3 mb-1 text-base font-semibold first:mt-0" {...props} />,
  h3: ({ node, ...props }) => <h3 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...props} />,
  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
  ul: ({ node, ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
  ol: ({ node, ...props }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...props} />,
  li: ({ node, ...props }) => <li {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  a: ({ node, ...props }) => (
    <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
  ),
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  topic: string | null
  created_at: string
}

const TOPICS: { label: string; starter: string }[] = [
  { label: 'Heart Health', starter: "What can I do to improve my heart health based on my recent activity?" },
  { label: 'Testosterone Booster', starter: 'What can I do to naturally support healthy testosterone levels?' },
  { label: 'Strength Building', starter: 'How can I build strength more effectively with my current routine?' },
  { label: 'Mental Health', starter: 'What can I do to support my mental health alongside my fitness routine?' },
  { label: 'Brain Sharpener', starter: 'What can I do to improve my focus and mental sharpness?' },
  { label: 'Fertility', starter: 'What lifestyle changes can help support fertility?' },
  { label: 'Strength Training', starter: 'How should I structure my strength training for better results?' },
  { label: 'Sexual Health', starter: 'What can I do to improve my sexual health?' },
  { label: 'Hygiene', starter: 'What hygiene habits should I prioritize as an active person?' },
  { label: 'Skin Care', starter: 'What skincare routine would help with my active lifestyle?' },
  { label: 'Hair Care', starter: 'What can I do to keep my hair healthy while working out regularly?' },
  { label: 'Facial Shape', starter: 'What exercises or habits can help improve my facial definition?' },
]

export default function Health() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [draft, setDraft] = useState('')
  const [topic, setTopic] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadHistory()
    loadAvatar()
  }, [])

  async function loadAvatar() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
    setAvatarUrl(data?.avatar_url ?? null)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function loadHistory() {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('health_chat')
      .select('id, role, content, topic, created_at')
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoadingHistory(false)
  }

  function handleTopicClick(t: { label: string; starter: string }) {
    setTopic(t.label)
    setDraft(t.starter)
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const messageText = draft.trim()
    if (!messageText || sending) return

    setSending(true)
    setError(null)
    setDraft('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setError('You need to be logged in.')
      setSending(false)
      return
    }

    const optimisticId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, role: 'user', content: messageText, topic, created_at: new Date().toISOString() },
    ])

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: messageText, topic }),
      })

      if (!response.ok) {
        throw new Error(`Chat request failed (${response.status})`)
      }

      const data = await response.json()
      const assistantContent: string = data.content

      const { data: userRow } = await supabase
        .from('health_chat')
        .insert({ user_id: session.user.id, topic, role: 'user', content: messageText })
        .select()
        .single()

      const { data: assistantRow } = await supabase
        .from('health_chat')
        .insert({ user_id: session.user.id, topic, role: 'assistant', content: assistantContent })
        .select()
        .single()

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId)
        const additions = [userRow, assistantRow].filter(Boolean) as ChatMessage[]
        return [...withoutOptimistic, ...additions]
      })
    } catch {
      setError('Could not get a response. Please try again.')
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setDraft(messageText)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <nav className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 font-heading text-lg">
          <MessageCircle className="size-5" />
          Health
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <Dumbbell className="size-4" />
            Dashboard
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/nutrition')}>
            <Apple className="size-4" />
            Nutrition
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/profile')} aria-label="Settings">
            <Settings className="size-4" />
          </Button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Profile"
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <NavAvatar avatarUrl={avatarUrl} />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut()
              navigate('/login')
            }}
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </nav>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-3xl">What would you want me to suggest 😊</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {TOPICS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => handleTopicClick(t)}
                  className={cn(
                    'rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors',
                    topic === t.label
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-muted/40 text-foreground hover:border-ring hover:bg-muted'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex max-h-[28rem] min-h-40 flex-col gap-3 overflow-y-auto py-2">
              {loadingHistory ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pick a topic above or just ask a question to get started.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {m.role === 'user' ? (
                      <div className="max-w-[85%] rounded-xl bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
                        {m.content}
                      </div>
                    ) : (
                      <div className="max-w-[95%] text-sm text-foreground">
                        <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 px-1 py-2">
                    <span className="size-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:0ms]" />
                    <span className="size-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="size-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <form onSubmit={handleSend} className="flex flex-col gap-2">
              <Textarea
                placeholder="Tell me what's your doubt....!"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !draft.trim()}>
                {sending ? 'Sending…' : 'Send'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
