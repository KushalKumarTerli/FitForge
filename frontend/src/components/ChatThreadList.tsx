import { Check, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ChatThreadRow = {
  id: string
  title: string | null
  topic: string | null
  updated_at: string
  preview: string | null
}

function relativeLabel(iso: string) {
  const d = new Date(iso)
  const startOfDay = (x: Date) => {
    const c = new Date(x)
    c.setHours(0, 0, 0, 0)
    return c
  }
  const today = startOfDay(new Date())
  const day = startOfDay(d)
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000)

  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

function groupLabel(iso: string): 'Today' | 'Yesterday' | 'Older' {
  const d = new Date(iso)
  const startOfDay = (x: Date) => {
    const c = new Date(x)
    c.setHours(0, 0, 0, 0)
    return c
  }
  const today = startOfDay(new Date())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const day = startOfDay(d)
  if (day.getTime() === today.getTime()) return 'Today'
  if (day.getTime() === yesterday.getTime()) return 'Yesterday'
  return 'Older'
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Older'] as const

export function ChatThreadList({
  threads,
  loading,
  selectedThreadId,
  onSelectThread,
  onNewChat,
  editMode,
  onToggleEditMode,
  selectedForDelete,
  onToggleSelectForDelete,
  onDeleteSelected,
}: {
  threads: ChatThreadRow[]
  loading: boolean
  selectedThreadId: string | null
  onSelectThread: (id: string) => void
  onNewChat: () => void
  editMode: boolean
  onToggleEditMode: () => void
  selectedForDelete: Set<string>
  onToggleSelectForDelete: (id: string) => void
  onDeleteSelected: () => void
}) {
  const grouped = new Map<string, ChatThreadRow[]>()
  for (const t of threads) {
    const g = groupLabel(t.updated_at)
    if (!grouped.has(g)) grouped.set(g, [])
    grouped.get(g)!.push(t)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="sm" className="flex-1" onClick={onNewChat}>
          <Plus className="size-3.5" />
          New Chat
        </Button>
        {threads.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={onToggleEditMode}>
            {editMode ? 'Done' : 'Edit'}
          </Button>
        )}
      </div>

      {editMode && selectedForDelete.size > 0 && (
        <Button type="button" variant="destructive" size="sm" onClick={onDeleteSelected}>
          <Trash2 className="size-3.5" />
          Delete {selectedForDelete.size} chat{selectedForDelete.size === 1 ? '' : 's'}
        </Button>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No conversations yet. Pick a topic or start a new chat to get going.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {GROUP_ORDER.filter((g) => grouped.has(g)).map((g) => (
            <div key={g} className="flex flex-col gap-1.5">
              <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g}</p>
              {grouped.get(g)!.map((t) => {
                const isSelected = selectedForDelete.has(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => (editMode ? onToggleSelectForDelete(t.id) : onSelectThread(t.id))}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors',
                      !editMode && selectedThreadId === t.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {editMode && (
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                          isSelected ? 'border-destructive bg-destructive text-white' : 'border-input'
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title || 'New chat'}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.preview || 'No messages yet'}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeLabel(t.updated_at)}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
