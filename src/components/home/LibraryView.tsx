'use client'

import Link from 'next/link'
import { type CSSProperties, useMemo, useState } from 'react'
import { type GameMeta } from '@/data/games'

import { GamePoster } from './GamePoster'

const FILTERS = [
  { value: 'all', label: 'ALL' },
  { value: 'single-player', label: 'SOLO' },
  { value: 'online-multiplayer', label: 'MULTIPLAYER' },
  { value: 'puzzle', label: 'PUZZLE' },
  { value: 'arcade', label: 'ARCADE' },
  { value: 'party', label: 'PARTY' },
  { value: 'word', label: 'WORD' },
  { value: 'cards', label: 'CARDS' },
] as const

type FilterValue = (typeof FILTERS)[number]['value']

const SORTS = [
  { value: 'popular', label: 'POPULAR' },
  { value: 'az', label: 'A–Z' },
  { value: 'quick', label: 'QUICKEST' },
  { value: 'rating', label: 'RATING' },
] as const

type SortValue = (typeof SORTS)[number]['value']

const SIZE_PATTERN = [
  'xl',
  'm',
  'm',
  'l',
  's',
  'm',
  's',
  'l',
  'm',
  's',
  'xl',
  'm',
  's',
  'm',
  'l',
  's',
] as const

function matchesFilter(g: GameMeta, f: FilterValue): boolean {
  if (f === 'all') return true
  if (f === 'single-player' || f === 'online-multiplayer') return g.category === f
  return g.tags.includes(f)
}

function parsePlays(s: string): number {
  if (s === '—') return 0
  const n = parseFloat(s)
  if (s.includes('M')) return n * 1e6
  if (s.includes('K')) return n * 1e3
  return n
}

function sortBy(list: GameMeta[], s: SortValue): GameMeta[] {
  const copy = list.slice()
  if (s === 'az') return copy.sort((a, b) => a.title.localeCompare(b.title))
  if (s === 'quick') return copy.sort((a, b) => a.minutes - b.minutes)
  if (s === 'rating') return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  return copy.sort((a, b) => parsePlays(b.plays) - parsePlays(a.plays))
}

function LibraryTile({ game, size }: { game: GameMeta; size: string }) {
  const isComingSoon = game.status === 'coming-soon'
  const tile = (
    <>
      <div className="tile-poster">
        <GamePoster slug={game.slug} />
      </div>
      <div className="tile-overlay">
        <div className="tile-top mono">
          <span className="tile-genre">{game.genre}</span>
          {isComingSoon ? (
            <span className="tile-soon">SOON</span>
          ) : (
            <span className="tile-rating">{game.rating} ★</span>
          )}
        </div>
        <div className="tile-bottom">
          <h3 className="tile-title">{game.title}</h3>
          <div className="tile-meta mono">
            <span>{game.players} PLAYERS</span>
            <span>·</span>
            <span>{game.minutes} MIN</span>
          </div>
        </div>
        <div className="tile-play">
          <span className="tile-play-icon">▶</span>
          <span className="tile-play-text">PLAY</span>
        </div>
      </div>
    </>
  )

  const style = { ['--hue' as string]: game.hue } as CSSProperties

  if (isComingSoon) {
    return (
      <div className={`tile tile-${size}`} style={style} aria-disabled="true">
        {tile}
      </div>
    )
  }

  return (
    <Link href={`/games/${game.slug}`} className={`tile tile-${size}`} style={style}>
      {tile}
    </Link>
  )
}

interface LibraryViewProps {
  games: GameMeta[]
}

export function LibraryView({ games }: LibraryViewProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [sort, setSort] = useState<SortValue>('popular')

  const filtered = useMemo(() => {
    let list = games.filter((g) => matchesFilter(g, filter))
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((g) =>
        `${g.title} ${g.description} ${g.tags.join(' ')} ${g.genre}`.toLowerCase().includes(q)
      )
    }
    return sortBy(list, sort)
  }, [games, query, filter, sort])

  const stats = useMemo(() => {
    const live = games.filter((g) => g.status === 'live').length
    return {
      total: games.length,
      live,
      solo: games.filter((g) => g.category === 'single-player').length,
      multi: games.filter((g) => g.category === 'online-multiplayer').length,
    }
  }, [games])

  return (
    <div className="library">
      <header className="lib-hero">
        <div className="lib-hero-inner">
          <div>
            <p className="mono lib-eyebrow">/ LIBRARY · INDEX</p>
            <h1 className="lib-title">
              {stats.total === 18 ? 'Eighteen' : stats.total} games.
              <br />
              <em>One shelf.</em>
            </h1>
          </div>
          <div className="lib-stats">
            <div className="lib-stat">
              <span className="lib-stat-n">{stats.total}</span>
              <span className="lib-stat-l mono">TITLES</span>
            </div>
            <div className="lib-stat">
              <span className="lib-stat-n">{stats.live}</span>
              <span className="lib-stat-l mono">LIVE NOW</span>
            </div>
            <div className="lib-stat">
              <span className="lib-stat-n">{stats.solo}</span>
              <span className="lib-stat-l mono">SOLO</span>
            </div>
            <div className="lib-stat">
              <span className="lib-stat-n">{stats.multi}</span>
              <span className="lib-stat-l mono">MULTI</span>
            </div>
          </div>
        </div>
      </header>

      <div className="lib-toolbar">
        <div className="lib-search">
          <span className="lib-search-icon">⌕</span>
          <input
            className="lib-input"
            placeholder="Search titles, genres, vibes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="lib-clear" onClick={() => setQuery('')} aria-label="Clear search">
              ×
            </button>
          )}
          <span className="lib-kbd mono">⌘ K</span>
        </div>
        <div className="lib-sort">
          <span className="mono lib-sort-label">SORT</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              className={`lib-sort-btn mono ${sort === s.value ? 'is-on' : ''}`}
              onClick={() => setSort(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lib-filters">
        {FILTERS.map((f) => {
          const count =
            f.value === 'all' ? games.length : games.filter((g) => matchesFilter(g, f.value)).length
          return (
            <button
              key={f.value}
              className={`chip mono ${filter === f.value ? 'is-on' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label} <span className="chip-count">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="lib-resultbar mono">
        <span>
          SHOWING <b>{filtered.length}</b> OF {games.length}
        </span>
        {query && (
          <span>
            — MATCHING &ldquo;<b>{query}</b>&rdquo;
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          SORT: {SORTS.find((s) => s.value === sort)?.label}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="lib-empty">
          <div className="mono lib-empty-mono">NO MATCH · 404</div>
          <p>Nothing on the shelf for &ldquo;{query}&rdquo;. Try a different vibe.</p>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            RESET
          </button>
        </div>
      ) : (
        <div className="lib-mosaic">
          {filtered.map((g, i) => (
            <LibraryTile key={g.slug} game={g} size={SIZE_PATTERN[i % SIZE_PATTERN.length]} />
          ))}
        </div>
      )}

      <footer className="lib-footer mono">
        <span>/ END OF SHELF</span>
        <span>LIBRARY · GAMES · BUILT FOR PLAY</span>
        <span>
          {filtered.length} / {games.length}
        </span>
      </footer>
    </div>
  )
}
