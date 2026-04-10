import type { GameState } from './schema'
export type { GameState }

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Spectrum {
  left: string
  right: string
}

export interface Puzzle {
  spectrum: Spectrum
  target: number // 0-100
}

export interface Player {
  id: string
  name: string
  isHost: boolean
  score: number
}

export type GamePhase = 'lobby' | 'playing' | 'finished'
export type RoundPhase = 'clue' | 'guessing' | 'reveal'

export interface Round {
  number: number // 1-indexed
  psychicId: string
  spectrum: Spectrum
  target: number // 0-100, or HIDDEN_TARGET (-1) when redacted for non-psychics
  clue: string | null
  guesses: Record<string, number> // playerId → 0-100 guess
  roundScores: Record<string, number> // filled on reveal
  phase: RoundPhase
}

export type GameAction =
  | { type: 'START_GAME'; playerId: string }
  | { type: 'SUBMIT_CLUE'; playerId: string; clue: string }
  | { type: 'SUBMIT_GUESS'; playerId: string; guess: number }
  | { type: 'REVEAL_ROUND'; playerId: string }
  | { type: 'NEXT_ROUND'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }

// ─── Constants ──────────────────────────────────────────────────────────────

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 10
export const TOTAL_ROUNDS = 8

export const MAX_CLUE_LENGTH = 32

/** Scoring thresholds (absolute distance on the 0-100 scale). */
export const BULLSEYE_RADIUS = 3
export const CLOSE_RADIUS = 7
export const MEDIUM_RADIUS = 12

export const BULLSEYE_POINTS = 4
export const CLOSE_POINTS = 3
export const MEDIUM_POINTS = 2
export const MISS_POINTS = 0

export const MAX_POINTS_PER_ROUND = BULLSEYE_POINTS

/** Sentinel value used when the target is hidden from a player. */
export const HIDDEN_TARGET = -1

// ─── Puzzle bank ────────────────────────────────────────────────────────────

const SPECTRA: Array<{
  left: string
  right: string
  /** Creative example clues the UI surfaces to the Psychic to help inspire them. */
  hints: string[]
}> = [
  {
    left: 'Cold',
    right: 'Hot',
    hints: ['Ice cube', 'Morning coffee', 'Lava', 'Sauna', 'Room temperature'],
  },
  {
    left: 'Boring',
    right: 'Exciting',
    hints: ['Watching paint dry', 'Skydiving', 'Filing taxes', 'Roller coaster'],
  },
  {
    left: 'Cheap',
    right: 'Expensive',
    hints: ['Ramen noodles', 'Yacht', 'Rolex watch', 'Fast food burger'],
  },
  {
    left: 'Common',
    right: 'Rare',
    hints: ['Grains of sand', 'Four-leaf clover', 'Blue lobster', 'Solar eclipse'],
  },
  {
    left: 'Safe',
    right: 'Dangerous',
    hints: ['Teddy bear', 'Juggling chainsaws', 'Pet tiger', 'Pillow fort'],
  },
  {
    left: 'Quiet',
    right: 'Loud',
    hints: ['Library whisper', 'Rock concert', 'Thunder clap', 'Snow falling'],
  },
  {
    left: 'Weak',
    right: 'Strong',
    hints: ['Wet paper', 'Superhero', 'Ox', 'Kleenex'],
  },
  {
    left: 'Slow',
    right: 'Fast',
    hints: ['Sloth', 'Rocket', 'Cheetah', 'Snail', 'City bus'],
  },
  {
    left: 'Small',
    right: 'Big',
    hints: ['Atom', 'Blue whale', 'Galaxy', 'Ant', 'House'],
  },
  {
    left: 'Fake',
    right: 'Real',
    hints: ['Unicorn', 'Taxes', 'Santa Claus', 'Reality TV'],
  },
  {
    left: 'Useless',
    right: 'Useful',
    hints: ['Chocolate teapot', 'Swiss army knife', 'Duct tape', 'Decorative pillow'],
  },
  {
    left: 'Healthy',
    right: 'Unhealthy',
    hints: ['Kale salad', 'Deep-fried butter', 'Cigarette', 'Jogging', 'Glazed donut'],
  },
  {
    left: 'Cute',
    right: 'Scary',
    hints: ['Puppy', 'Clown in a basement', 'Kitten', 'Ghost at midnight', 'Tarantula'],
  },
  {
    left: 'Modern',
    right: 'Ancient',
    hints: ['Smartphone', 'Pyramids of Giza', 'TikTok', 'Shakespeare', 'Cassette tape'],
  },
  {
    left: 'Bland',
    right: 'Spicy',
    hints: ['Plain rice', 'Ghost pepper', 'Buffalo wings', 'Vanilla ice cream', 'Black pepper'],
  },
  {
    left: 'Sad',
    right: 'Happy',
    hints: ['Funeral', 'Wedding day', 'Winning the lottery', 'Rainy Monday', 'Puppy cuddle'],
  },
  {
    left: 'Lazy',
    right: 'Hardworking',
    hints: ['Couch potato', 'Olympic athlete', 'Worker ant', 'Weekend nap'],
  },
  {
    left: 'Unpopular',
    right: 'Popular',
    hints: ['Brussels sprouts', 'Pizza', 'Nickelback', 'Taylor Swift'],
  },
  {
    left: 'Plain',
    right: 'Fancy',
    hints: ['Paper napkin', 'Tuxedo', 'Crystal chandelier', 'Paper plate'],
  },
  {
    left: 'Ugly',
    right: 'Beautiful',
    hints: ['Rotten garbage', 'Sunset over the ocean', 'Mud puddle', 'Newborn baby'],
  },
]

