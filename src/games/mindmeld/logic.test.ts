import {
  BULLSEYE_POINTS,
  HIDDEN_TARGET,
  MAX_POINTS_PER_ROUND,
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
  type GameState,
  type Player,
} from './logic'

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

function lobbyWith(playerNames: string[]): GameState {
  let state = createLobbyState(makeHost('p0', playerNames[0]))
  for (let i = 1; i < playerNames.length; i++) {
    state = addPlayer(state, makeGuest(`p${i}`, playerNames[i]))
  }
  return state
}

function startedGame(playerNames: string[]): GameState {
  const state = lobbyWith(playerNames)
  return applyAction(state, { type: 'START_GAME', playerId: 'p0' })
}

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

  it('returns miss points outside the scoring window', () => {
    expect(scoreGuess(10, 50)).toBe(MISS_POINTS)
  })
})

describe('distanceFromTarget', () => {
  it('returns absolute difference', () => {
    expect(distanceFromTarget(30, 50)).toBe(20)
    expect(distanceFromTarget(70, 50)).toBe(20)
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

describe('lobby lifecycle', () => {
  it('creates a lobby with the host', () => {
    const state = createLobbyState(makeHost())
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(1)
    expect(state.players[0].isHost).toBe(true)
    expect(state.totalRounds).toBe(TOTAL_ROUNDS)
  })

  it('adds players up to the max', () => {
    let state = createLobbyState(makeHost())
    state = addPlayer(state, makeGuest('b', 'Bob'))
    expect(state.players).toHaveLength(2)
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

  it('host START_GAME moves to playing phase and creates a round', () => {
    const state = startedGame(['A', 'B', 'C'])
    expect(state.phase).toBe('playing')
    expect(state.roundNumber).toBe(1)
    expect(state.currentRound?.phase).toBe('clue')
    expect(state.currentRound?.teamGuess).toBeNull()
  })
})

describe('playing flow', () => {
  function setupGuessingPhase() {
    const state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    return applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
  }

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

  it('guessers lock one shared team guess and auto-reveal', () => {
    const state = setupGuessingPhase()
    const guesser = getGuessers(state)[0]
    const after = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: guesser.id,
      guess: 60,
    })

    expect(after.currentRound!.phase).toBe('reveal')
    expect(after.currentRound!.teamGuess).toBe(60)
    expect(after.currentRound!.guessLockedBy).toBe(guesser.id)
    expect(hasPlayerGuessed(after, guesser.id)).toBe(true)
    expect(allGuessersSubmitted(after)).toBe(true)
  })

  it('clamps the shared guess to the 0-100 range', () => {
    const state = setupGuessingPhase()
    const guesser = getGuessers(state)[0]
    const low = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guesser.id, guess: -50 })
    expect(low.currentRound!.teamGuess).toBe(0)

    const high = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guesser.id, guess: 250 })
    expect(high.currentRound!.teamGuess).toBe(100)
  })

  it('awards the same round score to the whole table', () => {
    const state = setupGuessingPhase()
    const guesser = getGuessers(state)[0]
    const after = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: guesser.id,
      guess: state.currentRound!.target,
    })

    for (const player of after.players) {
      expect(player.score).toBe(BULLSEYE_POINTS)
      expect(after.currentRound!.roundScores[player.id]).toBe(BULLSEYE_POINTS)
    }
  })

  it('psychic cannot lock the dial', () => {
    const state = setupGuessingPhase()
    const psychicId = state.currentRound!.psychicId
    const blocked = applyAction(state, { type: 'SUBMIT_GUESS', playerId: psychicId, guess: 50 })
    expect(blocked).toBe(state)
  })
})

describe('reveal and round advancement', () => {
  function revealed(): GameState {
    let state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
    state = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: getGuessers(state)[0].id,
      guess: state.currentRound!.target,
    })
    return state
  }

  it('host NEXT_ROUND advances the round and rotates the psychic', () => {
    const state = revealed()
    const prevPsychic = state.currentRound!.psychicId
    const after = applyAction(state, { type: 'NEXT_ROUND', playerId: 'p0' })
    expect(after.roundNumber).toBe(2)
    expect(after.currentRound!.psychicId).not.toBe(prevPsychic)
    expect(after.currentRound!.phase).toBe('clue')
  })

  it('finishes the game after the final round', () => {
    let state = startedGame(['A', 'B'])
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      const psychicId = state.currentRound!.psychicId
      state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'x' })
      state = applyAction(state, {
        type: 'SUBMIT_GUESS',
        playerId: getGuessers(state)[0].id,
        guess: 50,
      })
      state = applyAction(state, { type: 'NEXT_ROUND', playerId: 'p0' })
    }
    expect(state.phase).toBe('finished')
    expect(state.currentRound).toBeNull()
  })
})

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
    state = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: getGuessers(state)[0].id,
      guess: state.currentRound!.target,
    })
    const guesser = getGuessers(state)[0]
    const redacted = redactForPlayer(state, guesser.id)
    expect(redacted.currentRound!.target).toBe(state.currentRound!.target)
  })
})

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
    const state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    const after = removePlayer(state, psychicId)
    expect(after.phase).toBe('playing')
    expect(after.currentRound!.psychicId).not.toBe(psychicId)
    expect(after.currentRound!.phase).toBe('clue')
  })

  it('unlocks the shared dial if the locker leaves before reveal', () => {
    let state = startedGame(['A', 'B', 'C'])
    const psychicId = state.currentRound!.psychicId
    state = applyAction(state, { type: 'SUBMIT_CLUE', playerId: psychicId, clue: 'Warm' })
    state = {
      ...state,
      currentRound: {
        ...state.currentRound!,
        teamGuess: 72,
        guessLockedBy: getGuessers(state)[0].id,
      },
    }

    const after = removePlayer(state, state.currentRound!.guessLockedBy!)
    expect(after.currentRound!.teamGuess).toBeNull()
    expect(after.currentRound!.guessLockedBy).toBeNull()
    expect(after.currentRound!.phase).toBe('guessing')
  })
})

describe('state queries', () => {
  it('getPsychic returns the current psychic', () => {
    const state = startedGame(['A', 'B'])
    expect(getPsychic(state)?.id).toBe(state.currentRound!.psychicId)
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
    expect(getWinners(withScores)).toHaveLength(2)
  })

  it('MAX_POINTS_PER_ROUND equals bullseye points', () => {
    expect(MAX_POINTS_PER_ROUND).toBe(BULLSEYE_POINTS)
  })
})
