import {
  createLobbyState,
  addPlayer,
  removePlayer,
  startGame,
  applyAction,
  getCzar,
  isCzar,
  getNonCzarPlayers,
  hasSubmitted,
  allSubmitted,
  getWhiteCardText,
  shuffle,
  type Player,
  type GameState,
} from './logic'

function makePlayer(id: string, name: string, isHost = false): Player {
  return { id, name, isHost }
}

function makeLobby(playerCount = 3): GameState {
  const host = makePlayer('p1', 'Alice', true)
  let state = createLobbyState(host)
  for (let i = 2; i <= playerCount; i++) {
    state = addPlayer(state, makePlayer(`p${i}`, `Player${i}`))
  }
  return state
}

function startedGame(playerCount = 3): GameState {
  const lobby = makeLobby(playerCount)
  return startGame(lobby)
}

describe('createLobbyState', () => {
  it('creates a lobby with the host player', () => {
    const host = makePlayer('h1', 'Host', true)
    const state = createLobbyState(host)
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(1)
    expect(state.players[0].isHost).toBe(true)
    expect(state.blackCard).toBeNull()
    expect(state.pointsToWin).toBe(7)
  })
})

describe('addPlayer', () => {
  it('adds a player to the lobby', () => {
    const host = makePlayer('h1', 'Host', true)
    let state = createLobbyState(host)
    state = addPlayer(state, makePlayer('p2', 'Player2'))
    expect(state.players).toHaveLength(2)
  })

  it('rejects duplicate player ids', () => {
    const host = makePlayer('h1', 'Host', true)
    let state = createLobbyState(host)
    state = addPlayer(state, makePlayer('h1', 'Duplicate'))
    expect(state.players).toHaveLength(1)
  })

  it('rejects players when not in lobby phase', () => {
    const game = startedGame()
    const result = addPlayer(game, makePlayer('new', 'New'))
    expect(result.players).toHaveLength(3)
  })

  it('enforces max 10 players', () => {
    let state = makeLobby(10)
    expect(state.players).toHaveLength(10)
    state = addPlayer(state, makePlayer('p11', 'Extra'))
    expect(state.players).toHaveLength(10)
  })
})

describe('removePlayer', () => {
  it('removes a player', () => {
    const state = makeLobby(3)
    const result = removePlayer(state, 'p2')
    expect(result.players).toHaveLength(2)
  })

  it('adjusts czar index when removed player is before czar', () => {
    let state = makeLobby(4)
    state = { ...state, czarIndex: 2 }
    const result = removePlayer(state, 'p1')
    expect(result.czarIndex).toBe(1)
  })

  it('wraps czar index when last player removed', () => {
    let state = makeLobby(3)
    state = { ...state, czarIndex: 2 }
    const result = removePlayer(state, 'p3')
    expect(result.czarIndex).toBe(0)
  })
})

describe('startGame', () => {
  it('requires at least 3 players', () => {
    const lobby = makeLobby(2)
    const result = startGame(lobby)
    expect(result.phase).toBe('lobby')
  })

  it('transitions to playing phase with 3+ players', () => {
    const game = startedGame()
    expect(game.phase).toBe('playing')
    expect(game.blackCard).not.toBeNull()
    expect(Object.keys(game.hands)).toHaveLength(3)
  })

  it('deals handSize cards to each player', () => {
    const game = startedGame()
    for (const player of game.players) {
      expect(game.hands[player.id]).toHaveLength(game.handSize)
    }
  })

  it('initializes scores to 0', () => {
    const game = startedGame()
    for (const player of game.players) {
      expect(game.scores[player.id]).toBe(0)
    }
  })

  it('sets up black and white decks', () => {
    const game = startedGame()
    expect(game.blackDeck.length).toBeGreaterThan(0)
    expect(game.whiteDeck.length).toBeGreaterThan(0)
  })
})

describe('getCzar / isCzar / getNonCzarPlayers', () => {
  it('returns the czar player', () => {
    const game = startedGame()
    const czar = getCzar(game)
    expect(czar).not.toBeNull()
    expect(czar!.id).toBe('p1')
  })

  it('identifies czar correctly', () => {
    const game = startedGame()
    expect(isCzar(game, 'p1')).toBe(true)
    expect(isCzar(game, 'p2')).toBe(false)
  })

  it('returns non-czar players', () => {
    const game = startedGame()
    const nonCzar = getNonCzarPlayers(game)
    expect(nonCzar).toHaveLength(2)
    expect(nonCzar.every((p) => p.id !== 'p1')).toBe(true)
  })
})

