import Link from 'next/link'
import { type GameMeta } from '@/data/games'
import { cn } from '@/lib/utils'

interface GameCardProps {
  game: GameMeta
}

export function GameCard({ game }: GameCardProps) {
  const isComingSoon = game.status === 'coming-soon'

  const card = (
    <div
      className={cn(
        'group relative flex h-full flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200',
        isComingSoon
          ? 'cursor-default opacity-75'
          : 'cursor-pointer hover:-translate-y-1 hover:shadow-md'
      )}
    >
      {isComingSoon && (
        <span className="absolute right-4 top-4 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          Coming Soon
        </span>
      )}

      <div className="text-4xl">{game.emoji}</div>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-foreground">{game.title}</h2>
        <p className="text-sm text-muted-foreground">{game.description}</p>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5">
        {game.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium capitalize text-accent-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )

  if (isComingSoon) {
    return card
  }

  return <Link href={`/games/${game.slug}`} className="h-full">{card}</Link>
}
