import { games } from '@/data/games'
import {
  estimateMinutes,
  matchesLibraryFilter,
  sortLibraryGames,
  type LibraryFilter,
} from './home-experience.logic'

describe('home-experience.logic', () => {
  const wordle = games.find((game) => game.slug === 'wordle')
  const mindmeld = games.find((game) => game.slug === 'mindmeld')
  const cah = games.find((game) => game.slug === 'cards-against-humanity')

  if (!wordle || !mindmeld || !cah) {
    throw new Error('Fixture games missing from games.ts')
  }

  it('estimates longer sessions for multiplayer games', () => {
    expect(estimateMinutes(wordle)).toBeLessThan(estimateMinutes(mindmeld))
  })

  it('matches party filter for party and drawing games', () => {
    expect(matchesLibraryFilter(cah, 'party')).toBe(true)
    expect(matchesLibraryFilter(mindmeld, 'party')).toBe(true)
    expect(matchesLibraryFilter(wordle, 'party')).toBe(false)
  })

  it('supports category filters', () => {
    const filters: LibraryFilter[] = ['single-player', 'online-multiplayer']

    for (const filter of filters) {
      const filtered = games.filter(
        (game) => game.status === 'live' && matchesLibraryFilter(game, filter)
      )
      expect(filtered.every((game) => game.category === filter)).toBe(true)
    }
  })

  it('sorts quick mode by estimated duration ascending', () => {
    const sample = games.filter((game) => game.status === 'live').slice(0, 6)
    const sorted = sortLibraryGames(sample, 'quick')

    for (let i = 1; i < sorted.length; i += 1) {
      expect(estimateMinutes(sorted[i - 1])).toBeLessThanOrEqual(estimateMinutes(sorted[i]))
    }
  })
})
