import Link from 'next/link'
import { type GameMeta } from '@/data/games'
import { cn } from '@/lib/utils'

interface GameCardProps {
  game: GameMeta
}

export function GameCard({ game }: GameCardProps) {
  const isComingSoon = game.status === 'coming-soon'
  const isMultiplayer = game.category === 'online-multiplayer'

  const card = (
    <div
      className={cn(
        'group relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-all duration-200',
        isComingSoon
          ? 'cursor-default opacity-60'
          : 'cursor-pointer hover:-translate-y-1 hover:shadow-lg',
        !isComingSoon && isMultiplayer
          ? 'border-l-4 border-l-purple-400'
          : !isComingSoon
            ? 'border-l-4 border-l-blue-400'
            : ''
      )}
    >
      {/* Emoji + category badge row */}
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl',
            isComingSoon
              ? 'bg-muted'
              : isMultiplayer
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'bg-blue-100 dark:bg-blue-900/30'
          )}
        >
          {game.emoji}
        </div>

        {isComingSoon ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Coming Soon
          </span>
        ) : (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              isMultiplayer
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            )}
          >
            {isMultiplayer ? '👥 Multiplayer' : '🎮 Solo'}
          </span>
        )}
      </div>

      {/* Title + description */}
      <div>
        <h2 className="text-base font-bold text-foreground">{game.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{game.description}</p>
      </div>

      {/* Tags */}
      <div className="mt-auto flex flex-wrap gap-1.5">
        {game.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium capitalize text-accent-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Play hint */}
      {!isComingSoon && (
        <div className="flex items-center text-xs font-semibold text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Play now →
        </div>
      )}
    </div>
  )

  if (isComingSoon) return card

  return (
    <Link href={`/games/${game.slug}`} className="h-full">
      {card}
    </Link>
  )
}
