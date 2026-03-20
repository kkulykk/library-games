import type { GameState } from './schema'
export type { GameState }

import words from '@/data/words/codenames-words.json'

// ─── Types ──────────────────────────────────────────────────────────────────

export type Team = 'red' | 'blue'
export type CardType = 'red' | 'blue' | 'neutral' | 'assassin'
export type GamePhase = 'lobby' | 'playing' | 'finished'
export type TurnPhase = 'giving_clue' | 'guessing'
export type PlayerRole = 'spymaster' | 'operative'

export interface Player {
  id: string
  name: string
  isHost: boolean
  team: Team | null
  role: PlayerRole | null
}

export interface BoardCard {
  word: string
  type: CardType
  revealed: boolean
}

export interface Clue {
  word: string
  count: number
  team: Team
  guessesUsed: number
}

export type GameAction =
  | { type: 'JOIN_TEAM'; playerId: string; team: Team; role: PlayerRole }
  | { type: 'START_GAME'; playerId: string }
  | { type: 'GIVE_CLUE'; playerId: string; word: string; count: number }
  | { type: 'GUESS_CARD'; playerId: string; cardIndex: number }
  | { type: 'END_GUESSING'; playerId: string }
  | { type: 'PLAY_AGAIN'; playerId: string }

// ─── Constants ──────────────────────────────────────────────────────────────

export const BOARD_SIZE = 25
export const FIRST_TEAM_CARDS = 9
export const SECOND_TEAM_CARDS = 8
export const NEUTRAL_CARDS = 7
export const ASSASSIN_CARDS = 1
export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 10

// ─── Helpers ────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickWords(count: number, rng?: () => number): string[] {
  return shuffle(words, rng).slice(0, count)
}

export function generateBoard(startingTeam: Team, rng?: () => number): BoardCard[] {
  const selectedWords = pickWords(BOARD_SIZE, rng)
  const types: CardType[] = [
    ...Array(startingTeam === 'red' ? FIRST_TEAM_CARDS : SECOND_TEAM_CARDS).fill('red'),
    ...Array(startingTeam === 'blue' ? FIRST_TEAM_CARDS : SECOND_TEAM_CARDS).fill('blue'),
    ...Array(NEUTRAL_CARDS).fill('neutral'),
    ...Array(ASSASSIN_CARDS).fill('assassin'),
  ]
  const shuffledTypes = shuffle(types, rng)
  return selectedWords.map((word, i) => ({
    word,
    type: shuffledTypes[i],
    revealed: false,
  }))
}

// ─── State queries ──────────────────────────────────────────────────────────

export function getRemainingCards(board: BoardCard[], team: Team): number {
  return board.filter((c) => c.type === team && !c.revealed).length
}

export function getTeamPlayers(players: Player[], team: Team): Player[] {
  return players.filter((p) => p.team === team)
}

export function getSpymaster(players: Player[], team: Team): Player | undefined {
  return players.find((p) => p.team === team && p.role === 'spymaster')
}

export function getOperatives(players: Player[], team: Team): Player[] {
  return players.filter((p) => p.team === team && p.role === 'operative')
}

export function isSpymaster(players: Player[], playerId: string): boolean {
  return players.find((p) => p.id === playerId)?.role === 'spymaster'
}

export function getPlayerTeam(players: Player[], playerId: string): Team | null {
  return players.find((p) => p.id === playerId)?.team ?? null
}

export function canStartGame(state: GameState): boolean {
  if (state.phase !== 'lobby') return false
  const redSpymaster = getSpymaster(state.players, 'red')
  const blueSpymaster = getSpymaster(state.players, 'blue')
  const redOperatives = getOperatives(state.players, 'red')
  const blueOperatives = getOperatives(state.players, 'blue')
  return (
    state.players.length >= MIN_PLAYERS &&
    !!redSpymaster &&
    !!blueSpymaster &&
    redOperatives.length >= 1 &&
    blueOperatives.length >= 1
  )
}

