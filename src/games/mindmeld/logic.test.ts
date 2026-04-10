import {
  BULLSEYE_POINTS,
  CLOSE_POINTS,
  HIDDEN_TARGET,
  MAX_POINTS_PER_ROUND,
  MEDIUM_POINTS,
  MIN_PLAYERS,
  MISS_POINTS,
  TOTAL_ROUNDS,
  addPlayer,
  allGuessersSubmitted,
  applyAction,
  canStartGame,
  createLobbyState,
  distanceFromTarget,
  getGuessers,
  getLeaderboard,
  getPsychic,
  getSpectra,
  getWinners,
  hasPlayerGuessed,
  isPsychic,
  pickPuzzle,
  redactForPlayer,
  removePlayer,
  scoreGuess,
  shuffle,
  type GameAction,
  type GameState,
  type Player,
} from './logic'

// ─── Deterministic PRNG ──────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeHost(id = 'host', name = 'Alice'): Player {
  return { id, name, isHost: true, score: 0 }
}

function makeGuest(id: string, name: string): Player {
  return { id, name, isHost: false, score: 0 }
}

/** Build a lobby with host + N additional players. */
function lobbyWith(playerNames: string[]): GameState {
  let state = createLobbyState(makeHost('p0', playerNames[0]))
  for (let i = 1; i < playerNames.length; i++) {
    state = addPlayer(state, makeGuest(`p${i}`, playerNames[i]))
  }
  return state
}

/** Run START_GAME from the host. */
function startedGame(playerNames: string[]): GameState {
  const state = lobbyWith(playerNames)
  return applyAction(state, { type: 'START_GAME', playerId: 'p0' })
}

// ─── Basics ─────────────────────────────────────────────────────────────────

