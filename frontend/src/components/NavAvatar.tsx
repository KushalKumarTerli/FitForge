import { User as UserIcon } from 'lucide-react'

export function NavAvatar({ avatarUrl }: { avatarUrl: string | null }) {
  return (
    <div className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-muted">
      {avatarUrl ? (
        <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
      ) : (
        <UserIcon className="size-4 text-muted-foreground" />
      )}
    </div>
  )
}
