import {
  shuffle,
  pickWords,
  generateBoard,
  getRemainingCards,
  getTeamPlayers,
  getSpymaster,
  getOperatives,
  isSpymaster,
  getPlayerTeam,
  canStartGame,
  getWinner,
  redactForPlayer,
  createLobbyState,
  addPlayer,
  removePlayer,
  applyAction,
  BOARD_SIZE,
  FIRST_TEAM_CARDS,
  SECOND_TEAM_CARDS,
  NEUTRAL_CARDS,
  ASSASSIN_CARDS,
  type Player,
  type GameState,
  type BoardCard,
  type Team,
} from './logic'

// ─── Helpers ────────────────────────────────────────────────────────────────

const makePlayer = (
  id: string,
  name: string,
  isHost = false,
  team: Team | null = null,
  role: 'spymaster' | 'operative' | null = null
): Player => ({ id, name, isHost, team, role })

const host = makePlayer('p1', 'Alice', true)
const p2 = makePlayer('p2', 'Bob')
const p3 = makePlayer('p3', 'Carol')
const p4 = makePlayer('p4', 'Dave')

function makeLobby(...players: Player[]): GameState {
  let state = createLobbyState(players[0])
  for (const p of players.slice(1)) state = addPlayer(state, p)
  return state
}

function makeReadyLobby(): GameState {
  let state = makeLobby(host, p2, p3, p4)
  state = applyAction(state, { type: 'JOIN_TEAM', playerId: 'p1', team: 'red', role: 'spymaster' })
  state = applyAction(state, {
    type: 'JOIN_TEAM',
    playerId: 'p2',
    team: 'red',
    role: 'operative',
  })
  state = applyAction(state, {
    type: 'JOIN_TEAM',
    playerId: 'p3',
    team: 'blue',
    role: 'spymaster',
  })
  state = applyAction(state, {
    type: 'JOIN_TEAM',
    playerId: 'p4',
    team: 'blue',
    role: 'operative',
  })
  return state
}

function makePlayingState(): GameState {
  const state = makeReadyLobby()
  return applyAction(state, { type: 'START_GAME', playerId: 'p1' })
}

// ─── shuffle ────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffle(arr)).toHaveLength(arr.length)
  })

  it('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffle(arr).sort()).toEqual(arr.sort())
  })

  it('does not mutate original', () => {
    const arr = [1, 2, 3]
    const copy = [...arr]
    shuffle(arr)
    expect(arr).toEqual(copy)
  })

  it('uses provided rng', () => {
    let call = 0
    const rng = () => {
      call++
      return 0.5
    }
    shuffle([1, 2, 3], rng)
    expect(call).toBeGreaterThan(0)
  })
})

// ─── pickWords ──────────────────────────────────────────────────────────────

describe('pickWords', () => {
  it('picks the requested number of words', () => {
    expect(pickWords(25)).toHaveLength(25)
  })

  it('picks unique words', () => {
    const words = pickWords(25)
    expect(new Set(words).size).toBe(25)
  })
})

// ─── generateBoard ──────────────────────────────────────────────────────────

describe('generateBoard', () => {
  it('creates 25 cards', () => {
    expect(generateBoard('red')).toHaveLength(BOARD_SIZE)
  })

  it('has correct card type distribution when red starts', () => {
    const board = generateBoard('red')
    expect(board.filter((c) => c.type === 'red')).toHaveLength(FIRST_TEAM_CARDS)
    expect(board.filter((c) => c.type === 'blue')).toHaveLength(SECOND_TEAM_CARDS)
    expect(board.filter((c) => c.type === 'neutral')).toHaveLength(NEUTRAL_CARDS)
    expect(board.filter((c) => c.type === 'assassin')).toHaveLength(ASSASSIN_CARDS)
  })

  it('has correct card type distribution when blue starts', () => {
    const board = generateBoard('blue')
    expect(board.filter((c) => c.type === 'blue')).toHaveLength(FIRST_TEAM_CARDS)
    expect(board.filter((c) => c.type === 'red')).toHaveLength(SECOND_TEAM_CARDS)
    expect(board.filter((c) => c.type === 'neutral')).toHaveLength(NEUTRAL_CARDS)
    expect(board.filter((c) => c.type === 'assassin')).toHaveLength(ASSASSIN_CARDS)
  })

  it('all cards start unrevealed', () => {
    const board = generateBoard('red')
    expect(board.every((c) => !c.revealed)).toBe(true)
  })
})

// ─── State queries ──────────────────────────────────────────────────────────