export function getWinner(state: GameState): Team | null {
  if (state.phase !== 'finished') return null
  return state.winningTeam
}

/** Redact spymaster-only info for operatives (hide card types for unrevealed cards) */
export function redactForPlayer(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId)
  if (player?.role === 'spymaster') return state
  return {
    ...state,
    board: state.board.map((card) =>
      card.revealed ? card : { ...card, type: 'neutral' as CardType }
    ),
  }
}

// ─── State machine ──────────────────────────────────────────────────────────

export function createLobbyState(host: Player): GameState {
  return {
    phase: 'lobby',
    players: [{ ...host, team: null, role: null }],
    board: [],
    currentTeam: 'red',
    turnPhase: 'giving_clue',
    currentClue: null,
    redRemaining: 0,
    blueRemaining: 0,
    winningTeam: null,
    log: [],
  }
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.length >= MAX_PLAYERS) return state
  if (state.players.some((p) => p.id === player.id)) return state
  return {
    ...state,
    players: [...state.players, player],
  }
}

export function removePlayer(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.filter((p) => p.id !== playerId),
  }
}

function joinTeam(state: GameState, playerId: string, team: Team, role: PlayerRole): GameState {
  if (state.phase !== 'lobby') return state

  // Enforce one spymaster per team
  if (role === 'spymaster') {
    const existing = getSpymaster(state.players, team)
    if (existing && existing.id !== playerId) return state
  }

  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, team, role } : p)),
  }
}

function startGame(state: GameState, playerId: string): GameState {
  if (state.phase !== 'lobby') return state
  const host = state.players.find((p) => p.id === playerId)
  if (!host?.isHost) return state
  if (!canStartGame(state)) return state

  const startingTeam: Team = Math.random() < 0.5 ? 'red' : 'blue'
  const board = generateBoard(startingTeam)

  return {
    ...state,
    phase: 'playing',
    board,
    currentTeam: startingTeam,
    turnPhase: 'giving_clue',
    currentClue: null,
    redRemaining: getRemainingCards(board, 'red'),
    blueRemaining: getRemainingCards(board, 'blue'),
    winningTeam: null,
    log: [`Game started! ${startingTeam.toUpperCase()} team goes first.`],
  }
}

function giveClue(state: GameState, playerId: string, word: string, count: number): GameState {
  if (state.phase !== 'playing' || state.turnPhase !== 'giving_clue') return state

  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.team !== state.currentTeam || player.role !== 'spymaster') return state

  const trimmed = word.trim().toUpperCase()
  if (!trimmed || count < 0) return state

  const clue: Clue = { word: trimmed, count, team: state.currentTeam, guessesUsed: 0 }
  return {
    ...state,
    turnPhase: 'guessing',
    currentClue: clue,
    log: [
      ...state.log,
      `${player.name} (${state.currentTeam}) gives clue: "${trimmed}" for ${count}`,
    ],
  }
}

