import { BLACK_CARDS, WHITE_CARDS } from './cards'
import type { GameState } from './schema'
export type { GameState }

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string
  name: string
  isHost: boolean
}

export type GamePhase = 'lobby' | 'playing' | 'judging' | 'reveal' | 'finished'

export type GameAction =
  | { type: 'START_GAME'; playerId: string }
  | { type: 'SUBMIT_CARDS'; playerId: string; cardIndices: number[] }
  | { type: 'REVEAL_NEXT'; playerId: string }
  | { type: 'PICK_WINNER'; playerId: string; winnerId: string }
  | { type: 'NEXT_ROUND'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function drawCards(deck: number[], count: number): { drawn: number[]; remaining: number[] } {
  const drawn = deck.slice(0, count)
  const remaining = deck.slice(count)
  return { drawn, remaining }
}

// ─── State creation ─────────────────────────────────────────────────────────

export function createLobbyState(host: Player): GameState {
  return {
    phase: 'lobby',
    players: [host],
    czarIndex: 0,
    blackCard: null,
    hands: {},
    submissions: {},
    submittedPlayerIds: [],
    shuffledSubmissions: [],
    revealOrder: [],
    revealIndex: -1,
    roundWinnerId: null,
    roundWinnerCards: [],
    scores: {},
    pointsToWin: 7,
    winnerId: null,
    blackDeck: [],
    whiteDeck: [],
    handSize: 10,
    _rm: '',
  }
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.some((p) => p.id === player.id)) return state
  if (state.players.length >= 10) return state
  return { ...state, players: [...state.players, player] }
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const players = state.players.filter((p) => p.id !== playerId)
  let czarIndex = state.czarIndex
  const removedIdx = state.players.findIndex((p) => p.id === playerId)
  if (removedIdx !== -1 && removedIdx < czarIndex) czarIndex--
  if (czarIndex >= players.length) czarIndex = 0
  return { ...state, players, czarIndex }
}

// ─── Game start ─────────────────────────────────────────────────────────────