describe('getRemainingCards', () => {
  it('counts unrevealed team cards', () => {
    const board: BoardCard[] = [
      { word: 'A', type: 'red', revealed: false },
      { word: 'B', type: 'red', revealed: true },
      { word: 'C', type: 'red', revealed: false },
      { word: 'D', type: 'blue', revealed: false },
    ]
    expect(getRemainingCards(board, 'red')).toBe(2)
    expect(getRemainingCards(board, 'blue')).toBe(1)
  })
})

describe('team player queries', () => {
  const players: Player[] = [
    makePlayer('1', 'A', true, 'red', 'spymaster'),
    makePlayer('2', 'B', false, 'red', 'operative'),
    makePlayer('3', 'C', false, 'blue', 'spymaster'),
    makePlayer('4', 'D', false, 'blue', 'operative'),
  ]

  it('getTeamPlayers returns correct team', () => {
    expect(getTeamPlayers(players, 'red')).toHaveLength(2)
    expect(getTeamPlayers(players, 'blue')).toHaveLength(2)
  })

  it('getSpymaster returns correct player', () => {
    expect(getSpymaster(players, 'red')?.id).toBe('1')
    expect(getSpymaster(players, 'blue')?.id).toBe('3')
  })

  it('getOperatives returns correct players', () => {
    expect(getOperatives(players, 'red').map((p) => p.id)).toEqual(['2'])
    expect(getOperatives(players, 'blue').map((p) => p.id)).toEqual(['4'])
  })

  it('isSpymaster checks correctly', () => {
    expect(isSpymaster(players, '1')).toBe(true)
    expect(isSpymaster(players, '2')).toBe(false)
  })

  it('getPlayerTeam returns team or null', () => {
    expect(getPlayerTeam(players, '1')).toBe('red')
    expect(getPlayerTeam(players, 'unknown')).toBeNull()
  })
})

// ─── canStartGame ───────────────────────────────────────────────────────────

describe('canStartGame', () => {
  it('returns false with fewer than 4 players', () => {
    const state = makeLobby(host, p2, p3)
    expect(canStartGame(state)).toBe(false)
  })

  it('returns false without spymasters', () => {
    let state = makeLobby(host, p2, p3, p4)
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p1',
      team: 'red',
      role: 'operative',
    })
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p2',
      team: 'red',
      role: 'operative',
    })
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p3',
      team: 'blue',
      role: 'operative',
    })
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p4',
      team: 'blue',
      role: 'operative',
    })
    expect(canStartGame(state)).toBe(false)
  })

  it('returns true when properly configured', () => {
    expect(canStartGame(makeReadyLobby())).toBe(true)
  })
})

// ─── createLobbyState / addPlayer / removePlayer ────────────────────────────

describe('lobby management', () => {
  it('creates lobby with host', () => {
    const state = createLobbyState(host)
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(1)
    expect(state.players[0].isHost).toBe(true)
  })

  it('adds players', () => {
    const state = addPlayer(createLobbyState(host), p2)
    expect(state.players).toHaveLength(2)
  })

  it('does not add duplicate player', () => {
    const state = addPlayer(createLobbyState(host), host)
    expect(state.players).toHaveLength(1)
  })

  it('removes player', () => {
    let state = makeLobby(host, p2)
    state = removePlayer(state, 'p2')
    expect(state.players).toHaveLength(1)
  })

  it('does not add beyond max', () => {
    let state = createLobbyState(host)
    for (let i = 2; i <= 11; i++) {
      state = addPlayer(state, makePlayer(`p${i}`, `P${i}`))
    }
    expect(state.players).toHaveLength(10)
  })
})

// ─── JOIN_TEAM ──────────────────────────────────────────────────────────────

describe('JOIN_TEAM', () => {
  it('assigns team and role', () => {
    let state = makeLobby(host, p2)
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p1',
      team: 'red',
      role: 'spymaster',
    })
    const player = state.players.find((p) => p.id === 'p1')
    expect(player?.team).toBe('red')
    expect(player?.role).toBe('spymaster')
  })

  it('prevents two spymasters on same team', () => {
    let state = makeLobby(host, p2)
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p1',
      team: 'red',
      role: 'spymaster',
    })
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p2',
      team: 'red',
      role: 'spymaster',
    })
    expect(state.players.find((p) => p.id === 'p2')?.role).toBeNull()
  })

  it('allows switching teams', () => {
    let state = makeLobby(host, p2)
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p1',
      team: 'red',
      role: 'operative',
    })
    state = applyAction(state, {
      type: 'JOIN_TEAM',
      playerId: 'p1',
      team: 'blue',
      role: 'operative',
    })
    expect(state.players.find((p) => p.id === 'p1')?.team).toBe('blue')
  })
})

