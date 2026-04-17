import { type GameMeta } from '@/data/games'

export type LibraryFilter = 'all' | 'single-player' | 'online-multiplayer' | 'party' | 'chill'

export type LibrarySort = 'popular' | 'a-z' | 'quick'

const DURATION_BY_TAG: Record<string, number> = {
  puzzle: 12,
  word: 10,
  arcade: 8,
  classic: 10,
  memory: 8,
  cards: 20,
  strategy: 25,
  drawing: 18,
  party: 20,
  numbers: 12,
  multiplayer: 20,
}

export function estimateMinutes(game: GameMeta): number {
  if (game.category === 'online-multiplayer') return 20
  const tagMinutes = game.tags
    .map((tag) => DURATION_BY_TAG[tag])
    .filter((value): value is number => typeof value === 'number')

  if (tagMinutes.length === 0) return 12

  const avg = tagMinutes.reduce((sum, value) => sum + value, 0) / tagMinutes.length
  return Math.max(5, Math.round(avg))
}

export function matchesLibraryFilter(game: GameMeta, filter: LibraryFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'single-player' || filter === 'online-multiplayer') return game.category === filter
  if (filter === 'party') return game.tags.includes('party') || game.tags.includes('drawing')
  if (filter === 'chill') {
    return (
      game.tags.includes('puzzle') ||
      game.tags.includes('word') ||
      game.tags.includes('memory') ||
      game.tags.includes('classic')
    )
  }
  return true
}

export function sortLibraryGames(games: GameMeta[], sort: LibrarySort): GameMeta[] {
  const copy = [...games]

  if (sort === 'a-z') {
    return copy.sort((a, b) => a.title.localeCompare(b.title))
  }

  if (sort === 'quick') {
    return copy.sort((a, b) => estimateMinutes(a) - estimateMinutes(b))
  }

  // popular
  return copy.sort((a, b) => {
    const multiplayerScoreA = a.category === 'online-multiplayer' ? 1 : 0
    const multiplayerScoreB = b.category === 'online-multiplayer' ? 1 : 0
    if (multiplayerScoreA !== multiplayerScoreB) return multiplayerScoreB - multiplayerScoreA

    const partyScoreA = a.tags.includes('party') ? 1 : 0
    const partyScoreB = b.tags.includes('party') ? 1 : 0
    if (partyScoreA !== partyScoreB) return partyScoreB - partyScoreA

    return a.title.localeCompare(b.title)
  })
}