/** Return the full list of spectra (with creative example hints) for the UI. */
export function getSpectra(): ReadonlyArray<{
  readonly left: string
  readonly right: string
  readonly hints: readonly string[]
}> {
  return SPECTRA
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Pick a fresh random puzzle: a spectrum + a target position on it. */
export function pickPuzzle(rng: () => number = Math.random): Puzzle {
  const spectrum = SPECTRA[Math.floor(rng() * SPECTRA.length)]
  const target = Math.floor(rng() * 101)
  return {
    spectrum: { left: spectrum.left, right: spectrum.right },
    target,
  }
}

/** Score a single guess against the round's target. */
export function scoreGuess(guess: number, target: number): number {
  const distance = Math.abs(guess - target)
  if (distance <= BULLSEYE_RADIUS) return BULLSEYE_POINTS
  if (distance <= CLOSE_RADIUS) return CLOSE_POINTS
  if (distance <= MEDIUM_RADIUS) return MEDIUM_POINTS
  return MISS_POINTS
}

/** Absolute distance between a guess and the target. */
export function distanceFromTarget(guess: number, target: number): number {
  return Math.abs(guess - target)
}

// ─── State queries ──────────────────────────────────────────────────────────

export function getPsychic(state: GameState): Player | undefined {
  if (!state.currentRound) return undefined
  return state.players.find((p) => p.id === state.currentRound!.psychicId)
}

export function isPsychic(state: GameState, playerId: string): boolean {
  return state.currentRound?.psychicId === playerId
}

export function getGuessers(state: GameState): Player[] {
  if (!state.currentRound) return []
  return state.players.filter((p) => p.id !== state.currentRound!.psychicId)
}

export function hasPlayerGuessed(state: GameState, playerId: string): boolean {
  if (!state.currentRound) return false
  return playerId in state.currentRound.guesses
}

export function allGuessersSubmitted(state: GameState): boolean {
  if (!state.currentRound) return false
  return getGuessers(state).every((p) => p.id in state.currentRound!.guesses)
}

export function canStartGame(state: GameState): boolean {
  return state.phase === 'lobby' && state.players.length >= MIN_PLAYERS
}

export function getLeaderboard(state: GameState): Player[] {
  return [...state.players].sort((a, b) => b.score - a.score)
}

export function getWinners(state: GameState): Player[] {
  if (state.players.length === 0) return []
  const top = Math.max(...state.players.map((p) => p.score))
  return state.players.filter((p) => p.score === top)
}

/**
 * Redact the current round's target from a player who shouldn't see it yet.
 * The Psychic always sees it; non-psychics only see it during the reveal phase.
 */
export function redactForPlayer(state: GameState, playerId: string): GameState {
  if (!state.currentRound) return state
  const round = state.currentRound
  if (round.psychicId === playerId || round.phase === 'reveal') return state
  return {
    ...state,
    currentRound: { ...round, target: HIDDEN_TARGET },
  }
}

// ─── State machine ──────────────────────────────────────────────────────────

export function createLobbyState(host: Player): GameState {
  return {
    phase: 'lobby',
    players: [{ ...host, score: 0 }],
    totalRounds: TOTAL_ROUNDS,
    roundNumber: 0,
    currentRound: null,
    log: [],
  }
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.length >= MAX_PLAYERS) return state
  if (state.players.some((p) => p.id === player.id)) return state
  return {
    ...state,
    players: [...state.players, { ...player, score: 0 }],
  }
}