export function startGame(state: GameState): GameState {
  if (state.players.length < 3) return state

  const blackDeck = shuffle(BLACK_CARDS.map((_, i) => i))
  const whiteDeck = shuffle(WHITE_CARDS.map((_, i) => i))

  const hands: Record<string, number[]> = {}
  let remaining = [...whiteDeck]

  for (const player of state.players) {
    const { drawn, remaining: rest } = drawCards(remaining, state.handSize)
    hands[player.id] = drawn
    remaining = rest
  }

  // Draw first black card
  const blackCardIndex = blackDeck[0]
  const blackCard = BLACK_CARDS[blackCardIndex]

  const scores: Record<string, number> = {}
  for (const player of state.players) {
    scores[player.id] = 0
  }

  return {
    ...state,
    phase: 'playing',
    czarIndex: 0,
    blackCard,
    hands,
    submissions: {},
    submittedPlayerIds: [],
    shuffledSubmissions: [],
    revealOrder: [],
    revealIndex: -1,
    roundWinnerId: null,
    roundWinnerCards: [],
    scores,
    winnerId: null,
    blackDeck: blackDeck.slice(1),
    whiteDeck: remaining,
    _rm: '',
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function getCzar(state: GameState): Player | null {
  return state.players[state.czarIndex] ?? null
}

export function isCzar(state: GameState, playerId: string): boolean {
  return getCzar(state)?.id === playerId
}

export function getNonCzarPlayers(state: GameState): Player[] {
  return state.players.filter((_, i) => i !== state.czarIndex)
}

export function hasSubmitted(state: GameState, playerId: string): boolean {
  return state.submittedPlayerIds.includes(playerId)
}

export function allSubmitted(state: GameState): boolean {
  const nonCzar = getNonCzarPlayers(state)
  return nonCzar.every((p) => state.submittedPlayerIds.includes(p.id))
}

export function getWhiteCardText(index: number): string {
  return WHITE_CARDS[index] ?? ''
}

// ─── Action dispatcher ──────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction): GameState {
  if (action.type === 'START_GAME') {
    const host = state.players.find((p) => p.isHost)
    if (host?.id !== action.playerId) return state
    if (state.phase !== 'lobby') return state
    return startGame(state)
  }

  if (action.type === 'PLAY_AGAIN') {
    const host = state.players.find((p) => p.isHost)
    if (host?.id !== action.playerId) return state
    if (state.phase !== 'finished') return state
    return startGame({ ...state, phase: 'lobby' })
  }

  if (action.type === 'SUBMIT_CARDS') {
    if (state.phase !== 'playing') return state
    if (isCzar(state, action.playerId)) return state
    if (hasSubmitted(state, action.playerId)) return state
    if (!state.blackCard) return state

    const hand = state.hands[action.playerId]
    if (!hand) return state

    // Validate: correct number of cards and all from hand
    if (action.cardIndices.length !== state.blackCard.pick) return state
    if (!action.cardIndices.every((idx) => hand.includes(idx))) return state
    // No duplicates
    if (new Set(action.cardIndices).size !== action.cardIndices.length) return state

    const newHand = hand.filter((idx) => !action.cardIndices.includes(idx))
    const newSubmissions = { ...state.submissions, [action.playerId]: action.cardIndices }
    const newHands = { ...state.hands, [action.playerId]: newHand }
    const newSubmittedIds = [...state.submittedPlayerIds, action.playerId]

    // Check if all non-czar players have submitted
    const nonCzar = getNonCzarPlayers(state)
    const allDone = nonCzar.every((p) => newSubmittedIds.includes(p.id))

    if (allDone) {
      // Move to judging phase — anonymize submissions so clients can't see
      // which player submitted which cards
      const playerOrder = shuffle(Object.keys(newSubmissions))
      const shuffledSubmissions = playerOrder.map((pid) => newSubmissions[pid])
      const revealOrder = playerOrder.map((_, i) => String(i))
      const _rm = btoa(JSON.stringify(playerOrder))
      return {
        ...state,
        hands: newHands,
        submissions: {},
        submittedPlayerIds: newSubmittedIds,
        shuffledSubmissions,
        phase: 'judging',
        revealOrder,
        revealIndex: -1,
        _rm,
      }
    }

    return {
      ...state,
      hands: newHands,
      submissions: newSubmissions,
      submittedPlayerIds: newSubmittedIds,
    }
  }

  if (action.type === 'REVEAL_NEXT') {
    if (state.phase !== 'judging') return state
    if (!isCzar(state, action.playerId)) return state
    if (state.revealIndex >= state.revealOrder.length - 1) return state

    return {
      ...state,
      revealIndex: state.revealIndex + 1,
    }
  }

  if (action.type === 'PICK_WINNER') {
    if (state.phase !== 'judging') return state
    if (!isCzar(state, action.playerId)) return state
    // Must have revealed all submissions
    if (state.revealIndex < state.revealOrder.length - 1) return state
    if (!state.revealOrder.includes(action.winnerId)) return state

    // Decode anonymous mapping to find the actual player ID
    const winnerIdx = parseInt(action.winnerId, 10)
    const playerOrder: string[] = state._rm ? JSON.parse(atob(state._rm)) : []
    const actualWinnerId = playerOrder[winnerIdx]
    if (!actualWinnerId) return state

    const winnerCards = state.shuffledSubmissions[winnerIdx] ?? []

    const newScores = { ...state.scores }
    newScores[actualWinnerId] = (newScores[actualWinnerId] ?? 0) + 1

    const isGameOver = newScores[actualWinnerId] >= state.pointsToWin

    return {
      ...state,
      phase: isGameOver ? 'finished' : 'reveal',
      roundWinnerId: actualWinnerId,
      roundWinnerCards: winnerCards,
      scores: newScores,
      winnerId: isGameOver ? actualWinnerId : null,
    }
  }

  if (action.type === 'REMOVE_PLAYER') {
    const idx = state.players.findIndex((p) => p.id === action.playerId)
    if (idx === -1) return state

    // In lobby, just remove the player (reassign host if needed)
    if (state.phase === 'lobby') {
      const updated = removePlayer(state, action.playerId)
      if (updated.players.length === 0) return updated
      const needsHost = !updated.players.some((p) => p.isHost)
      if (needsHost) {
        const players = updated.players.map((p, i) => (i === 0 ? { ...p, isHost: true } : p))
        return { ...updated, players }
      }
      return updated
    }

    // During active game: remove and clean up
    let updated = removePlayer(state, action.playerId)
    const hands = Object.fromEntries(
      Object.entries(state.hands).filter(([id]) => id !== action.playerId)
    )
    const submissions = Object.fromEntries(
      Object.entries(state.submissions).filter(([id]) => id !== action.playerId)
    )
    const scores = Object.fromEntries(
      Object.entries(state.scores).filter(([id]) => id !== action.playerId)
    )
    const submittedPlayerIds = state.submittedPlayerIds.filter((id) => id !== action.playerId)

    // If in judging phase, update anonymized submissions
    let { shuffledSubmissions, _rm } = state
    if (state.phase === 'judging' && state._rm) {
      const playerOrder: string[] = JSON.parse(atob(state._rm))
      const removeIdx = playerOrder.indexOf(action.playerId)
      if (removeIdx !== -1) {
        const newPlayerOrder = playerOrder.filter((_, i) => i !== removeIdx)
        shuffledSubmissions = state.shuffledSubmissions.filter((_, i) => i !== removeIdx)
        _rm = btoa(JSON.stringify(newPlayerOrder))
      }
    }

    updated = {
      ...updated,
      hands,
      submissions,
      scores,
      submittedPlayerIds,
      shuffledSubmissions,
      _rm,
    }

    // If fewer than 3 players remain, end the game
    if (updated.players.length < 3) {
      return { ...updated, phase: 'finished', winnerId: null }
    }

    // Reassign host if the removed player was the host
    const needsHost = !updated.players.some((p) => p.isHost)
    if (needsHost) {
      const players = updated.players.map((p, i) => (i === 0 ? { ...p, isHost: true } : p))
      updated = { ...updated, players }
    }

    // If the removed player was the czar, skip to a new round
    if (isCzar(state, action.playerId)) {
      const blackDeck = [...updated.blackDeck]
      const blackCard = blackDeck.length > 0 ? BLACK_CARDS[blackDeck[0]] : updated.blackCard
      const newBlackDeck = blackDeck.length > 0 ? blackDeck.slice(1) : blackDeck
      return {
        ...updated,
        phase: 'playing',
        blackCard,
        blackDeck: newBlackDeck,
        submissions: {},
        submittedPlayerIds: [],
        shuffledSubmissions: [],
        revealOrder: [],
        revealIndex: -1,
        roundWinnerId: null,
        roundWinnerCards: [],
        _rm: '',
      }
    }

    // If the removed player hadn't submitted yet during playing phase, check if all remaining have
    if (updated.phase === 'playing') {
      const nonCzar = getNonCzarPlayers(updated)
      const allDone = nonCzar.every((p) => updated.submittedPlayerIds.includes(p.id))
      if (allDone && nonCzar.length > 0) {
        const playerOrder = shuffle(Object.keys(updated.submissions))
        const anonSubmissions = playerOrder.map((pid) => updated.submissions[pid])
        const revealOrder = playerOrder.map((_, i) => String(i))
        const encodedMap = btoa(JSON.stringify(playerOrder))
        return {
          ...updated,
          phase: 'judging',
          submissions: {},
          shuffledSubmissions: anonSubmissions,
          revealOrder,
          revealIndex: -1,
          _rm: encodedMap,
        }
      }
    }

    return updated
  }

  if (action.type === 'NEXT_ROUND') {
    if (state.phase !== 'reveal') return state
    if (!isCzar(state, action.playerId)) return state

    // Advance czar
    const nextCzarIndex = (state.czarIndex + 1) % state.players.length

    // Draw new black card
    let blackDeck = [...state.blackDeck]
    if (blackDeck.length === 0) {
      // Reshuffle
      blackDeck = shuffle(BLACK_CARDS.map((_, i) => i))
    }
    const blackCard = BLACK_CARDS[blackDeck[0]]

    // Deal cards to fill hands back up
    const hands = { ...state.hands }
    let whiteDeck = [...state.whiteDeck]

    for (const player of state.players) {
      const hand = hands[player.id] ?? []
      const need = state.handSize - hand.length
      if (need > 0) {
        if (whiteDeck.length < need) {
          // Reshuffle used white cards (exclude cards in hands)
          const inHands = new Set(Object.values(hands).flat())
          const available = WHITE_CARDS.map((_, i) => i).filter((i) => !inHands.has(i))
          whiteDeck = shuffle(available)
        }
        const { drawn, remaining } = drawCards(whiteDeck, need)
        hands[player.id] = [...hand, ...drawn]
        whiteDeck = remaining
      }
    }

    return {
      ...state,
      phase: 'playing',
      czarIndex: nextCzarIndex,
      blackCard,
      blackDeck: blackDeck.slice(1),
      whiteDeck,
      hands,
      submissions: {},
      submittedPlayerIds: [],
      shuffledSubmissions: [],
      revealOrder: [],
      revealIndex: -1,
      roundWinnerId: null,
      roundWinnerCards: [],
      _rm: '',
    }
  }

  return state
}
