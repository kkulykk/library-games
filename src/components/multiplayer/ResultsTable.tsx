import { cn } from '@/lib/utils'
import { ArcadeAvatar } from './ArcadeAvatar'

export interface ResultsTableRow {
  id: string
  rankLabel: React.ReactNode
  name: string
  avatar: number
  secondaryLabel?: React.ReactNode
  totalLabel: React.ReactNode
  isWinner?: boolean
}

interface ResultsTableProps {
  rows: ResultsTableRow[]
  className?: string
  rowClassName?: string
  winnerRowClassName?: string
  rankClassName?: string
  playerClassName?: string
  secondaryClassName?: string
  totalClassName?: string
}

export function ResultsTable({
  rows,
  className,
  rowClassName,
  winnerRowClassName,
  rankClassName,
  playerClassName,
  secondaryClassName,
  totalClassName,
}: ResultsTableProps) {
  return (
    <div className={className}>
      {rows.map((row) => (
        <div
          key={row.id}
          className={cn(rowClassName, row.isWinner && winnerRowClassName)}
          data-winner={row.isWinner ? 'true' : 'false'}
        >
          <span className={rankClassName}>{row.rankLabel}</span>
          <div className={playerClassName}>
            <ArcadeAvatar index={row.avatar} size={26} />
            <span>{row.name}</span>
          </div>
          <span className={secondaryClassName}>{row.secondaryLabel ?? ''}</span>
          <span className={totalClassName}>{row.totalLabel}</span>
        </div>
      ))}
    </div>
  )
}