// ─── START_GAME ─────────────────────────────────────────────────────────────

describe('START_GAME', () => {
  it('starts when ready', () => {
    const state = makePlayingState()
    expect(state.phase).toBe('playing')
    expect(state.board).toHaveLength(BOARD_SIZE)
    expect(state.turnPhase).toBe('giving_clue')
  })

  it('does not start if not host', () => {
    const lobby = makeReadyLobby()
    const state = applyAction(lobby, { type: 'START_GAME', playerId: 'p2' })
    expect(state.phase).toBe('lobby')
  })

  it('does not start if not ready', () => {
    const lobby = makeLobby(host, p2)
    const state = applyAction(lobby, { type: 'START_GAME', playerId: 'p1' })
    expect(state.phase).toBe('lobby')
  })

  it('sets correct remaining card counts', () => {
    const state = makePlayingState()
    const totalRemaining = state.redRemaining + state.blueRemaining
    expect(totalRemaining).toBe(FIRST_TEAM_CARDS + SECOND_TEAM_CARDS)
  })
})

// ─── GIVE_CLUE ──────────────────────────────────────────────────────────────

describe('GIVE_CLUE', () => {
  it('spymaster can give clue on their turn', () => {
    let state = makePlayingState()
    const spymasterId = state.currentTeam === 'red' ? 'p1' : 'p3'
    state = applyAction(state, { type: 'GIVE_CLUE', playerId: spymasterId, word: 'test', count: 2 })
    expect(state.turnPhase).toBe('guessing')
    expect(state.currentClue).not.toBeNull()
    expect(state.currentClue?.word).toBe('TEST')
    expect(state.currentClue?.count).toBe(2)
  })

  it('operative cannot give clue', () => {
    let state = makePlayingState()
    const operativeId = state.currentTeam === 'red' ? 'p2' : 'p4'
    const before = { ...state }
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: operativeId,
      word: 'test',
      count: 2,
    })
    expect(state.turnPhase).toBe(before.turnPhase)
  })

  it('wrong team spymaster cannot give clue', () => {
    let state = makePlayingState()
    const wrongSpymasterId = state.currentTeam === 'red' ? 'p3' : 'p1'
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: wrongSpymasterId,
      word: 'test',
      count: 2,
    })
    expect(state.turnPhase).toBe('giving_clue')
  })

  it('rejects empty clue', () => {
    let state = makePlayingState()
    const spymasterId = state.currentTeam === 'red' ? 'p1' : 'p3'
    state = applyAction(state, { type: 'GIVE_CLUE', playerId: spymasterId, word: '  ', count: 2 })
    expect(state.turnPhase).toBe('giving_clue')
  })
})

// ─── GUESS_CARD ─────────────────────────────────────────────────────────────

