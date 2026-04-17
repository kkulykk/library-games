'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type GameMeta } from '@/data/games'
import { cn } from '@/lib/utils'
import {
  estimateMinutes,
  matchesLibraryFilter,
  sortLibraryGames,
  type LibraryFilter,
  type LibrarySort,
} from './home-experience.logic'

type HomeTab = 'discover' | 'library'

interface HomeExperienceProps {
  games: GameMeta[]
}

const LIBRARY_FILTERS: { value: LibraryFilter; label: string; emoji: string }[] = [
  { value: 'all', label: 'All', emoji: '🎮' },
  { value: 'single-player', label: 'Solo', emoji: '🧩' },
  { value: 'online-multiplayer', label: 'Multiplayer', emoji: '👥' },
  { value: 'party', label: 'Party', emoji: '🥳' },
  { value: 'chill', label: 'Chill', emoji: '🫧' },
]

const LIBRARY_SORTS: { value: LibrarySort; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'a-z', label: 'A → Z' },
  { value: 'quick', label: 'Quick games' },
]

function StoryCard({ game }: { game: GameMeta }) {
  return (
    <article className="from-card to-accent/40 rounded-3xl border bg-gradient-to-br p-6 shadow-sm">
      <div className="mb-4 text-5xl">{game.emoji}</div>
      <p className="text-muted-foreground mb-2 text-xs tracking-[0.16em] uppercase">Game story</p>
      <h3 className="text-foreground text-2xl font-black">{game.title}</h3>
      <p className="text-muted-foreground mt-2 text-sm">{game.description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {game.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="bg-background rounded-full border px-2.5 py-1 text-xs capitalize"
          >
            #{tag}
          </span>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        <Link
          href={`/games/${game.slug}`}
          className="bg-foreground text-background rounded-full px-4 py-2 text-sm font-semibold"
        >
          Play now
        </Link>
        <Link
          href={`/games/${game.slug}`}
          className="bg-background hover:bg-accent rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
        >
          Details
        </Link>
      </div>
    </article>
  )
}

function DiscoverRow({ title, items }: { title: string; items: GameMeta[] }) {
  if (items.length === 0) return null

  return (
    <section className="mt-8">
      <h4 className="mb-3 text-sm font-bold tracking-tight">{title}</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((game) => (
          <Link
            key={game.slug}
            href={`/games/${game.slug}`}
            className="bg-card hover:bg-accent/60 flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors"
          >
            <div>
              <p className="text-sm font-semibold">
                {game.emoji} {game.title}
              </p>
              <p className="text-muted-foreground text-xs">~{estimateMinutes(game)} min</p>
            </div>
            <span className="text-muted-foreground text-xs">Open →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function HomeExperience({ games }: HomeExperienceProps) {
  const liveGames = useMemo(() => games.filter((game) => game.status === 'live'), [games])

  const [activeTab, setActiveTab] = useState<HomeTab>('discover')
  const [activeStoryIndex, setActiveStoryIndex] = useState(0)

  const [query, setQuery] = useState('')
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all')
  const [librarySort, setLibrarySort] = useState<LibrarySort>('popular')
  const [favorites, setFavorites] = useState<string[]>([])

  const discoverGames = useMemo(() => {
    const prioritized = [...liveGames].sort((a, b) => {
      if (a.category === b.category) return a.title.localeCompare(b.title)
      return a.category === 'online-multiplayer' ? -1 : 1
    })
    return prioritized.slice(0, 7)
  }, [liveGames])

  const activeStory = discoverGames[activeStoryIndex] ?? discoverGames[0]

  const quickGames = useMemo(
    () => liveGames.filter((game) => estimateMinutes(game) <= 12).slice(0, 6),
    [liveGames]
  )

  const multiplayerTonight = useMemo(
    () => liveGames.filter((game) => game.category === 'online-multiplayer').slice(0, 6),
    [liveGames]
  )

  const becauseYouPlayed = useMemo(() => {
    const pool = [...liveGames]
      .filter((game) => game.slug !== activeStory?.slug)
      .sort((a, b) => estimateMinutes(a) - estimateMinutes(b))
    return pool.slice(0, 6)
  }, [activeStory?.slug, liveGames])

  const libraryGames = useMemo(() => {
    const byFilter = liveGames.filter((game) => matchesLibraryFilter(game, libraryFilter))
    const byQuery = byFilter.filter((game) => {
      if (!query.trim()) return true
      const text = `${game.title} ${game.description} ${game.tags.join(' ')}`.toLowerCase()
      return text.includes(query.trim().toLowerCase())
    })
    return sortLibraryGames(byQuery, librarySort)
  }, [libraryFilter, librarySort, liveGames, query])

  return (
    <div className="space-y-6">
      <div className="bg-muted inline-flex rounded-full p-1">
        <button
          onClick={() => setActiveTab('discover')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'discover' ? 'bg-background border shadow-sm' : 'text-muted-foreground'
          )}
        >
          ✨ Discover
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'library' ? 'bg-background border shadow-sm' : 'text-muted-foreground'
          )}
        >
          📚 Library
        </button>
      </div>

      {activeTab === 'discover' && activeStory && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold">Story mode</h3>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setActiveStoryIndex((prev) =>
                    prev === 0 ? Math.max(discoverGames.length - 1, 0) : prev - 1
                  )
                }
                className="bg-card hover:bg-accent rounded-full border px-3 py-1.5 text-sm"
              >
                ←
              </button>
              <button
                onClick={() =>
                  setActiveStoryIndex((prev) =>
                    discoverGames.length === 0 ? 0 : (prev + 1) % discoverGames.length
                  )
                }
                className="bg-card hover:bg-accent rounded-full border px-3 py-1.5 text-sm"
              >
                →
              </button>
            </div>
          </div>

          <StoryCard game={activeStory} />

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {discoverGames.map((game, index) => (
              <button
                key={game.slug}
                onClick={() => setActiveStoryIndex(index)}
                className={cn(
                  'bg-card min-w-fit rounded-full border px-3 py-1.5 text-xs font-medium',
                  index === activeStoryIndex && 'border-foreground'
                )}
              >
                {game.emoji} {game.title}
              </button>
            ))}
          </div>

          <DiscoverRow title="Because you played puzzle games" items={becauseYouPlayed} />
          <DiscoverRow title="Quick 10-min games" items={quickGames} />
          <DiscoverRow title="Multiplayer tonight" items={multiplayerTonight} />
        </section>
      )}

      {activeTab === 'library' && (
        <section>
          <div className="mb-4 grid gap-3 lg:grid-cols-[1.5fr,1fr]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games, tags, vibes…"
              className="bg-background rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
            />
            <select
              value={librarySort}
              onChange={(event) => setLibrarySort(event.target.value as LibrarySort)}
              className="bg-background rounded-xl border px-3 py-2 text-sm outline-none"
            >
              {LIBRARY_SORTS.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  Sort: {sort.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {LIBRARY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setLibraryFilter(filter.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold',
                  libraryFilter === filter.value
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background hover:bg-accent'
                )}
              >
                {filter.emoji} {filter.label}
              </button>
            ))}
          </div>

          {libraryGames.length === 0 ? (
            <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
              No games match this filter yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {libraryGames.map((game) => {
                const isFavorite = favorites.includes(game.slug)
                return (
                  <article key={game.slug} className="bg-card rounded-2xl border p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h4 className="text-sm font-bold">
                        {game.emoji} {game.title}
                      </h4>
                      <button
                        onClick={() =>
                          setFavorites((prev) =>
                            prev.includes(game.slug)
                              ? prev.filter((slug) => slug !== game.slug)
                              : [...prev, game.slug]
                          )
                        }
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-xs',
                          isFavorite ? 'border-amber-300 bg-amber-100' : 'bg-background'
                        )}
                      >
                        {isFavorite ? '⭐' : '☆'}
                      </button>
                    </div>
                    <p className="text-muted-foreground text-xs">{game.description}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {game.category === 'online-multiplayer' ? '👥 Multiplayer' : '🧩 Solo'} · ~
                      {estimateMinutes(game)} min
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/games/${game.slug}`}
                        className="bg-foreground text-background rounded-full px-3 py-1.5 text-xs font-semibold"
                      >
                        Play
                      </Link>
                      <Link
                        href={`/games/${game.slug}`}
                        className="bg-background hover:bg-accent rounded-full border px-3 py-1.5 text-xs font-semibold"
                      >
                        Details
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
