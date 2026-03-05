export type CardColor = 'red' | 'yellow' | 'green' | 'blue'
export type CardValue =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4'

export interface Card {
  id: string
  color: CardColor | 'wild'
  value: CardValue
}

export type GamePhase = 'lobby' | 'playing' | 'finished'
export type Direction = 1 | -1

export interface Player {
  id: string
  name: string
  isHost: boolean
}

export interface GameState {
  phase: GamePhase
  players: Player[]
  /** Full hands stored for all players — visible to all clients (casual game). */
  hands: Record<string, Card[]>
  drawPile: Card[]
  discardPile: Card[]
  currentPlayerIndex: number
  direction: Direction
  /** Active color — differs from top card's color when a wild is on top. */
  currentColor: CardColor
  /** Accumulated draw count from stacked Draw 2 / Wild Draw 4 cards. */
  pendingDrawCount: number
  /** Player ids who have declared "UNO!". */
  calledUno: string[]
  winnerId: string | null
}

export type GameAction =
  | { type: 'PLAY_CARD'; playerId: string; cardId: string; chosenColor?: CardColor }
  | { type: 'DRAW_CARD'; playerId: string }
  | { type: 'SAY_UNO'; playerId: string }
  | { type: 'START_GAME'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }

const COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue']

// ─── Deck ────────────────────────────────────────────────────────────────────

export function createDeck(): Card[] {
  const cards: Card[] = []
  let id = 0

  for (const color of COLORS) {
    // One 0 per color
    cards.push({ id: String(id++), color, value: 0 })
    // Two each of 1–9
    for (let n = 1; n <= 9; n++) {
      cards.push({ id: String(id++), color, value: n as CardValue })
      cards.push({ id: String(id++), color, value: n as CardValue })
    }
    // Two each of Skip, Reverse, Draw 2
    for (const v of ['skip', 'reverse', 'draw2'] as const) {
      cards.push({ id: String(id++), color, value: v })
      cards.push({ id: String(id++), color, value: v })
    }
  }

  // 4 Wild + 4 Wild Draw 4
  for (let i = 0; i < 4; i++) {
    cards.push({ id: String(id++), color: 'wild', value: 'wild' })
    cards.push({ id: String(id++), color: 'wild', value: 'wild4' })
  }

  return cards // 108 cards total
}

export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export function canPlayCard(card: Card, topCard: Card, currentColor: CardColor): boolean {
  if (card.color === 'wild') return true
  if (card.color === currentColor) return true
  // Same value on a different color (e.g. red-skip on blue-skip)
  if (topCard.color !== 'wild' && card.value === topCard.value) return true
  return false
}

export function getPlayableCards(
  hand: Card[],
  topCard: Card,
  currentColor: CardColor,
  pendingDrawCount: number
): Set<string> {
  const playable = new Set<string>()
  for (const card of hand) {
    if (pendingDrawCount > 0) {
      // When draws are stacked, can only play matching draw cards
      if (card.value === 'draw2' && topCard.value === 'draw2') playable.add(card.id)
      else if (card.value === 'wild4') playable.add(card.id)
    } else if (canPlayCard(card, topCard, currentColor)) {
      playable.add(card.id)
    }
  }
  return playable
}

// ─── Player helpers ──────────────────────────────────────────────────────────

function advancePlayer(index: number, count: number, direction: Direction, steps = 1): number {
  return (((index + direction * steps) % count) + count) % count
}

export function getCurrentPlayer(state: GameState): Player | null {
  return state.players[state.currentPlayerIndex] ?? null
}

export function getTopCard(state: GameState): Card | null {
  return state.discardPile[state.discardPile.length - 1] ?? null
}

// ─── State mutations ─────────────────────────────────────────────────────────

function reshuffleIfNeeded(state: GameState): GameState {
  if (state.drawPile.length > 0) return state
  if (state.discardPile.length <= 1) return state
  // Keep only the top card in the discard pile; reshuffle the rest
  const [top, ...rest] = [...state.discardPile].reverse()
  const reset = rest.map((c) => (c.color === 'wild' ? { ...c } : c))
  return { ...state, drawPile: shuffleDeck(reset), discardPile: [top] }
}

export function createLobbyState(host: Player): GameState {
  return {
    phase: 'lobby',
    players: [host],
    hands: {},
    drawPile: [],
    discardPile: [],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: 'red',
    pendingDrawCount: 0,
    calledUno: [],
    winnerId: null,
  }
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.some((p) => p.id === player.id)) return state
  if (state.players.length >= 10) return state
  return { ...state, players: [...state.players, player] }
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const removedIdx = state.players.findIndex((p) => p.id === playerId)
  const players = state.players.filter((p) => p.id !== playerId)
  let idx = state.currentPlayerIndex
  if (removedIdx !== -1 && removedIdx < idx) idx--
  if (idx >= players.length) idx = 0
  return { ...state, players, currentPlayerIndex: idx }
}