describe('SUBMIT_CARDS', () => {
  it('allows a non-czar player to submit cards', () => {
    const game = startedGame()
    const pick = game.blackCard!.pick
    const hand = game.hands['p2']
    const cardIndices = hand.slice(0, pick)

    const result = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices,
    })

    expect(hasSubmitted(result, 'p2')).toBe(true)
    expect(result.hands['p2']).toHaveLength(game.handSize - pick)
  })

  it('rejects submission from czar', () => {
    const game = startedGame()
    const hand = game.hands['p1']
    const result = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p1',
      cardIndices: hand.slice(0, 1),
    })
    expect(hasSubmitted(result, 'p1')).toBe(false)
  })

  it('rejects duplicate submission', () => {
    const game = startedGame()
    const pick = game.blackCard!.pick
    const hand = game.hands['p2']
    const cardIndices = hand.slice(0, pick)

    const after1 = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices,
    })
    const after2 = applyAction(after1, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: after1.hands['p2'].slice(0, pick),
    })
    expect(after2).toBe(after1) // no-op
  })

  it('rejects wrong number of cards', () => {
    const game = startedGame()
    const hand = game.hands['p2']
    // Submit wrong count
    const result = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: hand.slice(0, game.blackCard!.pick + 1),
    })
    expect(hasSubmitted(result, 'p2')).toBe(false)
  })

  it('rejects cards not in hand', () => {
    const game = startedGame()
    const result = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: [-999],
    })
    expect(result).toBe(game)
  })

  it('rejects duplicate card indices', () => {
    const game = startedGame()
    // Force a pick-2 black card
    const gameWith2 = { ...game, blackCard: { text: '___ and ___', pick: 2 } }
    const hand = gameWith2.hands['p2']
    const result = applyAction(gameWith2, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: [hand[0], hand[0]],
    })
    expect(result).toBe(gameWith2)
  })

  it('moves to judging phase when all players submit', () => {
    const game = startedGame()
    const pick = game.blackCard!.pick

    const after1 = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: game.hands['p2'].slice(0, pick),
    })
    expect(after1.phase).toBe('playing')

    const after2 = applyAction(after1, {
      type: 'SUBMIT_CARDS',
      playerId: 'p3',
      cardIndices: after1.hands['p3'].slice(0, pick),
    })
    expect(after2.phase).toBe('judging')
    expect(after2.revealOrder).toHaveLength(2)
    expect(after2.revealIndex).toBe(-1)
  })

  it('anonymizes submissions during judging phase', () => {
    const game = startedGame()
    const pick = game.blackCard!.pick

    let state = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: game.hands['p2'].slice(0, pick),
    })
    state = applyAction(state, {
      type: 'SUBMIT_CARDS',
      playerId: 'p3',
      cardIndices: state.hands['p3'].slice(0, pick),
    })
    expect(state.phase).toBe('judging')
    // Player-ID-keyed submissions should be cleared
    expect(Object.keys(state.submissions)).toHaveLength(0)
    // Anonymous shuffled submissions should exist
    expect(state.shuffledSubmissions).toHaveLength(2)
    // RevealOrder should use string indices, not player IDs
    expect(state.revealOrder).toEqual(expect.arrayContaining(['0', '1']))
    expect(state.revealOrder).not.toContain('p2')
    expect(state.revealOrder).not.toContain('p3')
    // Encoded reveal map should exist
    expect(state._rm).toBeTruthy()
  })
})

describe('REVEAL_NEXT', () => {
  function setupJudging(): GameState {
    let game = startedGame()
    const pick = game.blackCard!.pick
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: game.hands['p2'].slice(0, pick),
    })
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p3',
      cardIndices: game.hands['p3'].slice(0, pick),
    })
    return game
  }

  it('allows czar to reveal submissions one by one', () => {
    const game = setupJudging()
    expect(game.phase).toBe('judging')

    const after1 = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    expect(after1.revealIndex).toBe(0)

    const after2 = applyAction(after1, { type: 'REVEAL_NEXT', playerId: 'p1' })
    expect(after2.revealIndex).toBe(1)
  })

  it('rejects reveal from non-czar', () => {
    const game = setupJudging()
    const result = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p2' })
    expect(result).toBe(game)
  })

  it('stops at last submission', () => {
    let game = setupJudging()
    game = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    game = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    const result = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    expect(result).toBe(game) // no-op
  })
})

