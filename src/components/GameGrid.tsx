'use client'

import { useState } from 'react'
import { type GameMeta } from '@/data/games'
import { GameCard } from '@/components/GameCard'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'single-player' | 'online-multiplayer'

interface GameGridProps {
  games: GameMeta[]
}

const FILTERS: { value: Filter; label: string; emoji: string }[] = [
  { value: 'all', label: 'All Games', emoji: '🎮' },
  { value: 'single-player', label: 'Single Player', emoji: '🧩' },
  { value: 'online-multiplayer', label: 'Multiplayer', emoji: '👥' },
]

export function GameGrid({ games }: GameGridProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const liveGames = games.filter((g) => g.status === 'live')
  const comingSoonGames = games.filter((g) => g.status === 'coming-soon')

  const filteredLive = filter === 'all' ? liveGames : liveGames.filter((g) => g.category === filter)

  const counts: Record<Filter, number> = {
    all: liveGames.length,
    'single-player': liveGames.filter((g) => g.category === 'single-player').length,
    'online-multiplayer': liveGames.filter((g) => g.category === 'online-multiplayer').length,
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150',
              filter === f.value
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <span>{f.emoji}</span>
            {f.label}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-bold',
                filter === f.value
                  ? 'bg-background/20 text-background'
                  : 'bg-background text-foreground'
              )}
            >
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Live games grid */}
      {filteredLive.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredLive.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-muted-foreground">
          No games in this category yet.
        </div>
      )}

      {/* Coming soon section — only shown in "All" view */}
      {comingSoonGames.length > 0 && filter === 'all' && (
        <section className="mt-16">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Coming Soon</h2>
            <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
              {comingSoonGames.length} in development
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {comingSoonGames.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
