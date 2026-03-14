import {
  addPlayer,
  applyAction,
  createLobbyState,
  dealHands,
  getAllBlackCards,
  getAllWhiteCards,
  getCzar,
  getNonCzarPlayers,
  hasAllSubmitted,
  removePlayer,
  shuffle,
  type GameState,
  type Player,
  type WhiteCard,
  HAND_SIZE,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from './logic'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, isHost = false): Player {
  return { id, name, isHost, score: 0 }
}

function makeLobby(playerCount = 3): GameState {
  const host = makePlayer('host', 'Alice', true)
  let state = createLobbyState(host)
  for (let i = 1; i < playerCount; i++) {
    state = addPlayer(state, makePlayer(`p${i}`, `Player${i}`))
  }
  return state
}

function startedGame(playerCount = 3): GameState {
  const lobby = makeLobby(playerCount)
  return applyAction(lobby, { type: 'START_GAME', playerId: 'host' })
}

// ─── Data ─────────────────────────────────────────────────────────────────────

describe('getAllBlackCards', () => {
  it('returns cards with text and pick', () => {
    const cards = getAllBlackCards()
    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((c) => {
      expect(typeof c.text).toBe('string')
      expect(typeof c.pick).toBe('number')
      expect(c.pick).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('getAllWhiteCards', () => {
  it('returns cards with text', () => {
    const cards = getAllWhiteCards()
    expect(cards.length).toBeGreaterThan(0)
    cards.forEach((c) => expect(typeof c.text).toBe('string'))
  })
})

// ─── shuffle ──────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns same length array', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffle(arr)).toHaveLength(5)
  })

  it('contains same elements', () => {
    const arr = ['a', 'b', 'c', 'd']
    expect(shuffle(arr).sort()).toEqual([...arr].sort())
  })

  it('does not mutate original', () => {
    const arr = [1, 2, 3]
    const original = [...arr]
    shuffle(arr)
    expect(arr).toEqual(original)
  })

  it('uses provided rng', () => {
    const arr = [1, 2, 3, 4]
    let rngCalled = 0
    shuffle(arr, () => {
      rngCalled++
      return 0
    })
    expect(rngCalled).toBe(3)
  })
})

// ─── dealHands ────────────────────────────────────────────────────────────────

describe('dealHands', () => {
  const players = [makePlayer('a', 'A'), makePlayer('b', 'B')]
  const deck: WhiteCard[] = Array.from({ length: 20 }, (_, i) => ({ text: `Card ${i}` }))

  it('deals HAND_SIZE cards to each player', () => {
    const { hands } = dealHands(players, deck)
    expect(hands['a']).toHaveLength(HAND_SIZE)
    expect(hands['b']).toHaveLength(HAND_SIZE)
  })

  it('removes dealt cards from remaining pile', () => {
    const { remaining } = dealHands(players, deck)
    expect(remaining).toHaveLength(deck.length - HAND_SIZE * players.length)
  })

  it('tops up existing hands to HAND_SIZE', () => {
    const existing = { a: [{ text: 'Old' }], b: [] }
    const { hands } = dealHands(players, deck, existing)
    expect(hands['a']).toHaveLength(HAND_SIZE)
    expect(hands['b']).toHaveLength(HAND_SIZE)
    expect(hands['a'][0].text).toBe('Old') // existing card preserved
  })

  it('does not exceed HAND_SIZE even with big pile', () => {
    const bigDeck: WhiteCard[] = Array.from({ length: 100 }, (_, i) => ({ text: `X${i}` }))
    const { hands } = dealHands(players, bigDeck)
    expect(hands['a']).toHaveLength(HAND_SIZE)
  })
})

// ─── createLobbyState ────────────────────────────────────────────────────────

describe('createLobbyState', () => {
  it('creates lobby with host', () => {
    const host = makePlayer('h', 'Host', true)
    const state = createLobbyState(host)
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(1)
    expect(state.players[0].id).toBe('h')
    expect(state.currentBlackCard).toBeNull()
    expect(state.submissions).toEqual({})
  })
})

// ─── addPlayer ───────────────────────────────────────────────────────────────

describe('addPlayer', () => {
  it('adds a player in lobby', () => {
    const state = createLobbyState(makePlayer('h', 'Host', true))
    const next = addPlayer(state, makePlayer('p1', 'P1'))
    expect(next.players).toHaveLength(2)
  })

  it('ignores duplicate player id', () => {
    const state = createLobbyState(makePlayer('h', 'Host', true))
    const next = addPlayer(state, makePlayer('h', 'Dup', true))
    expect(next.players).toHaveLength(1)
  })

  it('rejects join after game starts', () => {
    const state = startedGame()
    const next = addPlayer(state, makePlayer('newbie', 'New'))
    expect(next.players).toHaveLength(state.players.length)
  })

  it(`rejects when at ${MAX_PLAYERS} players`, () => {
    let state = createLobbyState(makePlayer('h', 'Host', true))
    for (let i = 0; i < MAX_PLAYERS - 1; i++) {
      state = addPlayer(state, makePlayer(`p${i}`, `P${i}`))
    }
    expect(state.players).toHaveLength(MAX_PLAYERS)
    const next = addPlayer(state, makePlayer('overflow', 'Over'))
    expect(next.players).toHaveLength(MAX_PLAYERS)
  })
})

// ─── removePlayer ────────────────────────────────────────────────────────────

describe('removePlayer', () => {
  it('removes player and their hand/submissions', () => {
    const state = startedGame(3)
    const targetId = state.players[1].id
    const next = removePlayer(state, targetId)
    expect(next.players.find((p) => p.id === targetId)).toBeUndefined()
    expect(next.hands[targetId]).toBeUndefined()
  })

  it('adjusts czarIndex when player before czar is removed', () => {
    const state = { ...startedGame(4), czarIndex: 2 }
    const next = removePlayer(state, state.players[1].id) // remove player before czar
    expect(next.czarIndex).toBe(1)
  })

  it('wraps czarIndex when it goes out of bounds', () => {
    const state = { ...startedGame(3), czarIndex: 2 }
    const next = removePlayer(state, state.players[2].id)
    expect(next.czarIndex).toBe(0)
  })
})

// ─── getCzar / getNonCzarPlayers ─────────────────────────────────────────────

describe('getCzar', () => {
  it('returns the czar player', () => {
    const state = startedGame(3)
    const czar = getCzar(state)
    expect(czar).not.toBeNull()
    expect(czar?.id).toBe(state.players[state.czarIndex].id)
  })
})

describe('getNonCzarPlayers', () => {
  it('excludes czar', () => {
    const state = startedGame(3)
    const nonCzar = getNonCzarPlayers(state)
    expect(nonCzar).toHaveLength(2)
    const czar = getCzar(state)
    expect(nonCzar.some((p) => p.id === czar?.id)).toBe(false)
  })
})

// ─── hasAllSubmitted ──────────────────────────────────────────────────────────

describe('hasAllSubmitted', () => {
  it('returns false when no one has submitted', () => {
    const state = startedGame(3)
    expect(hasAllSubmitted(state)).toBe(false)
  })

  it('returns true when all non-czar players submitted', () => {
    let state = startedGame(3)
    const nonCzar = getNonCzarPlayers(state)
    for (const p of nonCzar) {
      const pick = state.currentBlackCard!.pick
      const cards = state.hands[p.id].slice(0, pick)
      state = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards })
    }
    // After all submit, phase moves to judging
    expect(state.phase).toBe('judging')
  })
})

