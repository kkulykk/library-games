import { cn } from '@/lib/utils'
import type { SavedSessionSummary } from './ResumeSessionButton'

interface ResumeSessionCardProps {
  session: SavedSessionSummary
  onResume: () => void
  title?: string
  actionLabel?: string
  description?: React.ReactNode
  className?: string
  contentClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  actionClassName?: string
}

export function ResumeSessionCard({
  session,
  onResume,
  title = 'Resume your last room',
  actionLabel = 'Resume →',
  description,
  className,
  contentClassName,
  titleClassName,
  descriptionClassName,
  actionClassName,
}: ResumeSessionCardProps) {
  return (
    <div className={className}>
      <div className={cn('min-w-0', contentClassName)}>
        <div className={titleClassName}>{title}</div>
        <div className={descriptionClassName}>
          {description ?? `Room ${session.roomCode} as ${session.playerName}`}
        </div>
      </div>
      <button type="button" onClick={onResume} className={actionClassName}>
        {actionLabel}
      </button>
    </div>
  )
}