export function startGame(state: GameState): GameState {
  if (state.players.length < 2) return state

  const deck = shuffleDeck(createDeck())
  const hands: Record<string, Card[]> = {}
  const remaining = [...deck]

  for (const player of state.players) {
    hands[player.id] = remaining.splice(0, 7)
  }

  // First card must be a number card to avoid complex start-card rules
  const startIdx = remaining.findIndex((c) => typeof c.value === 'number')
  const startCard = remaining[startIdx]
  remaining.splice(startIdx, 1)

  return {
    ...state,
    phase: 'playing',
    hands,
    drawPile: remaining,
    discardPile: [startCard],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: startCard.color as CardColor,
    pendingDrawCount: 0,
    calledUno: [],
    winnerId: null,
  }
}

// ─── Action dispatcher ───────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction): GameState {
  if (action.type === 'START_GAME') {
    const host = state.players.find((p) => p.isHost)
    if (host?.id !== action.playerId) return state
    return startGame(state)
  }

  if (action.type === 'PLAY_AGAIN') {
    const host = state.players.find((p) => p.isHost)
    if (host?.id !== action.playerId) return state
    if (state.phase !== 'finished') return state
    return startGame({ ...state, phase: 'lobby' })
  }

  if (state.phase !== 'playing') return state

  const currentPlayer = state.players[state.currentPlayerIndex]

  if (action.type === 'SAY_UNO') {
    if (state.calledUno.includes(action.playerId)) return state
    const hand = state.hands[action.playerId] ?? []
    if (hand.length !== 1) return state
    return { ...state, calledUno: [...state.calledUno, action.playerId] }
  }

  if (action.playerId !== currentPlayer.id) return state

  if (action.type === 'DRAW_CARD') {
    const s = reshuffleIfNeeded(state)
    const drawCount = s.pendingDrawCount > 0 ? s.pendingDrawCount : 1
    const actualDraw = Math.min(drawCount, s.drawPile.length)
    const drawn = s.drawPile.slice(0, actualDraw)
    return {
      ...s,
      drawPile: s.drawPile.slice(actualDraw),
      hands: { ...s.hands, [action.playerId]: [...(s.hands[action.playerId] ?? []), ...drawn] },
      pendingDrawCount: 0,
      currentPlayerIndex: advancePlayer(s.currentPlayerIndex, s.players.length, s.direction),
      calledUno: s.calledUno.filter((id) => id !== action.playerId),
    }
  }

  if (action.type === 'PLAY_CARD') {
    const hand = state.hands[action.playerId] ?? []
    const cardIndex = hand.findIndex((c) => c.id === action.cardId)
    if (cardIndex === -1) return state

    const card = hand[cardIndex]
    const topCard = state.discardPile[state.discardPile.length - 1]

    // Stacking validation
    if (state.pendingDrawCount > 0) {
      if (card.value === 'draw2' && topCard.value !== 'draw2') return state
      if (card.value !== 'draw2' && card.value !== 'wild4') return state
    } else if (!canPlayCard(card, topCard, state.currentColor)) {
      return state
    }

    const newHand = hand.filter((_, i) => i !== cardIndex)
    const newDiscardPile = [...state.discardPile, card]
    const newColor: CardColor = card.color === 'wild' ? (action.chosenColor ?? 'red') : card.color

    if (newHand.length === 0) {
      return {
        ...state,
        hands: { ...state.hands, [action.playerId]: newHand },
        discardPile: newDiscardPile,
        currentColor: newColor,
        phase: 'finished',
        winnerId: action.playerId,
      }
    }

    const n = state.players.length
    const idx = state.currentPlayerIndex

    const newState: GameState = {
      ...state,
      hands: { ...state.hands, [action.playerId]: newHand },
      discardPile: newDiscardPile,
      currentColor: newColor,
      calledUno:
        newHand.length !== 1
          ? state.calledUno.filter((id) => id !== action.playerId)
          : state.calledUno,
    }

    switch (card.value) {
      case 'skip':
        newState.currentPlayerIndex = advancePlayer(idx, n, state.direction, 2)
        break
      case 'reverse':
        newState.direction = (state.direction * -1) as Direction
        if (n === 2) {
          // In 2-player, Reverse acts as Skip — current player goes again
          newState.currentPlayerIndex = idx
        } else {
          newState.currentPlayerIndex = advancePlayer(idx, n, newState.direction)
        }
        break
      case 'draw2':
        newState.pendingDrawCount = state.pendingDrawCount + 2
        newState.currentPlayerIndex = advancePlayer(idx, n, state.direction)
        break
      case 'wild4':
        newState.pendingDrawCount = state.pendingDrawCount + 4
        newState.currentPlayerIndex = advancePlayer(idx, n, state.direction)
        break
      default:
        newState.currentPlayerIndex = advancePlayer(idx, n, state.direction)
    }

    return newState
  }

  return state
}
