import { useEffect, useRef, useState, type FormEvent } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getTodayBounds, toDateStr } from '@/lib/date'
import { VoiceInputButton } from '@/components/VoiceInputButton'

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
  created_at: string
}

// chat_threads.title is NOT NULL, defaulting to this literal string at the DB level (confirmed
// live — not null as originally assumed), so "hasn't been set yet" has to be checked against
// this sentinel rather than falsiness.
const DEFAULT_TITLE = 'New Chat'

// First ~6 words of the opening message, client-side — no extra API call for something this
// small a solution already covers.
function deriveTitle(text: string) {
  const words = text.trim().split(/\s+/)
  if (words.length <= 6) return text.trim()
  return words.slice(0, 6).join(' ') + '…'
}

export function HealthChatThread({
  threadId,
  threadTitle,
  topic,
  initialDraft,
  onBack,
  onThreadUpdated,
  onSendingChange,
}: {
  threadId: string
  threadTitle: string | null
  topic: string | null
  initialDraft?: string
  onBack?: () => void
  onThreadUpdated: (threadId: string, patch: { title?: string; updated_at: string; preview: string }) => void
  onSendingChange?: (sending: boolean) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [draft, setDraft] = useState(initialDraft ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  // Lets the parent know a send is in flight on this (still-empty, by DB state) thread, so a
  // topic click that lands mid-request creates a new thread instead of retagging/remounting
  // the one an in-flight reply is about to land on.
  useEffect(() => {
    onSendingChange?.(sending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function loadHistory() {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('health_chat')
      .select('id, role, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoadingHistory(false)
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
      { id: optimisticId, role: 'user', content: messageText, created_at: new Date().toISOString() },
    ])

    try {
      const { start: today_start, end: today_end } = getTodayBounds()
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: messageText,
          topic,
          thread_id: threadId,
          today_start,
          today_end,
          today_date: toDateStr(new Date()),
        }),
      })

      if (!response.ok) {
        throw new Error(`Chat request failed (${response.status})`)
      }

      const data = await response.json()
      const assistantContent: string = data.content

      const { data: userRow } = await supabase
        .from('health_chat')
        .insert({ user_id: session.user.id, thread_id: threadId, topic, role: 'user', content: messageText })
        .select()
        .single()

      const { data: assistantRow } = await supabase
        .from('health_chat')
        .insert({ user_id: session.user.id, thread_id: threadId, topic, role: 'assistant', content: assistantContent })
        .select()
        .single()

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId)
        const additions = [userRow, assistantRow].filter(Boolean) as ChatMessage[]
        return [...withoutOptimistic, ...additions]
      })

      const nowIso = new Date().toISOString()
      const patch: { title?: string; updated_at: string; preview: string } = {
        updated_at: nowIso,
        preview: assistantContent,
      }
      // Derive a title only while it's still the untouched default — covers the normal "first
      // message" case, but also protects a manual rename made before any message was sent:
      // once threadTitle is anything else (by either path), it sticks and this never
      // overwrites it again.
      if (!threadTitle || threadTitle === DEFAULT_TITLE) patch.title = deriveTitle(messageText)

      await supabase
        .from('chat_threads')
        .update(patch.title ? { title: patch.title, updated_at: nowIso } : { updated_at: nowIso })
        .eq('id', threadId)

      onThreadUpdated(threadId, patch)
    } catch {
      setError('Could not get a response. Please try again.')
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setDraft(messageText)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chats"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}
        <p className="truncate font-medium">{threadTitle || 'New chat'}</p>
      </div>

      <div className="flex max-h-[32rem] min-h-40 flex-1 flex-col gap-3 overflow-y-auto py-1">
        {loadingHistory ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ask a question to get started.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
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
        <div className="relative">
          <Textarea
            placeholder="Ask anything about your health…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
            className="pr-10"
          />
          <div className="absolute top-1.5 right-1.5">
            <VoiceInputButton onResult={(text) => setDraft(text)} />
          </div>
        </div>
        <Button type="submit" disabled={sending || !draft.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        FitForge Coach can make mistakes. Always use your best judgment.
      </p>
    </div>
  )
}
