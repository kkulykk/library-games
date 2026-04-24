import { cn } from '@/lib/utils'

interface LobbyActionsProps {
  isHost: boolean
  canStart: boolean
  onLeave: () => void
  onStart?: () => void
  hostLabel?: string
  guestLabel?: string
  leaveLabel?: string
  startLabel?: string
  className?: string
  statusClassName?: string
  actionsClassName?: string
  leaveButtonClassName?: string
  startButtonClassName?: string
}

export function LobbyActions({
  isHost,
  canStart,
  onLeave,
  onStart,
  hostLabel = "You're the host",
  guestLabel = 'Waiting for host to start',
  leaveLabel = 'Leave',
  startLabel = 'Start game →',
  className,
  statusClassName,
  actionsClassName,
  leaveButtonClassName,
  startButtonClassName,
}: LobbyActionsProps) {
  return (
    <footer className={className}>
      <span className={statusClassName}>{isHost ? hostLabel : guestLabel}</span>
      <div className={actionsClassName}>
        <button
          type="button"
          data-testid="leave-room-button"
          onClick={onLeave}
          className={leaveButtonClassName}
        >
          {leaveLabel}
        </button>
        {isHost && onStart && (
          <button
            type="button"
            data-testid="start-game-button"
            disabled={!canStart}
            onClick={onStart}
            className={cn(startButtonClassName)}
          >
            {startLabel}
          </button>
        )}
      </div>
    </footer>
  )
}
