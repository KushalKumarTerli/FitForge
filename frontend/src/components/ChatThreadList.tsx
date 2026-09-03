import { useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { Check, MoreVertical, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ChatThreadRow = {
  id: string
  title: string | null
  topic: string | null
  updated_at: string
  preview: string | null
  is_pinned: boolean
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
const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-primary/15 data-[highlighted]:to-accent/10'

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
  onDeleteSingle,
  onRenameThread,
  onTogglePin,
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
  onDeleteSingle: (id: string) => void
  onRenameThread: (id: string, title: string) => void
  onTogglePin: (id: string) => void
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const pinned = threads.filter((t) => t.is_pinned)
  const unpinned = threads.filter((t) => !t.is_pinned)
  const grouped = new Map<string, ChatThreadRow[]>()
  for (const t of unpinned) {
    const g = groupLabel(t.updated_at)
    if (!grouped.has(g)) grouped.set(g, [])
    grouped.get(g)!.push(t)
  }

  function commitRename(id: string, value: string) {
    const trimmed = value.trim()
    if (trimmed) onRenameThread(id, trimmed)
    setRenamingId(null)
  }

  function renderRow(t: ChatThreadRow) {
    const isSelected = selectedForDelete.has(t.id)
    const isRenaming = renamingId === t.id
    return (
      <div
        key={t.id}
        className={cn(
          'group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
          !editMode && selectedThreadId === t.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
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

        <div
          onClick={() => {
            if (isRenaming) return
            editMode ? onToggleSelectForDelete(t.id) : onSelectThread(t.id)
          }}
          className="min-w-0 flex-1 cursor-pointer"
        >
          {isRenaming ? (
            <input
              autoFocus
              defaultValue={t.title ?? ''}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setRenamingId(null)
              }}
              onBlur={(e) => commitRename(t.id, e.currentTarget.value)}
              className="w-full rounded border border-input bg-transparent px-1.5 py-0.5 text-sm outline-none focus-visible:border-ring"
            />
          ) : (
            <p className="truncate text-sm font-medium">{t.title || 'New chat'}</p>
          )}
          <p className="truncate text-xs text-muted-foreground">{t.preview || 'No messages yet'}</p>
        </div>

        {!isRenaming && (
          <span className="shrink-0 text-xs text-muted-foreground">{relativeLabel(t.updated_at)}</span>
        )}

        {!editMode && !isRenaming && (
          <Menu.Root>
            <Menu.Trigger
              onClick={(e) => e.stopPropagation()}
              aria-label="Thread options"
              className="shrink-0 rounded-md p-1 text-muted-foreground opacity-100 outline-none transition-opacity hover:bg-muted hover:text-foreground data-[popup-open]:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            >
              <MoreVertical className="size-4" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
                <Menu.Popup className="min-w-36 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                  <Menu.Item onClick={() => onTogglePin(t.id)} className={menuItemClass}>
                    {t.is_pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                    {t.is_pinned ? 'Unpin' : 'Pin'}
                  </Menu.Item>
                  <Menu.Item onClick={() => setRenamingId(t.id)} className={menuItemClass}>
                    <Pencil className="size-3.5" />
                    Rename
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => onDeleteSingle(t.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>
    )
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
          {pinned.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pinned</p>
              {pinned.map(renderRow)}
            </div>
          )}
          {GROUP_ORDER.filter((g) => grouped.has(g)).map((g) => (
            <div key={g} className="flex flex-col gap-1.5">
              <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g}</p>
              {grouped.get(g)!.map(renderRow)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
