import { useState } from 'react'

export type Topic = { label: string; starter: string }

// All 12 original categories — none dropped, just re-hosted per-thread instead of per-message.
export const TOPICS: Topic[] = [
  { label: 'Heart Health', starter: 'What can I do to improve my heart health based on my recent activity?' },
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

const DEFAULT_VISIBLE_COUNT = 5

export function TopicPicker({ onSelectTopic }: { onSelectTopic: (topic: Topic) => void }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? TOPICS : TOPICS.slice(0, DEFAULT_VISIBLE_COUNT)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quick Topics</p>
      <div className="flex flex-wrap gap-2">
        {visible.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => onSelectTopic(t)}
            className="rounded-full border-2 border-border bg-muted/40 px-3.5 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-ring hover:bg-muted"
          >
            {t.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="self-start text-sm text-accent underline underline-offset-2"
      >
        {expanded ? 'Show less' : `More (${TOPICS.length - DEFAULT_VISIBLE_COUNT})`}
      </button>
    </div>
  )
}
