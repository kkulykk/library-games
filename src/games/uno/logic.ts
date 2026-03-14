import type { GameState } from './schema'
export type { GameState }

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

export type GameAction =
  | { type: 'PLAY_CARD'; playerId: string; cardId: string; chosenColor?: CardColor; now?: number }
  | { type: 'DRAW_CARD'; playerId: string }
  | { type: 'PASS_AFTER_DRAW'; playerId: string }
  | { type: 'SAY_UNO'; playerId: string }
  | { type: 'CATCH_UNO'; playerId: string; targetId: string; now?: number }
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

/** Wild Draw 4 may only be played when the player has no cards matching the current color. */
export function canPlayWild4(hand: Card[], cardId: string, currentColor: CardColor): boolean {
  return !hand.some((c) => c.id !== cardId && c.color === currentColor)
}

export function getPlayableCards(
  hand: Card[],
  topCard: Card,
  currentColor: CardColor,
  pendingDrawCount: number,
  drawnCardId?: string | null
): Set<string> {
  // When draws are pending, player must draw — no cards are playable
  if (pendingDrawCount > 0) return new Set()

  // If a card was just drawn, only that card may be played
  if (drawnCardId) {
    const card = hand.find((c) => c.id === drawnCardId)
    if (!card) return new Set()
    if (card.value === 'wild4') {
      return canPlayWild4(hand, card.id, currentColor) ? new Set([card.id]) : new Set()
    }
    return canPlayCard(card, topCard, currentColor) ? new Set([card.id]) : new Set()
  }

  const playable = new Set<string>()
  for (const card of hand) {
    if (card.value === 'wild4') {
      if (canPlayWild4(hand, card.id, currentColor)) playable.add(card.id)
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
    drawnCardId: null,
    unoWindow: {},
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
    drawnCardId: null,
    unoWindow: {},
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

  // SAY_UNO — any player can call it for themselves
  if (action.type === 'SAY_UNO') {
    if (state.calledUno.includes(action.playerId)) return state
    const hand = state.hands[action.playerId] ?? []
    if (hand.length !== 1) return state
    return { ...state, calledUno: [...state.calledUno, action.playerId] }
  }

  // CATCH_UNO — any player can catch another who forgot to say UNO
  if (action.type === 'CATCH_UNO') {
    const target = state.players.find((p) => p.id === action.targetId)
    if (!target) return state
    if (action.playerId === action.targetId) return state
    const targetHand = state.hands[action.targetId] ?? []
    if (targetHand.length !== 1) return state
    if (state.calledUno.includes(action.targetId)) return state
    // Respect the grace window — give the player time to say UNO themselves
    const catchTs = action.now ?? Date.now()
    if (catchTs < (state.unoWindow[action.targetId] ?? 0)) return state

    // Penalty: target draws 2 cards
    const s = reshuffleIfNeeded(state)
    const actualDraw = Math.min(2, s.drawPile.length)
    const drawn = s.drawPile.slice(0, actualDraw)
    return {
      ...s,
      drawPile: s.drawPile.slice(actualDraw),
      hands: { ...s.hands, [action.targetId]: [...targetHand, ...drawn] },
    }
  }

  // Everything below requires it to be the player's turn
  if (action.playerId !== currentPlayer.id) return state

  // PASS_AFTER_DRAW — decline to play the drawn card
  if (action.type === 'PASS_AFTER_DRAW') {
    if (!state.drawnCardId) return state
    return {
      ...state,
      drawnCardId: null,
      currentPlayerIndex: advancePlayer(
        state.currentPlayerIndex,
        state.players.length,
        state.direction
      ),
    }
  }

  // DRAW_CARD
  if (action.type === 'DRAW_CARD') {
    if (state.drawnCardId) return state // already drew, must play or pass

    const s = reshuffleIfNeeded(state)

    // Forced draw from Draw 2 / Wild Draw 4
    if (s.pendingDrawCount > 0) {
      const actualDraw = Math.min(s.pendingDrawCount, s.drawPile.length)
      const drawn = s.drawPile.slice(0, actualDraw)
      return {
        ...s,
        drawPile: s.drawPile.slice(actualDraw),
        hands: { ...s.hands, [action.playerId]: [...(s.hands[action.playerId] ?? []), ...drawn] },
        pendingDrawCount: 0,
        drawnCardId: null,
        currentPlayerIndex: advancePlayer(s.currentPlayerIndex, s.players.length, s.direction),
        calledUno: s.calledUno.filter((id) => id !== action.playerId),
      }
    }

    // Voluntary draw: 1 card
    if (s.drawPile.length === 0) return s
    const drawnCard = s.drawPile[0]
    const newHand = [...(s.hands[action.playerId] ?? []), drawnCard]
    const topCard = getTopCard(s)

    // Check if drawn card is playable
    let isPlayable = false
    if (topCard) {
      if (drawnCard.value === 'wild4') {
        isPlayable = canPlayWild4(newHand, drawnCard.id, s.currentColor)
      } else {
        isPlayable = canPlayCard(drawnCard, topCard, s.currentColor)
      }
    }

    const base = {
      ...s,
      drawPile: s.drawPile.slice(1),
      hands: { ...s.hands, [action.playerId]: newHand },
      calledUno: s.calledUno.filter((id) => id !== action.playerId),
    }

    if (isPlayable) {
      return { ...base, drawnCardId: drawnCard.id }
    }

    return {
      ...base,
      drawnCardId: null,
      currentPlayerIndex: advancePlayer(s.currentPlayerIndex, s.players.length, s.direction),
    }
  }

  // PLAY_CARD
  if (action.type === 'PLAY_CARD') {
    const hand = state.hands[action.playerId] ?? []
    const cardIndex = hand.findIndex((c) => c.id === action.cardId)
    if (cardIndex === -1) return state

    const card = hand[cardIndex]
    const topCard = state.discardPile[state.discardPile.length - 1]

    // If a card was just drawn, can only play that specific card
    if (state.drawnCardId && card.id !== state.drawnCardId) return state

    // Cannot play cards while forced draw is pending
    if (state.pendingDrawCount > 0) return state

    // Validate the play
    if (card.value === 'wild4') {
      if (!canPlayWild4(hand, card.id, state.currentColor)) return state
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
        drawnCardId: null,
      }
    }

    const n = state.players.length
    const idx = state.currentPlayerIndex

    const newState: GameState = {
      ...state,
      hands: { ...state.hands, [action.playerId]: newHand },
      discardPile: newDiscardPile,
      currentColor: newColor,
      drawnCardId: null,
      calledUno:
        newHand.length !== 1
          ? state.calledUno.filter((id) => id !== action.playerId)
          : state.calledUno,
      // Grant a 1-second grace window when a player plays down to 1 card
      unoWindow:
        newHand.length === 1
          ? { ...state.unoWindow, [action.playerId]: (action.now ?? Date.now()) + 1000 }
          : { ...state.unoWindow, [action.playerId]: 0 },
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
        newState.pendingDrawCount = 2
        newState.currentPlayerIndex = advancePlayer(idx, n, state.direction)
        break
      case 'wild4':
        newState.pendingDrawCount = 4
        newState.currentPlayerIndex = advancePlayer(idx, n, state.direction)
        break
      default:
        newState.currentPlayerIndex = advancePlayer(idx, n, state.direction)
    }

    return newState
  }

  return state
}