describe('GUESS_CARD', () => {
  function setupGuessing(): GameState {
    let state = makePlayingState()
    const spymasterId = state.currentTeam === 'red' ? 'p1' : 'p3'
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: spymasterId,
      word: 'test',
      count: 2,
    })
    return state
  }

  it('operative can guess a card', () => {
    let state = setupGuessing()
    const operativeId = state.currentTeam === 'red' ? 'p2' : 'p4'
    const unrevealed = state.board.findIndex((c) => !c.revealed)
    state = applyAction(state, { type: 'GUESS_CARD', playerId: operativeId, cardIndex: unrevealed })
    expect(state.board[unrevealed].revealed).toBe(true)
  })

  it('cannot guess already revealed card', () => {
    let state = setupGuessing()
    const operativeId = state.currentTeam === 'red' ? 'p2' : 'p4'
    const idx = state.board.findIndex((c) => !c.revealed)
    state = applyAction(state, { type: 'GUESS_CARD', playerId: operativeId, cardIndex: idx })
    const afterFirst = { ...state }
    state = applyAction(state, { type: 'GUESS_CARD', playerId: operativeId, cardIndex: idx })
    // State shouldn't change if already revealed
    expect(state.currentClue?.guessesUsed).toBe(afterFirst.currentClue?.guessesUsed)
  })

  it('correct guess allows continued guessing', () => {
    let state = setupGuessing()
    const team = state.currentTeam
    const operativeId = team === 'red' ? 'p2' : 'p4'
    const correctIdx = state.board.findIndex((c) => c.type === team && !c.revealed)
    state = applyAction(state, { type: 'GUESS_CARD', playerId: operativeId, cardIndex: correctIdx })
    // Should still be guessing for same team
    expect(state.currentTeam).toBe(team)
    expect(state.turnPhase).toBe('guessing')
  })

  it('neutral guess ends turn', () => {
    let state = setupGuessing()
    const team = state.currentTeam
    const operativeId = team === 'red' ? 'p2' : 'p4'
    const neutralIdx = state.board.findIndex((c) => c.type === 'neutral')
    state = applyAction(state, { type: 'GUESS_CARD', playerId: operativeId, cardIndex: neutralIdx })
    expect(state.currentTeam).not.toBe(team)
    expect(state.turnPhase).toBe('giving_clue')
  })

  it('opponent card guess ends turn', () => {
    let state = setupGuessing()
    const team = state.currentTeam
    const otherTeam = team === 'red' ? 'blue' : 'red'
    const operativeId = team === 'red' ? 'p2' : 'p4'
    const opponentIdx = state.board.findIndex((c) => c.type === otherTeam)
    state = applyAction(state, {
      type: 'GUESS_CARD',
      playerId: operativeId,
      cardIndex: opponentIdx,
    })
    expect(state.currentTeam).toBe(otherTeam)
  })

  it('assassin guess ends game', () => {
    let state = setupGuessing()
    const team = state.currentTeam
    const otherTeam = team === 'red' ? 'blue' : 'red'
    const operativeId = team === 'red' ? 'p2' : 'p4'
    const assassinIdx = state.board.findIndex((c) => c.type === 'assassin')
    state = applyAction(state, {
      type: 'GUESS_CARD',
      playerId: operativeId,
      cardIndex: assassinIdx,
    })
    expect(state.phase).toBe('finished')
    expect(state.winningTeam).toBe(otherTeam)
  })

  it('revealing all team cards wins', () => {
    let state = makePlayingState()
    const team = state.currentTeam
    const operativeId = team === 'red' ? 'p2' : 'p4'
    const spymasterId = team === 'red' ? 'p1' : 'p3'

    // Give a clue with 0 (unlimited guesses)
    state = applyAction(state, { type: 'GIVE_CLUE', playerId: spymasterId, word: 'win', count: 0 })

    // Guess all team cards
    const teamIndices = state.board.map((c, i) => (c.type === team ? i : -1)).filter((i) => i >= 0)

    for (const idx of teamIndices) {
      if (state.phase === 'finished') break
      state = applyAction(state, { type: 'GUESS_CARD', playerId: operativeId, cardIndex: idx })
    }
    expect(state.phase).toBe('finished')
    expect(state.winningTeam).toBe(team)
  })

  it('exhausting guesses ends turn', () => {
    let state = makePlayingState()
    const team = state.currentTeam
    const spymasterId = team === 'red' ? 'p1' : 'p3'
    const operativeId = team === 'red' ? 'p2' : 'p4'

    // Clue for 1 — allows max 2 guesses (count + 1)
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: spymasterId,
      word: 'limit',
      count: 1,
    })

    // Find two correct cards
    const teamCards = state.board
      .map((c, i) => (c.type === team && !c.revealed ? i : -1))
      .filter((i) => i >= 0)

    // First correct guess
    state = applyAction(state, {
      type: 'GUESS_CARD',
      playerId: operativeId,
      cardIndex: teamCards[0],
    })
    expect(state.currentTeam).toBe(team) // Still our turn

    // Second correct guess — should end turn (2 guesses = count+1)
    state = applyAction(state, {
      type: 'GUESS_CARD',
      playerId: operativeId,
      cardIndex: teamCards[1],
    })
    expect(state.currentTeam).not.toBe(team)
  })

  it('spymaster cannot guess', () => {
    let state = setupGuessing()
    const spymasterId = state.currentTeam === 'red' ? 'p1' : 'p3'
    const idx = state.board.findIndex((c) => !c.revealed)
    const before = state.board[idx].revealed
    state = applyAction(state, { type: 'GUESS_CARD', playerId: spymasterId, cardIndex: idx })
    expect(state.board[idx].revealed).toBe(before)
  })

  it('rejects out of bounds index', () => {
    let state = setupGuessing()
    const operativeId = state.currentTeam === 'red' ? 'p2' : 'p4'
    const before = { ...state }
    state = applyAction(state, { type: 'GUESS_CARD', playerId: operativeId, cardIndex: 30 })
    expect(state.board).toEqual(before.board)
  })
})

// ─── END_GUESSING ───────────────────────────────────────────────────────────