describe('getSpectra', () => {
  it('returns at least 15 distinct spectra', () => {
    const spectra = getSpectra()
    expect(spectra.length).toBeGreaterThanOrEqual(15)
    const keys = new Set(spectra.map((s) => `${s.left}|${s.right}`))
    expect(keys.size).toBe(spectra.length)
  })

  it('each spectrum has non-empty labels and hint examples', () => {
    for (const s of getSpectra()) {
      expect(s.left.trim().length).toBeGreaterThan(0)
      expect(s.right.trim().length).toBeGreaterThan(0)
      expect(s.hints.length).toBeGreaterThan(0)
      for (const hint of s.hints) expect(hint.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('pickPuzzle', () => {
  it('returns a puzzle with target in 0-100 range', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 50; i++) {
      const puzzle = pickPuzzle(rng)
      expect(puzzle.target).toBeGreaterThanOrEqual(0)
      expect(puzzle.target).toBeLessThanOrEqual(100)
      expect(puzzle.spectrum.left).not.toBe(puzzle.spectrum.right)
    }
  })

  it('is deterministic for a fixed rng', () => {
    const a = pickPuzzle(mulberry32(42))
    const b = pickPuzzle(mulberry32(42))
    expect(a).toEqual(b)
  })
})

describe('scoreGuess', () => {
  it('awards bullseye points within the bullseye radius', () => {
    expect(scoreGuess(50, 50)).toBe(BULLSEYE_POINTS)
    expect(scoreGuess(47, 50)).toBe(BULLSEYE_POINTS)
    expect(scoreGuess(53, 50)).toBe(BULLSEYE_POINTS)
  })

  it('awards close/medium/miss based on distance', () => {
    expect(scoreGuess(44, 50)).toBe(CLOSE_POINTS)
    expect(scoreGuess(42, 50)).toBe(MEDIUM_POINTS)
    expect(scoreGuess(30, 50)).toBe(MISS_POINTS)
  })

  it('is symmetric', () => {
    expect(scoreGuess(10, 30)).toBe(scoreGuess(30, 10))
  })
})

describe('distanceFromTarget', () => {
  it('returns absolute difference', () => {
    expect(distanceFromTarget(30, 50)).toBe(20)
    expect(distanceFromTarget(70, 50)).toBe(20)
    expect(distanceFromTarget(50, 50)).toBe(0)
  })
})

describe('shuffle', () => {
  it('returns a new array with the same elements', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, mulberry32(1))
    expect(out).not.toBe(input)
    expect(out.sort()).toEqual([1, 2, 3, 4, 5])
  })
})

// ─── Lobby ──────────────────────────────────────────────────────────────────

describe('lobby lifecycle', () => {
  it('creates a lobby with the host', () => {
    const state = createLobbyState(makeHost())
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(1)
    expect(state.players[0].isHost).toBe(true)
    expect(state.players[0].score).toBe(0)
    expect(state.totalRounds).toBe(TOTAL_ROUNDS)
  })

  it('adds players up to the max', () => {
    let state = createLobbyState(makeHost())
    state = addPlayer(state, makeGuest('b', 'Bob'))
    expect(state.players).toHaveLength(2)
    expect(state.players[1].score).toBe(0)
  })

  it('ignores duplicate players', () => {
    let state = createLobbyState(makeHost())
    state = addPlayer(state, makeGuest('b', 'Bob'))
    const next = addPlayer(state, makeGuest('b', 'Bob'))
    expect(next.players).toHaveLength(2)
  })

  it('cannot start with fewer than the minimum players', () => {
    const state = createLobbyState(makeHost())
    expect(canStartGame(state)).toBe(false)
    expect(MIN_PLAYERS).toBeGreaterThanOrEqual(2)
  })

  it('can start with >= MIN_PLAYERS', () => {
    const state = lobbyWith(['A', 'B'])
    expect(canStartGame(state)).toBe(true)
  })

  it('non-host cannot start the game', () => {
    const state = lobbyWith(['A', 'B'])
    const unchanged = applyAction(state, { type: 'START_GAME', playerId: 'p1' })
    expect(unchanged.phase).toBe('lobby')
  })

  it('host START_GAME moves to playing phase and creates a round', () => {
    const state = startedGame(['A', 'B', 'C'])
    expect(state.phase).toBe('playing')
    expect(state.roundNumber).toBe(1)
    expect(state.currentRound).not.toBeNull()
    expect(state.currentRound!.phase).toBe('clue')
    expect(state.currentRound!.target).toBeGreaterThanOrEqual(0)
    expect(state.currentRound!.target).toBeLessThanOrEqual(100)
  })
})

// ─── Playing flow ───────────────────────────────────────────────────────────

describe('playing flow — clue', () => {
  it('only the psychic can submit a clue', () => {
    const started = startedGame(['A', 'B'])
    const psychicId = started.currentRound!.psychicId
    const nonPsychicId = started.players.find((p) => p.id !== psychicId)!.id

    const blocked = applyAction(started, {
      type: 'SUBMIT_CLUE',
      playerId: nonPsychicId,
      clue: 'Hot',
    })
    expect(blocked).toBe(started)

    const after = applyAction(started, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Hot' })
    expect(after.currentRound!.phase).toBe('guessing')
    expect(after.currentRound!.clue).toBe('Hot')
  })

  it('empty clue is rejected', () => {
    const started = startedGame(['A', 'B'])
    const psychicId = started.currentRound!.psychicId
    const after = applyAction(started, {
      type: 'SUBMIT_CLUE',
      playerId: psychicId,
      clue: '   ',
    })
    expect(after).toBe(started)
  })

  it('clues are trimmed and length-limited', () => {
    const started = startedGame(['A', 'B'])
    const psychicId = started.currentRound!.psychicId
    const long = 'x'.repeat(200)
    const after = applyAction(started, {
      type: 'SUBMIT_CLUE',
      playerId: psychicId,
      clue: `  ${long}  `,
    })
    expect(after.currentRound!.clue!.length).toBeLessThanOrEqual(32)
  })
})

describe('playing flow — guessing', () => {
  function setupGuessingPhase() {
    const state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    return applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
  }

  it('psychic cannot submit a guess', () => {
    const state = setupGuessingPhase()
    const psychicId = state.currentRound!.psychicId
    const blocked = applyAction(state, { type: 'SUBMIT_GUESS', playerId: psychicId, guess: 50 })
    expect(blocked).toBe(state)
  })

  it('guessers can lock in a guess', () => {
    const state = setupGuessingPhase()
    const guesser = getGuessers(state)[0]
    const after = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: guesser.id,
      guess: 60,
    })
    expect(hasPlayerGuessed(after, guesser.id)).toBe(true)
    expect(after.currentRound!.guesses[guesser.id]).toBe(60)
    expect(after.currentRound!.phase).toBe('guessing')
  })

  it('clamps guesses to the 0-100 range', () => {
    const state = setupGuessingPhase()
    const guesser = getGuessers(state)[0]
    const low = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guesser.id, guess: -50 })
    expect(low.currentRound!.guesses[guesser.id]).toBe(0)

    const base = setupGuessingPhase()
    const high = applyAction(base, {
      type: 'SUBMIT_GUESS',
      playerId: getGuessers(base)[0].id,
      guess: 250,
    })
    expect(high.currentRound!.guesses[getGuessers(base)[0].id]).toBe(100)
  })

  it('auto-advances to reveal once all guessers submit, and scores', () => {
    let state = setupGuessingPhase()
    const target = state.currentRound!.target
    const guessers = getGuessers(state)

    // Everyone guesses a bullseye.
    for (const g of guessers) {
      state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: g.id, guess: target })
    }
    expect(state.currentRound!.phase).toBe('reveal')
    for (const g of guessers) {
      expect(state.currentRound!.roundScores[g.id]).toBe(BULLSEYE_POINTS)
    }
    // Psychic earns the best guesser's points.
    expect(state.currentRound!.roundScores[state.currentRound!.psychicId]).toBe(BULLSEYE_POINTS)
    // Scores are applied to players.
    for (const player of state.players) {
      expect(player.score).toBe(BULLSEYE_POINTS)
    }
  })

  it('allGuessersSubmitted reflects guess state', () => {
    let state = setupGuessingPhase()
    const guessers = getGuessers(state)
    expect(allGuessersSubmitted(state)).toBe(false)
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guessers[0].id, guess: 50 })
    expect(allGuessersSubmitted(state)).toBe(false)
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guessers[1].id, guess: 50 })
    expect(allGuessersSubmitted(state)).toBe(true)
  })
})