function buildRound(number: number, psychicId: string, rng: () => number = Math.random): Round {
  const puzzle = pickPuzzle(rng)
  return {
    number,
    psychicId,
    spectrum: puzzle.spectrum,
    target: puzzle.target,
    clue: null,
    guesses: {},
    roundScores: {},
    phase: 'clue',
  }
}

function computeReveal(round: Round, players: Player[]): Round {
  const target = round.target
  const roundScores: Record<string, number> = {}
  const guesserScores: number[] = []
  for (const player of players) {
    if (player.id === round.psychicId) continue
    const guess = round.guesses[player.id]
    if (guess === undefined) {
      roundScores[player.id] = 0
      continue
    }
    const points = scoreGuess(guess, target)
    roundScores[player.id] = points
    guesserScores.push(points)
  }
  // Psychic earns the best guesser's points — rewards good clue-giving.
  roundScores[round.psychicId] = guesserScores.length > 0 ? Math.max(...guesserScores) : 0
  return { ...round, phase: 'reveal', roundScores }
}

function applyRoundScores(players: Player[], round: Round): Player[] {
  return players.map((p) => ({
    ...p,
    score: p.score + (round.roundScores[p.id] ?? 0),
  }))
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId)
  const players = state.players.filter((p) => p.id !== playerId)

  if (state.phase === 'lobby' || !state.currentRound) {
    return { ...state, players }
  }

  if (players.length < MIN_PLAYERS) {
    return {
      ...state,
      players,
      phase: 'finished',
      currentRound: null,
      log: [...state.log, `${player?.name ?? 'A player'} left — not enough players to continue.`],
    }
  }

  // If the Psychic left mid-round, replace them and restart the round.
  if (state.currentRound.psychicId === playerId) {
    const log = [...state.log, `${player?.name ?? 'The Psychic'} left — skipping the round.`]
    const nextPsychicIndex = Math.floor(Math.random() * players.length)
    const nextPsychic = players[nextPsychicIndex]
    return {
      ...state,
      players,
      currentRound: buildRound(state.roundNumber, nextPsychic.id),
      log,
    }
  }

  // A guesser left — drop their guess if any.
  const nextGuesses = { ...state.currentRound.guesses }
  delete nextGuesses[playerId]
  let round: Round = { ...state.currentRound, guesses: nextGuesses }

  const stillGuessers = players.filter((p) => p.id !== round.psychicId)
  if (
    round.phase === 'guessing' &&
    stillGuessers.length > 0 &&
    stillGuessers.every((p) => p.id in round.guesses)
  ) {
    round = computeReveal(round, players)
    return {
      ...state,
      players: applyRoundScores(players, round),
      currentRound: round,
      log: [...state.log, `${player?.name ?? 'A guesser'} left.`],
    }
  }

  return {
    ...state,
    players,
    currentRound: round,
    log: [...state.log, `${player?.name ?? 'A guesser'} left.`],
  }
}

function startGame(state: GameState, playerId: string, rng: () => number = Math.random): GameState {
  if (state.phase !== 'lobby') return state
  const host = state.players.find((p) => p.id === playerId)
  if (!host?.isHost) return state
  if (!canStartGame(state)) return state

  const players = state.players.map((p) => ({ ...p, score: 0 }))
  const firstPsychic = players[Math.floor(rng() * players.length)]

  return {
    ...state,
    phase: 'playing',
    players,
    roundNumber: 1,
    currentRound: buildRound(1, firstPsychic.id, rng),
    log: [`Game started — ${firstPsychic.name} is the first Psychic.`],
  }
}

