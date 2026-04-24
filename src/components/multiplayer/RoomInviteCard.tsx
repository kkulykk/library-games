import { Copy, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoomInviteCardProps {
  roomCode: string
  inviteLink: string
  copied: 'code' | 'link' | null
  onCopy: (value: string, kind: 'code' | 'link') => void
  title?: React.ReactNode
  meta?: React.ReactNode
  className?: string
  titleClassName?: string
  roomCodeClassName?: string
  actionsClassName?: string
  actionClassName?: string
  metaClassName?: string
}

export function RoomInviteCard({
  roomCode,
  inviteLink,
  copied,
  onCopy,
  title = 'Room · share this code',
  meta = '/ lobby · waiting for players',
  className,
  titleClassName,
  roomCodeClassName,
  actionsClassName,
  actionClassName,
  metaClassName,
}: RoomInviteCardProps) {
  return (
    <section className={className}>
      <span className={titleClassName}>{title}</span>
      <div data-testid="room-code" className={roomCodeClassName}>
        {roomCode}
      </div>
      <div className={actionsClassName}>
        <button
          type="button"
          className={cn(actionClassName)}
          onClick={() => onCopy(roomCode, 'code')}
        >
          <Copy className="h-3.5 w-3.5" />
          {copied === 'code' ? 'Copied' : 'Copy code'}
        </button>
        <button
          type="button"
          data-testid="invite-link"
          className={cn(actionClassName)}
          onClick={() => onCopy(inviteLink, 'link')}
        >
          <Link2 className="h-3.5 w-3.5" />
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <div className={metaClassName}>{meta}</div>
    </section>
  )
}
