// eslint-disable-next-line @typescript-eslint/no-require-imports
const cahCards = require('cah-cards') as {
  black: Array<{ text: string; pick?: number }>
  white: Array<{ text: string }>
}

export interface BlackCard {
  text: string
  pick: number
}

export interface WhiteCard {
  text: string
}

export type GamePhase = 'lobby' | 'playing' | 'judging' | 'round_end' | 'finished'

export interface Player {
  id: string
  name: string
  isHost: boolean
  score: number
}

export interface GameState {
  phase: GamePhase
  players: Player[]
  czarIndex: number
  whiteDrawPile: WhiteCard[]
  blackDrawPile: BlackCard[]
  currentBlackCard: BlackCard | null
  /** playerId → white cards in hand */
  hands: Record<string, WhiteCard[]>
  /** playerId → cards submitted this round */
  submissions: Record<string, WhiteCard[]>
  /** Shuffled playerIds for anonymous judging display */
  judgeOrder: string[]
  roundWinnerId: string | null
  winnerId: string | null
  pointsToWin: number
}

export type GameAction =
  | { type: 'START_GAME'; playerId: string; pointsToWin?: number }
  | { type: 'SUBMIT_CARDS'; playerId: string; cards: WhiteCard[] }
  | { type: 'JUDGE_WINNER'; playerId: string; winnerId: string }
  | { type: 'NEXT_ROUND'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }

export const HAND_SIZE = 7
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 10

// ─── Card data ────────────────────────────────────────────────────────────────

export function getAllBlackCards(): BlackCard[] {
  return cahCards.black.map((c) => ({ text: c.text, pick: c.pick ?? 1 }))
}

export function getAllWhiteCards(): WhiteCard[] {
  return cahCards.white.map((c) => ({ text: c.text }))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Deal cards up to HAND_SIZE to each player from the draw pile. */
export function dealHands(
  players: Player[],
  drawPile: WhiteCard[],
  existingHands: Record<string, WhiteCard[]> = {}
): { hands: Record<string, WhiteCard[]>; remaining: WhiteCard[] } {
  const remaining = [...drawPile]
  const hands: Record<string, WhiteCard[]> = {}

  for (const player of players) {
    const current = existingHands[player.id] ?? []
    const needed = Math.max(0, HAND_SIZE - current.length)
    hands[player.id] = [...current, ...remaining.splice(0, needed)]
  }

  return { hands, remaining }
}

// ─── Selectors ────────────────────────────────────────────────────────────────

export function getCzar(state: GameState): Player | null {
  return state.players[state.czarIndex] ?? null
}

export function getNonCzarPlayers(state: GameState): Player[] {
  return state.players.filter((_, i) => i !== state.czarIndex)
}

export function hasAllSubmitted(state: GameState): boolean {
  const nonCzar = getNonCzarPlayers(state)
  return nonCzar.length > 0 && nonCzar.every((p) => p.id in state.submissions)
}

// ─── State factories ──────────────────────────────────────────────────────────

export function createLobbyState(host: Player): GameState {
  return {
    phase: 'lobby',
    players: [host],
    czarIndex: 0,
    whiteDrawPile: [],
    blackDrawPile: [],
    currentBlackCard: null,
    hands: {},
    submissions: {},
    judgeOrder: [],
    roundWinnerId: null,
    winnerId: null,
    pointsToWin: 5,
  }
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.some((p) => p.id === player.id)) return state
  if (state.players.length >= MAX_PLAYERS) return state
  return { ...state, players: [...state.players, player] }
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const removedIdx = state.players.findIndex((p) => p.id === playerId)
  const players = state.players.filter((p) => p.id !== playerId)
  let czarIndex = state.czarIndex
  if (removedIdx !== -1 && removedIdx < czarIndex) czarIndex--
  if (czarIndex >= players.length) czarIndex = 0
  const hands = { ...state.hands }
  delete hands[playerId]
  const submissions = { ...state.submissions }
  delete submissions[playerId]
  return { ...state, players, czarIndex, hands, submissions }
}

// ─── Game flow ────────────────────────────────────────────────────────────────