// ─── applyAction: START_GAME ──────────────────────────────────────────────────

describe('START_GAME', () => {
  it('starts game from lobby', () => {
    const state = startedGame(3)
    expect(state.phase).toBe('playing')
    expect(state.currentBlackCard).not.toBeNull()
    expect(state.players.every((p) => (state.hands[p.id]?.length ?? 0) > 0)).toBe(true)
  })

  it('deals HAND_SIZE cards to all players', () => {
    const state = startedGame(4)
    state.players.forEach((p) => {
      expect(state.hands[p.id]).toHaveLength(HAND_SIZE)
    })
  })

  it('rejects start from non-host', () => {
    const lobby = makeLobby(3)
    const nonHost = lobby.players[1].id
    const state = applyAction(lobby, { type: 'START_GAME', playerId: nonHost })
    expect(state.phase).toBe('lobby')
  })

  it(`rejects start with fewer than ${MIN_PLAYERS} players`, () => {
    const lobby = makeLobby(2)
    const state = applyAction(lobby, { type: 'START_GAME', playerId: 'host' })
    expect(state.phase).toBe('lobby')
  })

  it('uses custom pointsToWin', () => {
    const lobby = makeLobby(3)
    const state = applyAction(lobby, { type: 'START_GAME', playerId: 'host', pointsToWin: 3 })
    expect(state.pointsToWin).toBe(3)
  })

  it('resets all scores to 0', () => {
    const state = startedGame(3)
    state.players.forEach((p) => expect(p.score).toBe(0))
  })
})