describe('PICK_WINNER', () => {
  function setupAllRevealed(): GameState {
    let game = startedGame()
    const pick = game.blackCard!.pick
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: game.hands['p2'].slice(0, pick),
    })
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p3',
      cardIndices: game.hands['p3'].slice(0, pick),
    })
    // Reveal all
    game = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    game = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    return game
  }

  it('allows czar to pick a winner', () => {
    const game = setupAllRevealed()
    // Use the first anonymous index from revealOrder
    const winnerId = game.revealOrder[0]
    const result = applyAction(game, {
      type: 'PICK_WINNER',
      playerId: 'p1',
      winnerId,
    })
    expect(result.phase).toBe('reveal')
    // roundWinnerId should be an actual player ID (p2 or p3)
    expect(['p2', 'p3']).toContain(result.roundWinnerId)
    expect(result.scores[result.roundWinnerId!]).toBe(1)
    // roundWinnerCards should be populated
    expect(result.roundWinnerCards.length).toBeGreaterThan(0)
  })

  it('rejects pick from non-czar', () => {
    const game = setupAllRevealed()
    const result = applyAction(game, {
      type: 'PICK_WINNER',
      playerId: 'p2',
      winnerId: game.revealOrder[0],
    })
    expect(result).toBe(game)
  })

  it('rejects invalid winner index', () => {
    const game = setupAllRevealed()
    const result = applyAction(game, {
      type: 'PICK_WINNER',
      playerId: 'p1',
      winnerId: '99', // not in revealOrder
    })
    expect(result).toBe(game)
  })

  it('rejects pick before all revealed', () => {
    let game = startedGame()
    const pick = game.blackCard!.pick
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: game.hands['p2'].slice(0, pick),
    })
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p3',
      cardIndices: game.hands['p3'].slice(0, pick),
    })
    // Only reveal one
    game = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    const result = applyAction(game, {
      type: 'PICK_WINNER',
      playerId: 'p1',
      winnerId: game.revealOrder[0],
    })
    expect(result).toBe(game)
  })

  it('ends game when player reaches pointsToWin', () => {
    let game = setupAllRevealed()
    // Decode the reveal map to find which index maps to which player
    const playerOrder: string[] = JSON.parse(atob(game._rm))
    const p2Index = playerOrder.indexOf('p2')
    game = { ...game, scores: { ...game.scores, p2: 6 }, pointsToWin: 7 }
    const result = applyAction(game, {
      type: 'PICK_WINNER',
      playerId: 'p1',
      winnerId: String(p2Index),
    })
    expect(result.phase).toBe('finished')
    expect(result.winnerId).toBe('p2')
    expect(result.scores['p2']).toBe(7)
  })
})

describe('NEXT_ROUND', () => {
  function setupRevealPhase(): GameState {
    let game = startedGame()
    const pick = game.blackCard!.pick
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: game.hands['p2'].slice(0, pick),
    })
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p3',
      cardIndices: game.hands['p3'].slice(0, pick),
    })
    game = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    game = applyAction(game, { type: 'REVEAL_NEXT', playerId: 'p1' })
    game = applyAction(game, {
      type: 'PICK_WINNER',
      playerId: 'p1',
      winnerId: game.revealOrder[0],
    })
    return game
  }

  it('advances to next round', () => {
    const game = setupRevealPhase()
    expect(game.phase).toBe('reveal')

    const result = applyAction(game, { type: 'NEXT_ROUND', playerId: 'p1' })
    expect(result.phase).toBe('playing')
    expect(result.czarIndex).toBe(1) // rotated
    expect(result.blackCard).not.toBeNull()
    expect(result.submissions).toEqual({})
    expect(result.roundWinnerId).toBeNull()
  })

  it('refills hands to handSize', () => {
    const game = setupRevealPhase()
    const result = applyAction(game, { type: 'NEXT_ROUND', playerId: 'p1' })
    for (const player of result.players) {
      expect(result.hands[player.id]).toHaveLength(result.handSize)
    }
  })

  it('rejects from non-czar', () => {
    const game = setupRevealPhase()
    const result = applyAction(game, { type: 'NEXT_ROUND', playerId: 'p2' })
    expect(result).toBe(game)
  })
})

