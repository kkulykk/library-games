import skribblWords from '@/data/words/skribbl-words.json'
import type { GameState } from './schema'
export type { GameState }

let msgCounter = 0
function generateMsgId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for older environments (e.g. test runners without crypto.randomUUID)
  return `msg-${Date.now()}-${++msgCounter}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export type GamePhase = 'lobby' | 'picking' | 'drawing' | 'round-end' | 'finished'

export interface Player {
  id: string
  name: string
  isHost: boolean
  score: number
  avatar: number
}

export interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  text: string
  isCorrect?: boolean
  isSystem?: boolean
  isClose?: boolean
}

export interface DrawPoint {
  x: number
  y: number
  color: string
  size: number
  tool: 'pen' | 'eraser'
}

export interface DrawStroke {
  points: DrawPoint[]
}

export type GameAction =
  | { type: 'START_GAME'; playerId: string }
  | { type: 'UPDATE_SETTINGS'; playerId: string; totalRounds?: number; turnDuration?: number }
  | { type: 'REMOVE_PLAYER'; playerId: string; targetPlayerId: string }
  | { type: 'PICK_WORD'; playerId: string; word: string }
  | { type: 'ADD_STROKE'; playerId: string; stroke: DrawStroke }
  | { type: 'CLEAR_CANVAS'; playerId: string }
  | { type: 'UNDO_STROKE'; playerId: string }
  | { type: 'GUESS'; playerId: string; text: string }
  | { type: 'REVEAL_HINT'; playerId: string; ratio: number }
  | { type: 'END_TURN'; playerId: string }
  | { type: 'NEXT_TURN'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }

// ─── Word list ────────────────────────────────────────────────────────────────

const WORDS: string[] = [...skribblWords.single, ...skribblWords.phrases]

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickRandomWords(count: number, exclude: string[] = []): string[] {
  const available = WORDS.filter((w) => !exclude.includes(w))
  const shuffled = fisherYatesShuffle(available)
  return shuffled.slice(0, count)
}

// ─── Word encoding ───────────────────────────────────────────────────────────
// Encode the word before storing in shared state to prevent casual devtools
// inspection by non-drawing players. This is obfuscation, not encryption —
// determined cheaters can still decode, but it prevents accidental exposure.

export function encodeWord(word: string): string {
  return btoa(unescape(encodeURIComponent(word)))
}

export function decodeWord(encoded: string): string {
  if (!encoded) return ''
  try {
    return decodeURIComponent(escape(atob(encoded)))
  } catch {
    return encoded
  }
}

export function generateHint(word: string): string {
  return word
    .split('')
    .map((ch) => (ch === ' ' ? '  ' : '_'))
    .join(' ')
}

export function revealHintLetters(word: string, revealCount: number): string {
  const indices: number[] = []
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ') indices.push(i)
  }
  // Deterministic: pick evenly-spaced indices so all clients compute the same hint
  const toReveal = new Set<number>()
  const count = Math.min(revealCount, indices.length)
  if (count > 0) {
    const step = indices.length / count
    for (let i = 0; i < count; i++) {
      toReveal.add(indices[Math.floor(i * step)])
    }
  }

  return word
    .split('')
    .map((ch, i) => {
      if (ch === ' ') return '  '
      if (toReveal.has(i)) return ch
      return '_'
    })
    .join(' ')
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function calculateGuessScore(
  elapsedMs: number,
  turnDurationMs: number,
  totalGuessers: number,
  guessOrder: number
): number {
  const timeRatio = Math.max(0, 1 - elapsedMs / turnDurationMs)
  const baseScore = Math.round(100 + 400 * timeRatio)
  const orderBonus = Math.max(0, Math.round(50 * (1 - guessOrder / totalGuessers)))
  return baseScore + orderBonus
}

export function calculateDrawerScore(guessedCount: number, totalGuessers: number): number {
  if (totalGuessers === 0 || guessedCount === 0) return 0
  return Math.round(100 * (guessedCount / totalGuessers))
}

export function isCloseGuess(guess: string, answer: string): boolean {
  const normalizedGuess = guess.trim().toLowerCase()
  const normalizedAnswer = answer.trim().toLowerCase()

  if (!normalizedGuess || normalizedGuess === normalizedAnswer) return false
  if (normalizedGuess.length < 3) return false

  if (normalizedAnswer.includes(normalizedGuess) || normalizedGuess.includes(normalizedAnswer)) {
    return true
  }

  if (Math.abs(normalizedGuess.length - normalizedAnswer.length) > 1) return false

  let diff = 0
  const maxLength = Math.max(normalizedGuess.length, normalizedAnswer.length)
  for (let i = 0; i < maxLength; i++) {
    if (normalizedGuess[i] !== normalizedAnswer[i]) diff++
    if (diff > 2) return false
  }

  return diff <= 2
}

// ─── State helpers ────────────────────────────────────────────────────────────

export function createLobbyState(host: Player): GameState {
  return {
    phase: 'lobby',
    players: [{ ...host, score: 0 }],
    currentDrawerIndex: 0,
    round: 1,
    totalRounds: 3,
    word: null,
    wordChoices: [],
    hint: '',
    strokes: [],
    messages: [],
    guessedPlayers: [],
    drawStartTime: null,
    turnDuration: 80,
    turnEndTime: null,
    scoreDeltas: {},
  }
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.some((p) => p.id === player.id)) return state
  if (state.players.length >= 8) return state
  return { ...state, players: [...state.players, { ...player, score: 0 }] }
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const idx = state.players.findIndex((p) => p.id === playerId)
  if (idx === -1) return state
  const players = state.players.filter((p) => p.id !== playerId)
  let drawerIdx = state.currentDrawerIndex
  if (idx < drawerIdx) drawerIdx--
  if (drawerIdx >= players.length) drawerIdx = 0
  return { ...state, players, currentDrawerIndex: drawerIdx }
}

export function getCurrentDrawer(state: GameState): Player | null {
  return state.players[state.currentDrawerIndex] ?? null
}

function startPickingPhase(state: GameState): GameState {
  const choices = pickRandomWords(3)
  return {
    ...state,
    phase: 'picking',
    wordChoices: choices.map(encodeWord),
    word: null,
    hint: '',
    strokes: [],
    messages: [],
    guessedPlayers: [],
    drawStartTime: null,
    turnEndTime: null,
    scoreDeltas: {},
  }
}

function advanceToNextTurn(state: GameState): GameState {
  const nextDrawerIdx = state.currentDrawerIndex + 1
  if (nextDrawerIdx >= state.players.length) {
    // End of round
    if (state.round >= state.totalRounds) {
      return { ...state, phase: 'finished' }
    }
    return startPickingPhase({
      ...state,
      round: state.round + 1,
      currentDrawerIndex: 0,
    })
  }
  return startPickingPhase({
    ...state,
    currentDrawerIndex: nextDrawerIdx,
  })
}

// ─── Action dispatcher ────────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction): GameState {
  const host = state.players.find((p) => p.isHost)

  if (action.type === 'START_GAME') {
    if (host?.id !== action.playerId) return state
    if (state.phase !== 'lobby') return state
    if (state.players.length < 2) return state
    return startPickingPhase({
      ...state,
      players: state.players.map((p) => ({ ...p, score: 0 })),
      round: 1,
      currentDrawerIndex: 0,
      messages: [],
      scoreDeltas: {},
    })
  }

  if (action.type === 'PLAY_AGAIN') {
    if (host?.id !== action.playerId) return state
    if (state.phase !== 'finished') return state
    return startPickingPhase({
      ...state,
      players: state.players.map((p) => ({ ...p, score: 0 })),
      round: 1,
      currentDrawerIndex: 0,
      messages: [],
      scoreDeltas: {},
    })
  }

  if (action.type === 'UPDATE_SETTINGS') {
    if (state.phase !== 'lobby') return state
    if (host?.id !== action.playerId) return state

    const nextTotalRounds =
      action.totalRounds && [2, 3, 5].includes(action.totalRounds) ? action.totalRounds : undefined
    const nextTurnDuration =
      action.turnDuration && [60, 80, 120].includes(action.turnDuration)
        ? action.turnDuration
        : undefined

    if (nextTotalRounds === undefined && nextTurnDuration === undefined) return state

    return {
      ...state,
      totalRounds: nextTotalRounds ?? state.totalRounds,
      turnDuration: nextTurnDuration ?? state.turnDuration,
    }
  }

  if (action.type === 'REMOVE_PLAYER') {
    if (state.phase !== 'lobby') return state
    if (host?.id !== action.playerId) return state
    if (action.targetPlayerId === action.playerId) return state

    const target = state.players.find((player) => player.id === action.targetPlayerId)
    if (!target || target.isHost) return state

    return removePlayer(state, action.targetPlayerId)
  }

  if (action.type === 'PICK_WORD') {
    if (state.phase !== 'picking') return state
    const drawer = getCurrentDrawer(state)
    if (drawer?.id !== action.playerId) return state
    if (!state.wordChoices.includes(action.word)) return state
    // action.word is already encoded (from wordChoices); decode for hint
    const plainWord = decodeWord(action.word)
    return {
      ...state,
      phase: 'drawing',
      word: action.word,
      wordChoices: [],
      hint: generateHint(plainWord),
      drawStartTime: Date.now(),
    }
  }

  if (action.type === 'ADD_STROKE') {
    if (state.phase !== 'drawing') return state
    const drawer = getCurrentDrawer(state)
    if (drawer?.id !== action.playerId) return state
    return { ...state, strokes: [...state.strokes, action.stroke] }
  }

  if (action.type === 'CLEAR_CANVAS') {
    if (state.phase !== 'drawing') return state
    const drawer = getCurrentDrawer(state)
    if (drawer?.id !== action.playerId) return state
    return { ...state, strokes: [] }
  }

  if (action.type === 'UNDO_STROKE') {
    if (state.phase !== 'drawing') return state
    const drawer = getCurrentDrawer(state)
    if (drawer?.id !== action.playerId) return state
    if (state.strokes.length === 0) return state
    return { ...state, strokes: state.strokes.slice(0, -1) }
  }

  if (action.type === 'GUESS') {
    if (state.phase !== 'drawing') return state
    const drawer = getCurrentDrawer(state)
    if (drawer?.id === action.playerId) return state // drawer can't guess
    if (state.guessedPlayers.includes(action.playerId)) return state // already guessed

    const player = state.players.find((p) => p.id === action.playerId)
    if (!player) return state

    const guess = action.text.trim().toLowerCase()
    const answer = decodeWord(state.word ?? '').toLowerCase()

    // Check if correct
    if (guess === answer) {
      const elapsed = Date.now() - (state.drawStartTime ?? Date.now())
      const totalGuessers = state.players.length - 1
      const guessOrder = state.guessedPlayers.length
      const guessScore = calculateGuessScore(
        elapsed,
        state.turnDuration * 1000,
        totalGuessers,
        guessOrder
      )
      const newGuessedPlayers = [...state.guessedPlayers, action.playerId]

      // Update scores
      const drawerBonus = calculateDrawerScore(newGuessedPlayers.length, totalGuessers)
      const players = state.players.map((p) => {
        if (p.id === action.playerId) return { ...p, score: p.score + guessScore }
        if (p.id === drawer?.id) {
          const prevBonus = calculateDrawerScore(state.guessedPlayers.length, totalGuessers)
          return { ...p, score: p.score - prevBonus + drawerBonus }
        }
        return p
      })

      const msg: ChatMessage = {
        id: generateMsgId(),
        playerId: action.playerId,
        playerName: player.name,
        text: `${player.name} guessed the word!`,
        isCorrect: true,
        isSystem: true,
      }

      const allGuessed = newGuessedPlayers.length >= totalGuessers
      const newState: GameState = {
        ...state,
        players,
        guessedPlayers: newGuessedPlayers,
        messages: [...state.messages, msg],
        scoreDeltas: {
          ...state.scoreDeltas,
          [action.playerId]: guessScore,
          ...(drawer ? { [drawer.id]: drawerBonus } : {}),
        },
      }

      if (allGuessed) {
        return {
          ...newState,
          phase: 'round-end',
          turnEndTime: Date.now(),
        }
      }

      return newState
    }

    // Wrong guess — add as chat message
    const msg: ChatMessage = {
      id: generateMsgId(),
      playerId: action.playerId,
      playerName: player.name,
      text: action.text.trim(),
      isClose: isCloseGuess(guess, answer),
    }
    return { ...state, messages: [...state.messages, msg] }
  }

  if (action.type === 'REVEAL_HINT') {
    if (state.phase !== 'drawing') return state
    if (!state.word) return state
    const drawer = getCurrentDrawer(state)
    if (drawer?.id !== action.playerId) return state
    const plainWord = decodeWord(state.word)
    const letterCount = plainWord.replace(/ /g, '').length
    let revealCount = 0
    if (action.ratio >= 0.75) revealCount = Math.ceil(letterCount * 0.6)
    else if (action.ratio >= 0.5) revealCount = Math.ceil(letterCount * 0.3)
    if (revealCount === 0) return state
    const newHint = revealHintLetters(plainWord, revealCount)
    if (newHint === state.hint) return state
    return { ...state, hint: newHint }
  }

  if (action.type === 'END_TURN') {
    if (state.phase !== 'drawing') return state
    // Anyone can trigger end turn (timer expiry)
    return {
      ...state,
      phase: 'round-end',
      turnEndTime: Date.now(),
    }
  }

  if (action.type === 'NEXT_TURN') {
    if (state.phase !== 'round-end') return state
    if (host?.id !== action.playerId) return state
    return advanceToNextTurn(state)
  }

  return state
}