// ─── applyAction: SUBMIT_CARDS ────────────────────────────────────────────────

describe('SUBMIT_CARDS', () => {
  function getPlayer1State(state: GameState) {
    const nonCzar = getNonCzarPlayers(state)
    return nonCzar[0]
  }

  it('records submission and removes cards from hand', () => {
    const state = startedGame(3)
    const p = getPlayer1State(state)
    const pick = state.currentBlackCard!.pick
    const cards = state.hands[p.id].slice(0, pick)
    const next = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards })
    expect(next.submissions[p.id]).toEqual(cards)
    expect(next.hands[p.id]).toHaveLength(HAND_SIZE - pick)
  })

  it('czar cannot submit', () => {
    const state = startedGame(3)
    const czar = getCzar(state)!
    const pick = state.currentBlackCard!.pick
    const cards = state.hands[czar.id].slice(0, pick)
    const next = applyAction(state, { type: 'SUBMIT_CARDS', playerId: czar.id, cards })
    expect(next.submissions[czar.id]).toBeUndefined()
  })

  it('player cannot submit twice', () => {
    const state = startedGame(3)
    const p = getPlayer1State(state)
    const pick = state.currentBlackCard!.pick
    const cards = state.hands[p.id].slice(0, pick)
    const s1 = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards })
    const cards2 = s1.hands[p.id].slice(0, pick)
    const s2 = applyAction(s1, { type: 'SUBMIT_CARDS', playerId: p.id, cards: cards2 })
    expect(s2.submissions[p.id]).toEqual(cards) // unchanged
  })

  it('rejects wrong card count', () => {
    const state = startedGame(3)
    const p = getPlayer1State(state)
    // Submit 0 cards (wrong count for pick=1)
    const next = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards: [] })
    expect(next.submissions[p.id]).toBeUndefined()
  })

  it('rejects card not in hand', () => {
    const state = startedGame(3)
    const p = getPlayer1State(state)
    const fakeCard = { text: 'Not in hand' }
    const next = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards: [fakeCard] })
    expect(next.submissions[p.id]).toBeUndefined()
  })

  it('moves to judging phase when all players submit', () => {
    let state = startedGame(3)
    const nonCzar = getNonCzarPlayers(state)
    for (const p of nonCzar) {
      const pick = state.currentBlackCard!.pick
      const cards = state.hands[p.id].slice(0, pick)
      state = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards })
    }
    expect(state.phase).toBe('judging')
    expect(state.judgeOrder).toHaveLength(nonCzar.length)
  })

  it('judgeOrder contains all non-czar player ids', () => {
    let state = startedGame(3)
    const nonCzar = getNonCzarPlayers(state)
    for (const p of nonCzar) {
      const cards = state.hands[p.id].slice(0, state.currentBlackCard!.pick)
      state = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards })
    }
    const nonCzarIds = nonCzar.map((p) => p.id).sort()
    expect([...state.judgeOrder].sort()).toEqual(nonCzarIds)
  })
})

// ─── applyAction: JUDGE_WINNER ────────────────────────────────────────────────