describe('REMOVE_PLAYER', () => {
  it('removes a player from the lobby and reassigns host', () => {
    const lobby = makeLobby(3)
    const result = applyAction(lobby, { type: 'REMOVE_PLAYER', playerId: 'p1' })
    expect(result.players).toHaveLength(2)
    expect(result.players[0].isHost).toBe(true)
  })

  it('removes a non-czar player during playing phase', () => {
    const game = startedGame()
    const result = applyAction(game, { type: 'REMOVE_PLAYER', playerId: 'p3' })
    expect(result.players).toHaveLength(2)
    expect(result.phase).toBe('finished') // fewer than 3 players
  })

  it('removes the czar and starts a new round', () => {
    const game = startedGame(4)
    const result = applyAction(game, { type: 'REMOVE_PLAYER', playerId: 'p1' })
    expect(result.players).toHaveLength(3)
    expect(result.phase).toBe('playing')
    expect(result.submissions).toEqual({})
  })

  it('triggers judging when removed player was the last non-submitter', () => {
    let game = startedGame(4)
    const pick = game.blackCard!.pick
    // p2 and p3 submit (p1 is czar, p4 hasn't submitted)
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: game.hands['p2'].slice(0, pick),
    })
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p3',
      cardIndices: game.hands['p3'].slice(0, pick),
    })
    expect(game.phase).toBe('playing')
    // Remove p4 (the non-submitter)
    const result = applyAction(game, { type: 'REMOVE_PLAYER', playerId: 'p4' })
    expect(result.phase).toBe('judging')
  })

  it('returns state unchanged for unknown player', () => {
    const game = startedGame()
    const result = applyAction(game, { type: 'REMOVE_PLAYER', playerId: 'unknown' })
    expect(result).toBe(game)
  })
})

describe('START_GAME / PLAY_AGAIN', () => {
  it('only host can start', () => {
    const lobby = makeLobby(3)
    const result = applyAction(lobby, { type: 'START_GAME', playerId: 'p2' })
    expect(result.phase).toBe('lobby')
  })

  it('host can start game', () => {
    const lobby = makeLobby(3)
    const result = applyAction(lobby, { type: 'START_GAME', playerId: 'p1' })
    expect(result.phase).toBe('playing')
  })

  it('only host can play again', () => {
    let game = startedGame()
    game = { ...game, phase: 'finished', winnerId: 'p2' }
    const result = applyAction(game, { type: 'PLAY_AGAIN', playerId: 'p2' })
    expect(result.phase).toBe('finished')
  })

  it('play again restarts the game', () => {
    let game = startedGame()
    game = { ...game, phase: 'finished', winnerId: 'p2' }
    const result = applyAction(game, { type: 'PLAY_AGAIN', playerId: 'p1' })
    expect(result.phase).toBe('playing')
  })
})

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffle(arr)
    expect(result).toHaveLength(5)
    expect(result.sort()).toEqual(arr.sort())
  })

  it('does not mutate the original', () => {
    const arr = [1, 2, 3]
    const copy = [...arr]
    shuffle(arr)
    expect(arr).toEqual(copy)
  })

  it('uses the provided rng', () => {
    let call = 0
    const rng = () => {
      call++
      return 0.5
    }
    shuffle([1, 2, 3, 4], rng)
    expect(call).toBeGreaterThan(0)
  })
})

describe('allSubmitted', () => {
  it('returns false when no one submitted', () => {
    const game = startedGame()
    expect(allSubmitted(game)).toBe(false)
  })

  it('returns true when all non-czar players submitted', () => {
    let game = startedGame()
    const pick = game.blackCard!.pick
    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p2',
      cardIndices: game.hands['p2'].slice(0, pick),
    })
    // After first submission, not all have submitted yet
    expect(allSubmitted(game)).toBe(false)

    game = applyAction(game, {
      type: 'SUBMIT_CARDS',
      playerId: 'p3',
      cardIndices: game.hands['p3'].slice(0, pick),
    })
    // After auto-transition to judging, allSubmitted should be true
    expect(allSubmitted(game)).toBe(true)
  })
})

describe('getWhiteCardText', () => {
  it('returns text for valid index', () => {
    const text = getWhiteCardText(0)
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('returns empty string for invalid index', () => {
    expect(getWhiteCardText(-1)).toBe('')
    expect(getWhiteCardText(999999)).toBe('')
  })
})