function guessCard(state: GameState, playerId: string, cardIndex: number): GameState {
  if (state.phase !== 'playing' || state.turnPhase !== 'guessing') return state
  if (!state.currentClue) return state

  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.team !== state.currentTeam || player.role !== 'operative') return state

  if (cardIndex < 0 || cardIndex >= BOARD_SIZE) return state
  const card = state.board[cardIndex]
  if (card.revealed) return state

  // Reveal the card
  const newBoard = state.board.map((c, i) => (i === cardIndex ? { ...c, revealed: true } : c))
  const newClue = { ...state.currentClue, guessesUsed: state.currentClue.guessesUsed + 1 }
  const redRemaining = getRemainingCards(newBoard, 'red')
  const blueRemaining = getRemainingCards(newBoard, 'blue')
  const otherTeam: Team = state.currentTeam === 'red' ? 'blue' : 'red'

  const base = {
    ...state,
    board: newBoard,
    currentClue: newClue,
    redRemaining,
    blueRemaining,
  }

  // Assassin — guessing team loses
  if (card.type === 'assassin') {
    return {
      ...base,
      phase: 'finished',
      winningTeam: otherTeam,
      turnPhase: 'giving_clue',
      currentClue: null,
      log: [
        ...state.log,
        `${player.name} revealed "${card.word}" — ASSASSIN! ${otherTeam.toUpperCase()} team wins!`,
      ],
    }
  }

  // Check win conditions (team revealed all their cards)
  if (redRemaining === 0) {
    return {
      ...base,
      phase: 'finished',
      winningTeam: 'red',
      turnPhase: 'giving_clue',
      currentClue: null,
      log: [...state.log, `${player.name} revealed "${card.word}" — RED team found all agents!`],
    }
  }
  if (blueRemaining === 0) {
    return {
      ...base,
      phase: 'finished',
      winningTeam: 'blue',
      turnPhase: 'giving_clue',
      currentClue: null,
      log: [...state.log, `${player.name} revealed "${card.word}" — BLUE team found all agents!`],
    }
  }

  // Correct guess — same team's card
  if (card.type === state.currentTeam) {
    const maxGuesses = newClue.count === 0 ? Infinity : newClue.count + 1
    // Can they keep guessing?
    if (newClue.guessesUsed < maxGuesses) {
      return {
        ...base,
        log: [...state.log, `${player.name} revealed "${card.word}" — correct!`],
      }
    }
    // Used all guesses
    return {
      ...base,
      currentTeam: otherTeam,
      turnPhase: 'giving_clue',
      currentClue: null,
      log: [
        ...state.log,
        `${player.name} revealed "${card.word}" — correct! No more guesses. ${otherTeam.toUpperCase()} team's turn.`,
      ],
    }
  }

  // Wrong guess (neutral or opponent's card) — end turn
  const detail = card.type === 'neutral' ? 'neutral card' : `${card.type.toUpperCase()} team's card`
  return {
    ...base,
    currentTeam: otherTeam,
    turnPhase: 'giving_clue',
    currentClue: null,
    log: [
      ...state.log,
      `${player.name} revealed "${card.word}" — ${detail}. ${otherTeam.toUpperCase()} team's turn.`,
    ],
  }
}

function endGuessing(state: GameState, playerId: string): GameState {
  if (state.phase !== 'playing' || state.turnPhase !== 'guessing') return state

  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.team !== state.currentTeam || player.role !== 'operative') return state

  const otherTeam: Team = state.currentTeam === 'red' ? 'blue' : 'red'
  return {
    ...state,
    currentTeam: otherTeam,
    turnPhase: 'giving_clue',
    currentClue: null,
    log: [
      ...state.log,
      `${state.currentTeam.toUpperCase()} team ends guessing. ${otherTeam.toUpperCase()} team's turn.`,
    ],
  }
}

function playAgain(state: GameState, playerId: string): GameState {
  if (state.phase !== 'finished') return state
  const host = state.players.find((p) => p.id === playerId)
  if (!host?.isHost) return state

  return {
    ...state,
    phase: 'lobby',
    board: [],
    currentTeam: 'red',
    turnPhase: 'giving_clue',
    currentClue: null,
    redRemaining: 0,
    blueRemaining: 0,
    winningTeam: null,
    log: [],
  }
}

// ─── Action dispatcher ──────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'JOIN_TEAM':
      return joinTeam(state, action.playerId, action.team, action.role)
    case 'START_GAME':
      return startGame(state, action.playerId)
    case 'GIVE_CLUE':
      return giveClue(state, action.playerId, action.word, action.count)
    case 'GUESS_CARD':
      return guessCard(state, action.playerId, action.cardIndex)
    case 'END_GUESSING':
      return endGuessing(state, action.playerId)
    case 'PLAY_AGAIN':
      return playAgain(state, action.playerId)
    default:
      return state
  }
}