describe('JUDGE_WINNER', () => {
  function judgingState(): GameState {
    let state = startedGame(3)
    const nonCzar = getNonCzarPlayers(state)
    for (const p of nonCzar) {
      const cards = state.hands[p.id].slice(0, state.currentBlackCard!.pick)
      state = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards })
    }
    return state // now in judging
  }

  it('czar picks winner and awards a point', () => {
    const state = judgingState()
    const czar = getCzar(state)!
    const winnerId = state.judgeOrder[0]
    const next = applyAction(state, { type: 'JUDGE_WINNER', playerId: czar.id, winnerId })
    const winner = next.players.find((p) => p.id === winnerId)!
    expect(winner.score).toBe(1)
    expect(next.roundWinnerId).toBe(winnerId)
  })

  it('moves to round_end when no one has won yet', () => {
    const state = judgingState()
    const czar = getCzar(state)!
    const winnerId = state.judgeOrder[0]
    const next = applyAction(state, { type: 'JUDGE_WINNER', playerId: czar.id, winnerId })
    expect(next.phase).toBe('round_end')
  })

  it('moves to finished when winner reaches pointsToWin', () => {
    let state = judgingState()
    // Artificially boost winner's score to pointsToWin - 1
    const winnerId = state.judgeOrder[0]
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === winnerId ? { ...p, score: state.pointsToWin - 1 } : p
      ),
    }
    const czar = getCzar(state)!
    const next = applyAction(state, { type: 'JUDGE_WINNER', playerId: czar.id, winnerId })
    expect(next.phase).toBe('finished')
    expect(next.winnerId).toBe(winnerId)
  })

  it('non-czar cannot judge', () => {
    const state = judgingState()
    const nonCzar = getNonCzarPlayers(state)[0]
    const winnerId = state.judgeOrder[0]
    const next = applyAction(state, {
      type: 'JUDGE_WINNER',
      playerId: nonCzar.id,
      winnerId,
    })
    expect(next.phase).toBe('judging') // unchanged
  })

  it('rejects unknown winnerId', () => {
    const state = judgingState()
    const czar = getCzar(state)!
    const next = applyAction(state, {
      type: 'JUDGE_WINNER',
      playerId: czar.id,
      winnerId: 'ghost',
    })
    expect(next.phase).toBe('judging')
  })
})

// ─── applyAction: NEXT_ROUND ──────────────────────────────────────────────────

describe('NEXT_ROUND', () => {
  function roundEndState(): GameState {
    let state = startedGame(3)
    const nonCzar = getNonCzarPlayers(state)
    for (const p of nonCzar) {
      const cards = state.hands[p.id].slice(0, state.currentBlackCard!.pick)
      state = applyAction(state, { type: 'SUBMIT_CARDS', playerId: p.id, cards })
    }
    const czar = getCzar(state)!
    const winnerId = state.judgeOrder[0]
    return applyAction(state, { type: 'JUDGE_WINNER', playerId: czar.id, winnerId })
  }

  it('advances to next playing round', () => {
    const state = roundEndState()
    expect(state.phase).toBe('round_end')
    const next = applyAction(state, { type: 'NEXT_ROUND', playerId: state.players[0].id })
    expect(next.phase).toBe('playing')
    expect(next.submissions).toEqual({})
    expect(next.judgeOrder).toEqual([])
  })

  it('rotates czar to next player', () => {
    const state = roundEndState()
    const oldCzar = state.czarIndex
    const next = applyAction(state, { type: 'NEXT_ROUND', playerId: state.players[0].id })
    expect(next.czarIndex).toBe((oldCzar + 1) % state.players.length)
  })

  it('replenishes hands after round', () => {
    const state = roundEndState()
    const next = applyAction(state, { type: 'NEXT_ROUND', playerId: state.players[0].id })
    next.players.forEach((p) => {
      expect(next.hands[p.id].length).toBeLessThanOrEqual(HAND_SIZE)
      expect(next.hands[p.id].length).toBeGreaterThan(0)
    })
  })

  it('ignores action when not in round_end phase', () => {
    const state = startedGame(3)
    expect(state.phase).toBe('playing')
    const next = applyAction(state, { type: 'NEXT_ROUND', playerId: state.players[0].id })
    expect(next.phase).toBe('playing')
  })
})

// ─── applyAction: PLAY_AGAIN ──────────────────────────────────────────────────

describe('PLAY_AGAIN', () => {
  it('restarts game from finished phase', () => {
    let state = startedGame(3)
    // Force finished state
    state = { ...state, phase: 'finished', winnerId: state.players[0].id }
    const next = applyAction(state, { type: 'PLAY_AGAIN', playerId: 'host' })
    expect(next.phase).toBe('playing')
    expect(next.winnerId).toBeNull()
    next.players.forEach((p) => expect(p.score).toBe(0))
  })

  it('rejects play again from non-host', () => {
    let state = startedGame(3)
    state = { ...state, phase: 'finished' }
    const next = applyAction(state, { type: 'PLAY_AGAIN', playerId: state.players[1].id })
    expect(next.phase).toBe('finished')
  })

  it('rejects play again from non-finished phase', () => {
    const state = startedGame(3)
    const next = applyAction(state, { type: 'PLAY_AGAIN', playerId: 'host' })
    expect(next.phase).toBe('playing')
  })
})
