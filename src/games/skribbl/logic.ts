let msgCounter = 0
function generateMsgId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `msg-${Date.now()}-${++msgCounter}`
}

export type GamePhase = 'lobby' | 'picking' | 'drawing' | 'round-end' | 'finished'

export interface Player {
  id: string
  name: string
  isHost: boolean
  score: number
}

export interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  text: string
  isCorrect?: boolean
  isSystem?: boolean
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

export interface GameState {
  phase: GamePhase
  players: Player[]
  currentDrawerIndex: number
  round: number
  totalRounds: number
  /** The word the drawer must draw (only visible to drawer client-side). */
  word: string | null
  /** Word choices offered to the drawer during picking phase. */
  wordChoices: string[]
  /** Hint shown to guessers: e.g. "_ _ _ _ _" */
  hint: string
  /** Strokes on the canvas — synced to all players. */
  strokes: DrawStroke[]
  /** Chat / guess messages. */
  messages: ChatMessage[]
  /** Player IDs who guessed correctly this turn. */
  guessedPlayers: string[]
  /** Timestamp (ms) when the drawing phase started. */
  drawStartTime: number | null
  /** Seconds allowed per turn. */
  turnDuration: number
  /** When the turn ended (null if still active). */
  turnEndTime: number | null
}

export type GameAction =
  | { type: 'START_GAME'; playerId: string }
  | { type: 'PICK_WORD'; playerId: string; word: string }
  | { type: 'ADD_STROKE'; playerId: string; stroke: DrawStroke }
  | { type: 'CLEAR_CANVAS'; playerId: string }
  | { type: 'UNDO_STROKE'; playerId: string }
  | { type: 'GUESS'; playerId: string; text: string }
  | { type: 'END_TURN'; playerId: string }
  | { type: 'NEXT_TURN'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }

// ─── Word list ────────────────────────────────────────────────────────────────

const WORDS = [
  'apple',
  'banana',
  'guitar',
  'castle',
  'dragon',
  'rocket',
  'bridge',
  'flower',
  'island',
  'pirate',
  'sunset',
  'turtle',
  'wizard',
  'candle',
  'forest',
  'hammer',
  'ladder',
  'mirror',
  'pencil',
  'planet',
  'rabbit',
  'shield',
  'spider',
  'trophy',
  'camera',
  'cherry',
  'crown',
  'diamond',
  'elephant',
  'fountain',
  'ghost',
  'helmet',
  'iceberg',
  'jellyfish',
  'kite',
  'lighthouse',
  'mushroom',
  'notebook',
  'octopus',
  'penguin',
  'rainbow',
  'snowflake',
  'telescope',
  'umbrella',
  'volcano',
  'waterfall',
  'anchor',
  'butterfly',
  'compass',
  'dolphin',
  'eagle',
  'firework',
  'giraffe',
  'helicopter',
  'keyboard',
  'lantern',
  'mountain',
  'necklace',
  'parachute',
  'sailboat',
  'tornado',
  'unicorn',
  'windmill',
  'airplane',
  'backpack',
  'cactus',
  'drumstick',
  'envelope',
  'flamingo',
  'grapes',
  'hourglass',
  'igloo',
  'juggler',
  'kangaroo',
  'lemon',
  'mermaid',
  'ninja',
  'owl',
  'pineapple',
  'queen',
  'robot',
  'starfish',
  'train',
  'violin',
  'whale',
  'zebra',
  'astronaut',
  'bowling',
  'cupcake',
  'dinosaur',
  'feather',
  'goldfish',
  'horseshoe',
  'icecream',
  'jigsaw',
  'koala',
  'lobster',
  'magnet',
  'newspaper',
  'pumpkin',
  'scarecrow',
  'treasure',
  'waffle',
  'xylophone',
  'yacht',
  'zipper',
  'bathtub',
  'chandelier',
  'dominoes',
  'escalator',
  'frying pan',
  'globe',
  'hammock',
  'island',
  'jukebox',
  'kayak',
  'lollipop',
  'mailbox',
  'nest',
  'oven',
  'puzzle',
  'quicksand',
  'rollercoaster',
  'sandwich',
  'toaster',
  'vacuum',
  'wrench',
]

export function pickRandomWords(count: number, exclude: string[] = []): string[] {
  const available = WORDS.filter((w) => !exclude.includes(w))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
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
  const shuffled = [...indices].sort(() => Math.random() - 0.5)
  const toReveal = new Set(shuffled.slice(0, revealCount))

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
    wordChoices: choices,
    word: null,
    hint: '',
    strokes: [],
    guessedPlayers: [],
    drawStartTime: null,
    turnEndTime: null,
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
    })
  }

  if (action.type === 'PICK_WORD') {
    if (state.phase !== 'picking') return state
    const drawer = getCurrentDrawer(state)
    if (drawer?.id !== action.playerId) return state
    if (!state.wordChoices.includes(action.word)) return state
    return {
      ...state,
      phase: 'drawing',
      word: action.word,
      wordChoices: [],
      hint: generateHint(action.word),
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
    const answer = (state.word ?? '').toLowerCase()

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
    }
    return { ...state, messages: [...state.messages, msg] }
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