describe('END_GUESSING', () => {
  it('operative can end guessing', () => {
    let state = makePlayingState()
    const team = state.currentTeam
    const spymasterId = team === 'red' ? 'p1' : 'p3'
    const operativeId = team === 'red' ? 'p2' : 'p4'
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: spymasterId,
      word: 'test',
      count: 2,
    })
    state = applyAction(state, { type: 'END_GUESSING', playerId: operativeId })
    expect(state.currentTeam).not.toBe(team)
    expect(state.turnPhase).toBe('giving_clue')
    expect(state.currentClue).toBeNull()
  })

  it('spymaster cannot end guessing', () => {
    let state = makePlayingState()
    const team = state.currentTeam
    const spymasterId = team === 'red' ? 'p1' : 'p3'
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: spymasterId,
      word: 'test',
      count: 2,
    })
    const before = state.currentTeam
    state = applyAction(state, { type: 'END_GUESSING', playerId: spymasterId })
    expect(state.currentTeam).toBe(before)
  })
})

// ─── PLAY_AGAIN ─────────────────────────────────────────────────────────────

describe('PLAY_AGAIN', () => {
  it('host can restart from finished', () => {
    let state = makePlayingState()
    const team = state.currentTeam
    const spymasterId = team === 'red' ? 'p1' : 'p3'
    const operativeId = team === 'red' ? 'p2' : 'p4'
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: spymasterId,
      word: 'test',
      count: 2,
    })
    const assassinIdx = state.board.findIndex((c) => c.type === 'assassin')
    state = applyAction(state, {
      type: 'GUESS_CARD',
      playerId: operativeId,
      cardIndex: assassinIdx,
    })
    expect(state.phase).toBe('finished')
    state = applyAction(state, { type: 'PLAY_AGAIN', playerId: 'p1' })
    expect(state.phase).toBe('lobby')
    expect(state.board).toHaveLength(0)
  })

  it('non-host cannot restart', () => {
    let state = makePlayingState()
    const team = state.currentTeam
    const spymasterId = team === 'red' ? 'p1' : 'p3'
    const operativeId = team === 'red' ? 'p2' : 'p4'
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: spymasterId,
      word: 'test',
      count: 2,
    })
    const assassinIdx = state.board.findIndex((c) => c.type === 'assassin')
    state = applyAction(state, {
      type: 'GUESS_CARD',
      playerId: operativeId,
      cardIndex: assassinIdx,
    })
    state = applyAction(state, { type: 'PLAY_AGAIN', playerId: 'p2' })
    expect(state.phase).toBe('finished')
  })
})

// ─── redactForPlayer ────────────────────────────────────────────────────────

describe('redactForPlayer', () => {
  it('spymaster sees all card types', () => {
    const state = makePlayingState()
    const spymasterId = state.currentTeam === 'red' ? 'p1' : 'p3'
    const redacted = redactForPlayer(state, spymasterId)
    expect(redacted.board).toEqual(state.board)
  })

  it('operative sees neutral for unrevealed cards', () => {
    const state = makePlayingState()
    const operativeId = state.currentTeam === 'red' ? 'p2' : 'p4'
    const redacted = redactForPlayer(state, operativeId)
    const unrevealed = redacted.board.filter((c) => !c.revealed)
    expect(unrevealed.every((c) => c.type === 'neutral')).toBe(true)
  })

  it('operative sees correct type for revealed cards', () => {
    let state = makePlayingState()
    const team = state.currentTeam
    const spymasterId = team === 'red' ? 'p1' : 'p3'
    const operativeId = team === 'red' ? 'p2' : 'p4'
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: spymasterId,
      word: 'test',
      count: 2,
    })
    const idx = state.board.findIndex((c) => !c.revealed)
    const originalType = state.board[idx].type
    state = applyAction(state, { type: 'GUESS_CARD', playerId: operativeId, cardIndex: idx })
    const redacted = redactForPlayer(state, operativeId)
    expect(redacted.board[idx].type).toBe(originalType)
    expect(redacted.board[idx].revealed).toBe(true)
  })
})

// ─── getWinner ──────────────────────────────────────────────────────────────

describe('getWinner', () => {
  it('returns null when not finished', () => {
    const state = makePlayingState()
    expect(getWinner(state)).toBeNull()
  })

  it('returns winning team when finished', () => {
    let state = makePlayingState()
    const team = state.currentTeam
    const otherTeam = team === 'red' ? 'blue' : 'red'
    const spymasterId = team === 'red' ? 'p1' : 'p3'
    const operativeId = team === 'red' ? 'p2' : 'p4'
    state = applyAction(state, {
      type: 'GIVE_CLUE',
      playerId: spymasterId,
      word: 'test',
      count: 2,
    })
    const assassinIdx = state.board.findIndex((c) => c.type === 'assassin')
    state = applyAction(state, {
      type: 'GUESS_CARD',
      playerId: operativeId,
      cardIndex: assassinIdx,
    })
    expect(getWinner(state)).toBe(otherTeam)
  })
})
