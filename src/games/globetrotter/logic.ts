import { shuffle } from '@/lib/shuffle'
import { LOCATIONS, type GeoLocation, type GeoPlace } from './locations'
import type { GameState } from './schema'
export type { GameState }
export type { GeoLocation, GeoPlace }
export { shuffle }

export interface Player {
  id: string
  name: string
  isHost: boolean
  score: number
}

export interface Guess {
  lat: number
  lng: number
}

export type GamePhase = 'lobby' | 'playing' | 'finished'
export type RoundPhase = 'guessing' | 'reveal'

export interface Round {
  number: number
  location: GeoLocation
  guesses: Record<string, Guess>
  distances: Record<string, number>
  roundScores: Record<string, number>
  phase: RoundPhase
}

export type GameAction =
  | { type: 'START_GAME'; playerId: string; deck?: GeoLocation[] }
  | { type: 'SUBMIT_GUESS'; playerId: string; lat: number; lng: number }
  | { type: 'NEXT_ROUND'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  /** `playerId` asks for `targetId` to be dropped — see `kickPlayer`. */
  | { type: 'KICK_PLAYER'; playerId: string; targetId: string }
  | { type: 'SET_PLACE'; playerId: string; roundNumber: number; place: GeoPlace }

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const TOTAL_ROUNDS = 5

export const MAX_ROUND_SCORE = 5000
export const BULLSEYE_KM = 25
export const SCORE_DECAY_KM = 1500

const EARTH_RADIUS_KM = 6371

// ─── Geometry ────────────────────────────────────────────────────────────────
// Screen projection lives in `mercator.ts` — this file only deals in lat/lng.

/** Great-circle distance in kilometers (haversine). */
export function haversineKm(a: Guess, b: Guess): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** GeoGuessr-style exponential falloff: 5000 inside the bullseye, ~0 antipodal. */
export function scoreDistance(km: number): number {
  if (km <= BULLSEYE_KM) return MAX_ROUND_SCORE
  return Math.round(MAX_ROUND_SCORE * Math.exp(-(km - BULLSEYE_KM) / SCORE_DECAY_KM))
}

export function isValidGuess(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export function formatKm(km: number): string {
  if (km < 1) return '<1 km'
  if (km < 100) return `${Math.round(km * 10) / 10} km`
  return `${Math.round(km).toLocaleString('en-US')} km`
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Sanity gate for decks supplied by the UI (e.g. fetched Random World decks). */
export function isPlayableLocation(location: GeoLocation): boolean {
  return (
    typeof location.name === 'string' &&
    location.name.length > 0 &&
    typeof location.country === 'string' &&
    isValidGuess(location.lat, location.lng) &&
    typeof location.emoji === 'string' &&
    Array.isArray(location.clues) &&
    location.clues.every((clue) => typeof clue === 'string')
  )
}

/**
 * Random World drops carry no field notes, and their `name` is only the
 * country the coordinate fell in — so the reveal reverse-geocodes them for a
 * town name, while curated landmarks already name themselves.
 */
export function isRandomDrop(location: GeoLocation): boolean {
  return location.clues.length === 0
}

export function pickLocations(
  count: number,
  rng: () => number = Math.random,
  pool: GeoLocation[] = LOCATIONS
): GeoLocation[] {
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length))
}

export function getLeaderboard(state: GameState): Player[] {
  return [...state.players].sort((a, b) => b.score - a.score)
}

export function getWinners(state: GameState): Player[] {
  if (state.players.length === 0) return []
  const top = Math.max(...state.players.map((p) => p.score))
  return state.players.filter((p) => p.score === top)
}

export function hasPlayerGuessed(state: GameState, playerId: string): boolean {
  return state.currentRound?.guesses[playerId] !== undefined
}

export function allPlayersGuessed(state: GameState): boolean {
  if (!state.currentRound) return false
  const round = state.currentRound
  return state.players.every((p) => round.guesses[p.id] !== undefined)
}

export function canStartGame(state: GameState): boolean {
  return state.phase === 'lobby' && state.players.length >= MIN_PLAYERS
}

const HIDDEN_LOCATION: GeoLocation = {
  name: '',
  country: '',
  lat: 0,
  lng: 0,
  emoji: '❓',
  clues: [],
}

/**
 * Display-side redaction (honor-system, like Mindmeld's hidden target): before
 * the reveal, players see the current location's clues and its 360° panorama
 * but not its answer, and never see the rest of the deck.
 */
export function redactForPlayer(state: GameState, _playerId: string): GameState {
  const redacted: GameState = { ...state, deck: [] }
  if (!state.currentRound || state.currentRound.phase === 'reveal') return redacted
  return {
    ...redacted,
    currentRound: {
      ...state.currentRound,
      location: {
        ...HIDDEN_LOCATION,
        clues: state.currentRound.location.clues,
        pano: state.currentRound.location.pano,
      },
    },
  }
}

// ─── Multiplayer state machine ───────────────────────────────────────────────

export function createLobbyState(host: Player): GameState {
  return {
    phase: 'lobby',
    players: [{ ...host, score: 0 }],
    totalRounds: TOTAL_ROUNDS,
    roundNumber: 0,
    deck: [],
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

function buildRound(number: number, location: GeoLocation): Round {
  return {
    number,
    location,
    guesses: {},
    distances: {},
    roundScores: {},
    phase: 'guessing',
  }
}

function computeReveal(round: Round, players: Player[]): Round {
  const target = { lat: round.location.lat, lng: round.location.lng }
  const distances: Record<string, number> = {}
  const roundScores: Record<string, number> = {}
  for (const player of players) {
    const guess = round.guesses[player.id]
    if (!guess) continue
    const km = haversineKm(guess, target)
    distances[player.id] = Math.round(km * 10) / 10
    roundScores[player.id] = scoreDistance(km)
  }
  return { ...round, distances, roundScores, phase: 'reveal' }
}

function applyRoundScores(players: Player[], round: Round): Player[] {
  return players.map((p) => ({
    ...p,
    score: p.score + (round.roundScores[p.id] ?? 0),
  }))
}

function startGame(
  state: GameState,
  playerId: string,
  rng: () => number = Math.random,
  providedDeck?: GeoLocation[]
): GameState {
  if (state.phase !== 'lobby') return state
  const host = state.players.find((p) => p.id === playerId)
  if (!host?.isHost) return state
  if (!canStartGame(state)) return state

  // A supplied deck (Random World) is used only when it is fully playable;
  // anything short or malformed falls back to the curated landmark pool.
  const supplied =
    providedDeck &&
    providedDeck.length >= state.totalRounds &&
    providedDeck.every(isPlayableLocation)
      ? providedDeck.slice(0, state.totalRounds)
      : null
  const deck = supplied ?? pickLocations(state.totalRounds, rng)
  return {
    ...state,
    phase: 'playing',
    players: state.players.map((p) => ({ ...p, score: 0 })),
    roundNumber: 1,
    deck,
    currentRound: buildRound(1, deck[0]),
    log: ['Expedition started — pin your first guess on the map.'],
  }
}

function submitGuess(state: GameState, playerId: string, lat: number, lng: number): GameState {
  if (state.phase !== 'playing' || !state.currentRound) return state
  if (state.currentRound.phase !== 'guessing') return state
  if (!isValidGuess(lat, lng)) return state

  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state
  if (state.currentRound.guesses[playerId]) return state

  let round: Round = {
    ...state.currentRound,
    guesses: { ...state.currentRound.guesses, [playerId]: { lat, lng } },
  }

  const everyoneIn = state.players.every((p) => round.guesses[p.id] !== undefined)
  let players = state.players
  const log = [...state.log, `${player.name} locked in a guess.`]

  if (everyoneIn) {
    round = computeReveal(round, players)
    players = applyRoundScores(players, round)
    log.push(`Round ${round.number}: it was ${round.location.name}, ${round.location.country}.`)
  }

  return { ...state, players, currentRound: round, log }
}

function nextRound(state: GameState, playerId: string): GameState {
  if (state.phase !== 'playing' || !state.currentRound) return state
  if (state.currentRound.phase !== 'reveal') return state
  const host = state.players.find((p) => p.id === playerId)
  if (!host?.isHost) return state

  if (state.roundNumber >= state.totalRounds || state.roundNumber >= state.deck.length) {
    return {
      ...state,
      phase: 'finished',
      currentRound: null,
      log: [...state.log, 'Final round complete.'],
    }
  }

  const number = state.roundNumber + 1
  return {
    ...state,
    roundNumber: number,
    currentRound: buildRound(number, state.deck[number - 1]),
    log: [...state.log, `Round ${number} — a new mystery location awaits.`],
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
    deck: [],
    currentRound: null,
    log: [],
  }
}

/**
 * Hand the host badge on when the host is the one leaving.
 *
 * Only the host can start a game, advance a round or restart, so a room whose
 * host closed their laptop is a room nobody can move. The longest-standing
 * player left takes over — which is also what makes kicking a dropped host
 * useful rather than terminal.
 */
function withHost(players: Player[]): Player[] {
  if (players.length === 0 || players.some((p) => p.isHost)) return players
  return players.map((p, index) => (index === 0 ? { ...p, isHost: true } : p))
}

export function removePlayer(state: GameState, playerId: string, kicked = false): GameState {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state
  const players = withHost(state.players.filter((p) => p.id !== playerId))
  const departed = kicked ? 'was dropped from the expedition' : 'left the expedition'

  if (state.phase === 'lobby' || !state.currentRound) {
    return { ...state, players }
  }

  if (players.length < MIN_PLAYERS) {
    return {
      ...state,
      players,
      phase: 'finished',
      currentRound: null,
      log: [...state.log, `${player.name} ${departed} — not enough players to continue.`],
    }
  }

  const log = [...state.log, `${player.name} ${departed}.`]

  if (state.currentRound.phase === 'reveal') {
    const roundScores = { ...state.currentRound.roundScores }
    const distances = { ...state.currentRound.distances }
    const guesses = { ...state.currentRound.guesses }
    delete roundScores[playerId]
    delete distances[playerId]
    delete guesses[playerId]
    return {
      ...state,
      players,
      currentRound: { ...state.currentRound, roundScores, distances, guesses },
      log,
    }
  }

  const guesses = { ...state.currentRound.guesses }
  delete guesses[playerId]
  let round: Round = { ...state.currentRound, guesses }
  let remaining = players

  // The leaver may have been the last hold-out — reveal if everyone left has guessed.
  if (remaining.every((p) => round.guesses[p.id] !== undefined)) {
    round = computeReveal(round, remaining)
    remaining = applyRoundScores(remaining, round)
    log.push(`Round ${round.number}: it was ${round.location.name}, ${round.location.country}.`)
  }

  return { ...state, players: remaining, currentRound: round, log }
}

/**
 * Drop somebody else from the room — the escape hatch for a player who closed
 * their tab mid-round and left everyone else waiting on a guess that will never
 * come.
 *
 * Any member may do it, not only the host: the host is exactly the player whose
 * disappearance freezes a room hardest, and the UI only offers the button for a
 * player presence has reported missing for a while. The room is already a closed
 * set — a 6-character code plus a per-room write token — so the trust boundary
 * is the room, not who inside it presses the button.
 */
export function kickPlayer(state: GameState, playerId: string, targetId: string): GameState {
  // A finished room is a scoreboard; dropping somebody would rewrite the result.
  if (state.phase === 'finished') return state
  if (playerId === targetId) return state
  if (!state.players.some((p) => p.id === playerId)) return state
  if (!state.players.some((p) => p.id === targetId)) return state
  return removePlayer(state, targetId, true)
}

/**
 * Record the reverse-geocoded name of the current round's location. Only the
 * host resolves it (one lookup per round for the whole room, instead of one
 * per player), and it is written once — a late or duplicate answer is ignored.
 */
function setPlace(
  state: GameState,
  playerId: string,
  roundNumber: number,
  place: GeoPlace
): GameState {
  if (state.phase !== 'playing' || !state.currentRound) return state
  if (state.currentRound.number !== roundNumber) return state
  if (state.currentRound.location.place) return state
  if (!state.players.find((p) => p.id === playerId)?.isHost) return state
  if (typeof place.name !== 'string' || place.name.trim().length === 0) return state

  return {
    ...state,
    currentRound: {
      ...state.currentRound,
      location: {
        ...state.currentRound.location,
        place: { name: place.name, country: place.country },
      },
    },
  }
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return startGame(state, action.playerId, Math.random, action.deck)
    case 'SUBMIT_GUESS':
      return submitGuess(state, action.playerId, action.lat, action.lng)
    case 'NEXT_ROUND':
      return nextRound(state, action.playerId)
    case 'PLAY_AGAIN':
      return playAgain(state, action.playerId)
    case 'REMOVE_PLAYER':
      return removePlayer(state, action.playerId)
    case 'KICK_PLAYER':
      return kickPlayer(state, action.playerId, action.targetId)
    case 'SET_PLACE':
      return setPlace(state, action.playerId, action.roundNumber, action.place)
    default:
      return state
  }
}

// ─── Solo mode ───────────────────────────────────────────────────────────────
// Same rounds and scoring, no room: the component keeps a SoloGame in local
// state and advances it through these pure helpers.

export interface SoloRoundResult {
  guess: Guess
  distanceKm: number
  points: number
}

export interface SoloGame {
  rounds: GeoLocation[]
  roundNumber: number
  phase: 'guessing' | 'reveal' | 'finished'
  results: SoloRoundResult[]
  totalScore: number
}

/**
 * Solo is Random World only: the caller always supplies a freshly scouted deck
 * (see `buildRandomWorldDeck`), and unusable entries are dropped here rather
 * than falling back to a curated pool.
 */
export function createSoloGame(deck: GeoLocation[], totalRounds: number = TOTAL_ROUNDS): SoloGame {
  return {
    rounds: deck.filter(isPlayableLocation).slice(0, totalRounds),
    roundNumber: 1,
    phase: 'guessing',
    results: [],
    totalScore: 0,
  }
}

export function currentSoloLocation(game: SoloGame): GeoLocation {
  return game.rounds[game.roundNumber - 1]
}

export function submitSoloGuess(game: SoloGame, lat: number, lng: number): SoloGame {
  if (game.phase !== 'guessing' || !isValidGuess(lat, lng)) return game
  const location = currentSoloLocation(game)
  const km = haversineKm({ lat, lng }, { lat: location.lat, lng: location.lng })
  const points = scoreDistance(km)
  return {
    ...game,
    phase: 'reveal',
    results: [
      ...game.results,
      { guess: { lat, lng }, distanceKm: Math.round(km * 10) / 10, points },
    ],
    totalScore: game.totalScore + points,
  }
}

export function nextSoloRound(game: SoloGame): SoloGame {
  if (game.phase !== 'reveal') return game
  if (game.roundNumber >= game.rounds.length) {
    return { ...game, phase: 'finished' }
  }
  return { ...game, roundNumber: game.roundNumber + 1, phase: 'guessing' }
}