function startGame(state: GameState, pointsToWin: number): GameState {
  if (state.players.length < MIN_PLAYERS) return state

  const whites = shuffle(getAllWhiteCards())
  const blacks = shuffle(getAllBlackCards())
  const [firstBlack, ...blackRemaining] = blacks
  const { hands, remaining } = dealHands(state.players, whites)

  return {
    ...state,
    phase: 'playing',
    czarIndex: 0,
    whiteDrawPile: remaining,
    blackDrawPile: blackRemaining,
    currentBlackCard: firstBlack,
    hands,
    submissions: {},
    judgeOrder: [],
    roundWinnerId: null,
    winnerId: null,
    pointsToWin,
    players: state.players.map((p) => ({ ...p, score: 0 })),
  }
}

function nextRound(state: GameState): GameState {
  const nextCzarIndex = (state.czarIndex + 1) % state.players.length
  const { hands, remaining } = dealHands(state.players, state.whiteDrawPile, state.hands)
  const [nextBlack, ...blackRemaining] = state.blackDrawPile

  if (!nextBlack) {
    // Out of black cards — declare highest scorer the winner
    const winner = [...state.players].sort((a, b) => b.score - a.score)[0]
    return { ...state, phase: 'finished', winnerId: winner?.id ?? null }
  }

  return {
    ...state,
    phase: 'playing',
    czarIndex: nextCzarIndex,
    whiteDrawPile: remaining,
    blackDrawPile: blackRemaining,
    currentBlackCard: nextBlack,
    hands,
    submissions: {},
    judgeOrder: [],
    roundWinnerId: null,
  }
}

// ─── Action dispatcher ────────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction): GameState {
  if (action.type === 'START_GAME') {
    const host = state.players.find((p) => p.isHost)
    if (host?.id !== action.playerId) return state
    if (state.phase !== 'lobby') return state
    return startGame(state, action.pointsToWin ?? 5)
  }

  if (action.type === 'PLAY_AGAIN') {
    const host = state.players.find((p) => p.isHost)
    if (host?.id !== action.playerId) return state
    if (state.phase !== 'finished') return state
    return startGame({ ...state, phase: 'lobby' }, state.pointsToWin)
  }

  if (action.type === 'SUBMIT_CARDS') {
    if (state.phase !== 'playing') return state
    const czar = getCzar(state)
    if (action.playerId === czar?.id) return state
    if (action.playerId in state.submissions) return state
    if (!state.currentBlackCard) return state
    if (action.cards.length !== state.currentBlackCard.pick) return state

    // Remove submitted cards from hand (match by text, remove one at a time)
    const hand = [...(state.hands[action.playerId] ?? [])]
    for (const card of action.cards) {
      const idx = hand.findIndex((c) => c.text === card.text)
      if (idx === -1) return state // card not in hand — invalid
      hand.splice(idx, 1)
    }

    const newSubmissions = { ...state.submissions, [action.playerId]: action.cards }
    const newHands = { ...state.hands, [action.playerId]: hand }
    const newState = { ...state, submissions: newSubmissions, hands: newHands }

    // Check if all non-czar players have now submitted
    const nonCzar = getNonCzarPlayers(newState)
    if (nonCzar.every((p) => p.id in newSubmissions)) {
      return {
        ...newState,
        phase: 'judging',
        judgeOrder: shuffle(nonCzar.map((p) => p.id)),
      }
    }

    return newState
  }

  if (action.type === 'JUDGE_WINNER') {
    if (state.phase !== 'judging') return state
    const czar = getCzar(state)
    if (action.playerId !== czar?.id) return state
    if (!(action.winnerId in state.submissions)) return state

    const newPlayers = state.players.map((p) =>
      p.id === action.winnerId ? { ...p, score: p.score + 1 } : p
    )
    const gameWinner = newPlayers.find((p) => p.score >= state.pointsToWin)

    return {
      ...state,
      players: newPlayers,
      roundWinnerId: action.winnerId,
      phase: gameWinner ? 'finished' : 'round_end',
      winnerId: gameWinner?.id ?? null,
    }
  }

  if (action.type === 'NEXT_ROUND') {
    if (state.phase !== 'round_end') return state
    return nextRound(state)
  }

  return state
}