function submitClue(state: GameState, playerId: string, clue: string): GameState {
  if (state.phase !== 'playing' || !state.currentRound) return state
  if (state.currentRound.phase !== 'clue') return state
  if (state.currentRound.psychicId !== playerId) return state

  const trimmed = clue.trim().slice(0, MAX_CLUE_LENGTH)
  if (!trimmed) return state

  const psychic = state.players.find((p) => p.id === playerId)
  return {
    ...state,
    currentRound: { ...state.currentRound, clue: trimmed, phase: 'guessing' },
    log: [...state.log, `${psychic?.name ?? 'Psychic'}: "${trimmed}"`],
  }
}

function submitGuess(state: GameState, playerId: string, guess: number): GameState {
  if (state.phase !== 'playing' || !state.currentRound) return state
  if (state.currentRound.phase !== 'guessing') return state
  if (state.currentRound.psychicId === playerId) return state

  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state

  const clamped = Math.max(0, Math.min(100, Math.round(guess)))
  const newGuesses = { ...state.currentRound.guesses, [playerId]: clamped }
  let round: Round = { ...state.currentRound, guesses: newGuesses }

  const guessers = state.players.filter((p) => p.id !== round.psychicId)
  if (guessers.length > 0 && guessers.every((g) => g.id in newGuesses)) {
    round = computeReveal(round, state.players)
    return {
      ...state,
      players: applyRoundScores(state.players, round),
      currentRound: round,
      log: [...state.log, `${player.name} locked in.`, `All guesses in — revealing target.`],
    }
  }

  return {
    ...state,
    currentRound: round,
    log: [...state.log, `${player.name} locked in.`],
  }
}

function revealRound(state: GameState, playerId: string): GameState {
  if (state.phase !== 'playing' || !state.currentRound) return state
  if (state.currentRound.phase !== 'guessing') return state
  const host = state.players.find((p) => p.id === playerId)
  if (!host?.isHost) return state
  if (Object.keys(state.currentRound.guesses).length === 0) return state

  const round = computeReveal(state.currentRound, state.players)
  return {
    ...state,
    players: applyRoundScores(state.players, round),
    currentRound: round,
    log: [...state.log, 'Host revealed the target.'],
  }
}

function nextRound(state: GameState, playerId: string, rng: () => number = Math.random): GameState {
  if (state.phase !== 'playing' || !state.currentRound) return state
  if (state.currentRound.phase !== 'reveal') return state
  const host = state.players.find((p) => p.id === playerId)
  if (!host?.isHost) return state

  if (state.roundNumber >= state.totalRounds) {
    return {
      ...state,
      phase: 'finished',
      currentRound: null,
      log: [...state.log, 'Final round complete.'],
    }
  }

  // Rotate psychic by index — wraps around after the last player.
  const lastIndex = state.players.findIndex((p) => p.id === state.currentRound!.psychicId)
  const nextIndex = (lastIndex + 1) % state.players.length
  const nextPsychic = state.players[nextIndex]

  return {
    ...state,
    roundNumber: state.roundNumber + 1,
    currentRound: buildRound(state.roundNumber + 1, nextPsychic.id, rng),
    log: [...state.log, `${nextPsychic.name} is now the Psychic.`],
  }
}

function playAgain(state: GameState, playerId: string): GameState {
  if (state.phase !== 'finished') return state
  const host = state.players.find((p) => p.id === playerId)
  if (!host?.isHost) return state
  return {
    ...state,
    phase: 'lobby',
    players: state.players.map((p) => ({ ...p, score: 0 })),
    roundNumber: 0,
    currentRound: null,
    log: [],
  }
}

// ─── Action dispatcher ──────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return startGame(state, action.playerId)
    case 'SUBMIT_CLUE':
      return submitClue(state, action.playerId, action.clue)
    case 'SUBMIT_GUESS':
      return submitGuess(state, action.playerId, action.guess)
    case 'REVEAL_ROUND':
      return revealRound(state, action.playerId)
    case 'NEXT_ROUND':
      return nextRound(state, action.playerId)
    case 'PLAY_AGAIN':
      return playAgain(state, action.playerId)
    case 'REMOVE_PLAYER':
      return removePlayer(state, action.playerId)
    default:
      return state
  }
}