describe('playing flow — reveal & next round', () => {
  function revealed(): GameState {
    let state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
    for (const g of getGuessers(state)) {
      state = applyAction(state, {
        type: 'SUBMIT_GUESS',
        playerId: g.id,
        guess: state.currentRound!.target,
      })
    }
    return state
  }

  it('host REVEAL_ROUND works even if not everyone guessed', () => {
    let state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
    const firstGuesser = getGuessers(state)[0]
    state = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: firstGuesser.id,
      guess: state.currentRound!.target,
    })
    // The other guesser never submits — host force-reveals.
    const after = applyAction(state, { type: 'REVEAL_ROUND', playerId: 'p0' })
    expect(after.currentRound!.phase).toBe('reveal')
  })

  it('REVEAL_ROUND requires at least one guess', () => {
    let state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
    const after = applyAction(state, { type: 'REVEAL_ROUND', playerId: 'p0' })
    expect(after).toBe(state)
  })

  it('host NEXT_ROUND advances the round and rotates the psychic', () => {
    const state = revealed()
    const prevPsychic = state.currentRound!.psychicId
    const after = applyAction(state, { type: 'NEXT_ROUND', playerId: 'p0' })
    expect(after.roundNumber).toBe(2)
    expect(after.currentRound!.psychicId).not.toBe(prevPsychic)
    expect(after.currentRound!.phase).toBe('clue')
  })

  it('non-host cannot advance the round', () => {
    const state = revealed()
    const nonHost = state.players.find((p) => !p.isHost)!
    const unchanged = applyAction(state, { type: 'NEXT_ROUND', playerId: nonHost.id })
    expect(unchanged).toBe(state)
  })

  it('finishes the game after the final round', () => {
    let state = startedGame(['A', 'B'])
    // Fast-forward through all rounds by revealing and advancing.
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      const psychicId = state.currentRound!.psychicId
      state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'x' })
      for (const g of getGuessers(state)) {
        state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: g.id, guess: 50 })
      }
      state = applyAction(state, { type: 'NEXT_ROUND', playerId: 'p0' })
    }
    expect(state.phase).toBe('finished')
    expect(state.currentRound).toBeNull()
  })
})

// ─── Redaction ──────────────────────────────────────────────────────────────

describe('redactForPlayer', () => {
  function guessingState() {
    const state = startedGame(['A', 'B'])
    const psychicId = state.currentRound!.psychicId
    return applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
  }

  it('hides target from non-psychic during guessing', () => {
    const state = guessingState()
    const other = state.players.find((p) => p.id !== state.currentRound!.psychicId)!
    const redacted = redactForPlayer(state, other.id)
    expect(redacted.currentRound!.target).toBe(HIDDEN_TARGET)
  })

  it('keeps target visible to the psychic', () => {
    const state = guessingState()
    const psychicId = state.currentRound!.psychicId
    const redacted = redactForPlayer(state, psychicId)
    expect(redacted.currentRound!.target).toBe(state.currentRound!.target)
  })

  it('reveals target to everyone during reveal phase', () => {
    let state = guessingState()
    const guesser = getGuessers(state)[0]
    state = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: guesser.id,
      guess: state.currentRound!.target,
    })
    expect(state.currentRound!.phase).toBe('reveal')
    const redacted = redactForPlayer(state, guesser.id)
    expect(redacted.currentRound!.target).toBe(state.currentRound!.target)
  })

  it('is a no-op when there is no current round', () => {
    const state = createLobbyState(makeHost())
    expect(redactForPlayer(state, 'p0')).toBe(state)
  })
})

// ─── Leaving ────────────────────────────────────────────────────────────────

