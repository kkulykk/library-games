export interface MemoryCard {
  id: number
  symbol: string
  flipped: boolean
  matched: boolean
}

const SYMBOLS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸']

export function createDeck(pairs: number): MemoryCard[] {
  const symbols = SYMBOLS.slice(0, pairs)
  const cards: MemoryCard[] = []
  let id = 0
  for (const symbol of symbols) {
    cards.push({ id: id++, symbol, flipped: false, matched: false })
    cards.push({ id: id++, symbol, flipped: false, matched: false })
  }
  return shuffleCards(cards)
}

export function shuffleCards(cards: MemoryCard[]): MemoryCard[] {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function flipCard(cards: MemoryCard[], id: number): MemoryCard[] {
  return cards.map((card) => (card.id === id ? { ...card, flipped: true } : card))
}

export function checkMatch(cards: MemoryCard[], id1: number, id2: number): MemoryCard[] {
  const card1 = cards.find((c) => c.id === id1)
  const card2 = cards.find((c) => c.id === id2)
  if (!card1 || !card2) return cards

  if (card1.symbol === card2.symbol) {
    return cards.map((c) => (c.id === id1 || c.id === id2 ? { ...c, matched: true } : c))
  }
  // Unflip non-matched cards
  return cards.map((c) =>
    (c.id === id1 || c.id === id2) && !c.matched ? { ...c, flipped: false } : c
  )
}

export function isGameComplete(cards: MemoryCard[]): boolean {
  return cards.every((c) => c.matched)
}

export function countMoves(flips: number): number {
  return Math.floor(flips / 2)
}
