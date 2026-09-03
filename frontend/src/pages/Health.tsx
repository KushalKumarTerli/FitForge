import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/AppShell'
import { ChatThreadList, type ChatThreadRow } from '@/components/ChatThreadList'
import { HealthChatThread } from '@/components/HealthChatThread'
import { TopicPicker, type Topic } from '@/components/TopicPicker'
import { HealthTip } from '@/components/HealthTip'
import { cn } from '@/lib/utils'

type ThreadRecord = {
  id: string
  title: string | null
  topic: string | null
  updated_at: string
  is_pinned: boolean
}

export default function Health() {
  const [userId, setUserId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ChatThreadRow[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [pendingInitialDraft, setPendingInitialDraft] = useState<string | undefined>(undefined)
  const [editMode, setEditMode] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [openThreadSending, setOpenThreadSending] = useState(false)

  useEffect(() => {
    loadThreads()
  }, [])

  async function loadThreads() {
    setLoadingThreads(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoadingThreads(false)
      return
    }
    setUserId(user.id)

    const { data: threadRows } = await supabase
      .from('chat_threads')
      .select('id, title, topic, updated_at, is_pinned')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    const ids = (threadRows ?? []).map((t) => t.id)
    let previewByThread = new Map<string, string>()
    if (ids.length > 0) {
      // Most-recent message per thread, computed client-side rather than relying on a nested
      // per-parent embed limit: fetch every message for these threads ordered newest-first,
      // then keep only the first occurrence per thread_id.
      const { data: recentMessages } = await supabase
        .from('health_chat')
        .select('thread_id, content, created_at')
        .in('thread_id', ids)
        .order('created_at', { ascending: false })
      for (const m of recentMessages ?? []) {
        if (!previewByThread.has(m.thread_id)) previewByThread.set(m.thread_id, m.content)
      }
    }

    setThreads(
      ((threadRows ?? []) as ThreadRecord[]).map((t) => ({
        ...t,
        preview: previewByThread.get(t.id) ?? null,
      }))
    )
    setLoadingThreads(false)
  }

  async function handleNewChat(topic?: Topic) {
    if (!userId) return
    setEditMode(false)
    setSelectedForDelete(new Set())

    // A thread with no messages yet is a true empty draft — whether it came from "+ New Chat"
    // or a prior topic click that was never sent. Re-tag and reuse it instead of stacking up
    // throwaway empty threads every time someone browses topics before actually sending.
    const openThread = threads.find((t) => t.id === selectedThreadId)
    if (openThread && openThread.preview === null && !openThreadSending) {
      const newTopic = topic?.label ?? null
      if (newTopic !== openThread.topic) {
        await supabase.from('chat_threads').update({ topic: newTopic }).eq('id', openThread.id)
        setThreads((prev) => prev.map((t) => (t.id === openThread.id ? { ...t, topic: newTopic } : t)))
      }
      setPendingInitialDraft(topic?.starter)
      return
    }

    const { data: inserted } = await supabase
      .from('chat_threads')
      .insert({ user_id: userId, topic: topic?.label ?? null })
      .select('id, title, topic, updated_at, is_pinned')
      .single()

    if (!inserted) return

    setThreads((prev) => [{ ...inserted, is_pinned: false, preview: null }, ...prev])
    setSelectedThreadId(inserted.id)
    setPendingInitialDraft(topic?.starter)
  }

  function handleSelectThread(id: string) {
    setSelectedThreadId(id)
    setPendingInitialDraft(undefined)
  }

  function handleToggleEditMode() {
    setEditMode((e) => !e)
    setSelectedForDelete(new Set())
  }

  function handleToggleSelectForDelete(id: string) {
    setSelectedForDelete((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDeleteSelected() {
    if (!userId || selectedForDelete.size === 0) return
    const ids = [...selectedForDelete]
    const confirmed = window.confirm(`Delete ${ids.length} chat${ids.length === 1 ? '' : 's'}? This can't be undone.`)
    if (!confirmed) return

    const { error } = await supabase.from('chat_threads').delete().in('id', ids).eq('user_id', userId)
    if (error) return

    setThreads((prev) => prev.filter((t) => !ids.includes(t.id)))
    if (selectedThreadId && ids.includes(selectedThreadId)) setSelectedThreadId(null)
    setSelectedForDelete(new Set())
    setEditMode(false)
  }

  async function handleDeleteSingle(id: string) {
    if (!userId) return
    const confirmed = window.confirm("Delete this chat? This can't be undone.")
    if (!confirmed) return

    const { error } = await supabase.from('chat_threads').delete().eq('id', id).eq('user_id', userId)
    if (error) return

    setThreads((prev) => prev.filter((t) => t.id !== id))
    if (selectedThreadId === id) setSelectedThreadId(null)
  }

  async function handleRenameThread(id: string, title: string) {
    if (!userId) return
    const { error } = await supabase.from('chat_threads').update({ title }).eq('id', id).eq('user_id', userId)
    if (error) return
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)))
  }

  async function handleTogglePin(id: string) {
    if (!userId) return
    const thread = threads.find((t) => t.id === id)
    if (!thread) return
    const nextPinned = !thread.is_pinned
    const { error } = await supabase.from('chat_threads').update({ is_pinned: nextPinned }).eq('id', id).eq('user_id', userId)
    if (error) return
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, is_pinned: nextPinned } : t)))
  }

  function handleThreadUpdated(threadId: string, patch: { title?: string; updated_at: string; preview: string }) {
    setThreads((prev) => {
      const next = prev.map((t) => (t.id === threadId ? { ...t, ...patch } : t))
      next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      return next
    })
  }

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Health Coach</h1>
          <p className="text-sm text-muted-foreground">Ask anything about your health and fitness.</p>
        </div>

        {/*
          Each pane's component is mounted exactly once — only the wrapping div's visibility
          is responsive. Mounting HealthChatThread/ChatThreadList twice (once per breakpoint)
          would double their data fetches and let two independent instances of the same thread
          drift out of sync with each other.
        */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_240px]">
          {/* Column 1: topic grid (mobile hub only) + thread list (hidden on mobile once a
              thread is open; always visible on desktop) */}
          <div className={cn('flex flex-col gap-4', selectedThread ? 'hidden lg:flex' : 'flex')}>
            <div className="flex flex-col gap-4 lg:hidden">
              <Card>
                <CardContent>
                  <TopicPicker onSelectTopic={(t) => handleNewChat(t)} />
                </CardContent>
              </Card>
              <HealthTip />
            </div>
            <Card>
              <CardContent>
                <ChatThreadList
                  threads={threads}
                  loading={loadingThreads}
                  selectedThreadId={selectedThreadId}
                  onSelectThread={handleSelectThread}
                  onNewChat={() => handleNewChat()}
                  editMode={editMode}
                  onToggleEditMode={handleToggleEditMode}
                  selectedForDelete={selectedForDelete}
                  onToggleSelectForDelete={handleToggleSelectForDelete}
                  onDeleteSelected={handleDeleteSelected}
                  onDeleteSingle={handleDeleteSingle}
                  onRenameThread={handleRenameThread}
                  onTogglePin={handleTogglePin}
                />
              </CardContent>
            </Card>
          </div>

          {/* Column 2: active thread, or an empty state — mobile only when a thread is
              selected; always visible on desktop */}
          <div className={cn(selectedThread ? 'block' : 'hidden', 'lg:block')}>
            <Card className={cn(!selectedThread && 'flex h-full items-center justify-center')}>
              <CardContent className={cn('w-full', !selectedThread && 'flex flex-col items-center gap-3 text-center')}>
                {selectedThread ? (
                  <HealthChatThread
                    // Force a fresh mount per thread (and per re-tag of the same still-empty
                    // thread) — without this, switching threads, or re-tagging the currently
                    // open empty draft with a new topic, reuses the same component instance,
                    // and useState(initialDraft) only evaluates on first mount, so the new
                    // starter text never appears.
                    key={`${selectedThread.id}|${selectedThread.topic ?? ''}`}
                    threadId={selectedThread.id}
                    threadTitle={selectedThread.title}
                    topic={selectedThread.topic}
                    initialDraft={pendingInitialDraft}
                    onBack={() => setSelectedThreadId(null)}
                    onThreadUpdated={handleThreadUpdated}
                    onSendingChange={setOpenThreadSending}
                  />
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Select a chat or start a new one.</p>
                    <Button type="button" size="sm" onClick={() => handleNewChat()}>
                      New Chat
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Column 3: topics rail + health tip — desktop only */}
          <div className="hidden flex-col gap-4 lg:flex">
            <Card>
              <CardContent>
                <TopicPicker onSelectTopic={(t) => handleNewChat(t)} />
              </CardContent>
            </Card>
            <HealthTip />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