describe('removePlayer', () => {
  it('just removes in the lobby', () => {
    const state = lobbyWith(['A', 'B', 'C'])
    const after = removePlayer(state, 'p1')
    expect(after.players).toHaveLength(2)
    expect(after.phase).toBe('lobby')
  })

  it('finishes the game if fewer than MIN_PLAYERS remain mid-game', () => {
    const state = startedGame(['A', 'B'])
    const after = removePlayer(state, 'p1')
    expect(after.phase).toBe('finished')
  })

  it('replaces the psychic and restarts the round if the psychic leaves', () => {
    let state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
    const after = removePlayer(state, psychicId)
    expect(after.phase).toBe('playing')
    expect(after.currentRound!.psychicId).not.toBe(psychicId)
    expect(after.currentRound!.phase).toBe('clue')
  })

  it('drops a guesser mid-round and keeps playing', () => {
    let state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
    const nonPsychic = getGuessers(state)[0]
    const after = removePlayer(state, nonPsychic.id)
    expect(after.players).toHaveLength(2)
    expect(after.currentRound!.phase).toBe('guessing')
  })

  it('auto-reveals when the last remaining guesser has already submitted', () => {
    let state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
    const guessers = getGuessers(state)
    state = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: guessers[0].id,
      guess: state.currentRound!.target,
    })
    // The only other guesser leaves.
    const after = removePlayer(state, guessers[1].id)
    expect(after.currentRound!.phase).toBe('reveal')
  })
})

// ─── Queries ────────────────────────────────────────────────────────────────

describe('state queries', () => {
  it('getPsychic returns the current psychic', () => {
    const state = startedGame(['A', 'B'])
    const psychic = getPsychic(state)
    expect(psychic?.id).toBe(state.currentRound!.psychicId)
  })

  it('isPsychic identifies the psychic', () => {
    const state = startedGame(['A', 'B'])
    const psychicId = state.currentRound!.psychicId
    expect(isPsychic(state, psychicId)).toBe(true)
    const other = state.players.find((p) => p.id !== psychicId)!
    expect(isPsychic(state, other.id)).toBe(false)
  })

  it('getLeaderboard sorts by score desc', () => {
    const state = startedGame(['A', 'B', 'C'])
    const withScores: GameState = {
      ...state,
      players: state.players.map((p, i) => ({ ...p, score: i * 2 })),
    }
    const board = getLeaderboard(withScores)
    expect(board[0].score).toBeGreaterThanOrEqual(board[board.length - 1].score)
  })

  it('getWinners returns everyone tied at the top', () => {
    const state = startedGame(['A', 'B', 'C'])
    const withScores: GameState = {
      ...state,
      players: [
        { ...state.players[0], score: 10 },
        { ...state.players[1], score: 10 },
        { ...state.players[2], score: 4 },
      ],
    }
    const winners = getWinners(withScores)
    expect(winners).toHaveLength(2)
  })

  it('MAX_POINTS_PER_ROUND equals bullseye points', () => {
    expect(MAX_POINTS_PER_ROUND).toBe(BULLSEYE_POINTS)
  })
})

// ─── Play again ─────────────────────────────────────────────────────────────

describe('PLAY_AGAIN', () => {
  it('host can return to lobby after finished; scores reset', () => {
    let state = startedGame(['A', 'B']) as GameState
    // finish quickly
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      const psychicId = state.currentRound!.psychicId
      state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'x' })
      for (const g of getGuessers(state)) {
        state = applyAction(state, {
          type: 'SUBMIT_GUESS',
          playerId: g.id,
          guess: state.currentRound!.target,
        })
      }
      state = applyAction(state, { type: 'NEXT_ROUND', playerId: 'p0' })
    }
    expect(state.phase).toBe('finished')
    const after = applyAction(state, { type: 'PLAY_AGAIN', playerId: 'p0' })
    expect(after.phase).toBe('lobby')
    expect(after.roundNumber).toBe(0)
    for (const p of after.players) expect(p.score).toBe(0)
  })

  it('non-host cannot replay', () => {
    const state: GameState = {
      ...lobbyWith(['A', 'B']),
      phase: 'finished',
    }
    const unchanged = applyAction(state, { type: 'PLAY_AGAIN', playerId: 'p1' })
    expect(unchanged).toBe(state)
  })
})

// ─── Unknown actions ────────────────────────────────────────────────────────

describe('applyAction', () => {
  it('returns the same state for unknown action types', () => {
    const state = lobbyWith(['A', 'B'])
    const weird = applyAction(state, { type: 'NONSENSE' } as unknown as GameAction)
    expect(weird).toBe(state)
  })
})
