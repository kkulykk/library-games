import { createDeck, flipCard, checkMatch, isGameComplete, countMoves } from './logic'

describe('createDeck', () => {
  it('creates 2x pairs of cards', () => {
    const deck = createDeck(6)
    expect(deck.length).toBe(12)
  })

  it('each symbol appears exactly twice', () => {
    const deck = createDeck(6)
    const symbolCounts: Record<string, number> = {}
    deck.forEach((c) => {
      symbolCounts[c.symbol] = (symbolCounts[c.symbol] ?? 0) + 1
    })
    Object.values(symbolCounts).forEach((count) => expect(count).toBe(2))
  })

  it('cards start face-down and unmatched', () => {
    const deck = createDeck(6)
    deck.forEach((c) => {
      expect(c.flipped).toBe(false)
      expect(c.matched).toBe(false)
    })
  })
})

describe('flipCard', () => {
  it('flips the specified card', () => {
    const deck = createDeck(4)
    const id = deck[0].id
    const flipped = flipCard(deck, id)
    expect(flipped.find((c) => c.id === id)?.flipped).toBe(true)
  })

  it('does not flip other cards', () => {
    const deck = createDeck(4)
    const id = deck[0].id
    const flipped = flipCard(deck, id)
    flipped.filter((c) => c.id !== id).forEach((c) => expect(c.flipped).toBe(false))
  })
})

describe('checkMatch', () => {
  it('marks both cards as matched when symbols are equal', () => {
    const deck = createDeck(4)
    // Find two cards with the same symbol
    const symbol = deck[0].symbol
    const pair = deck.filter((c) => c.symbol === symbol)
    expect(pair.length).toBe(2)
    const [id1, id2] = pair.map((c) => c.id)
    const result = checkMatch(deck, id1, id2)
    expect(result.find((c) => c.id === id1)?.matched).toBe(true)
    expect(result.find((c) => c.id === id2)?.matched).toBe(true)
  })

  it('unflips cards when they do not match', () => {
    const deck = createDeck(4)
    // Find two cards with different symbols
    const [card1] = deck
    const card2 = deck.find((c) => c.symbol !== card1.symbol)!
    // Flip both
    let updated = flipCard(deck, card1.id)
    updated = flipCard(updated, card2.id)
    updated = checkMatch(updated, card1.id, card2.id)
    expect(updated.find((c) => c.id === card1.id)?.flipped).toBe(false)
    expect(updated.find((c) => c.id === card2.id)?.flipped).toBe(false)
  })
})

describe('isGameComplete', () => {
  it('returns false when not all cards are matched', () => {
    const deck = createDeck(4)
    expect(isGameComplete(deck)).toBe(false)
  })

  it('returns true when all cards are matched', () => {
    const deck = createDeck(4).map((c) => ({ ...c, matched: true }))
    expect(isGameComplete(deck)).toBe(true)
  })
})

describe('countMoves', () => {
  it('counts pairs of flips as moves', () => {
    expect(countMoves(4)).toBe(2)
    expect(countMoves(6)).toBe(3)
  })

  it('returns 0 for 0 flips', () => {
    expect(countMoves(0)).toBe(0)
  })
})
