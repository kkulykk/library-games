import { cn } from '@/lib/utils'

export interface SavedSessionSummary {
  roomCode: string
  playerName: string
}

interface ResumeSessionButtonProps {
  session: SavedSessionSummary
  onClick: () => void
  title?: string
  separator?: string
  className?: string
  titleClassName?: string
  detailsClassName?: string
}

export function formatSessionSummary(session: SavedSessionSummary, separator = ' · '): string {
  return `${session.playerName}${separator}Room ${session.roomCode}`
}

export function ResumeSessionButton({
  session,
  onClick,
  title = 'Resume session',
  separator = ' · ',
  className,
  titleClassName,
  detailsClassName,
}: ResumeSessionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'border-primary/40 hover:bg-secondary w-64 rounded-xl border-2 border-dashed px-6 py-3 text-center text-sm transition-colors',
        className
      )}
    >
      <div className={cn('font-semibold', titleClassName)}>{title}</div>
      <div className={cn('text-muted-foreground text-xs', detailsClassName)}>
        {formatSessionSummary(session, separator)}
      </div>
    </button>
  )
}
