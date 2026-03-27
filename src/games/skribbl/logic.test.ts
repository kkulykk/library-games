import {
  createLobbyState,
  addPlayer,
  removePlayer,
  applyAction,
  generateHint,
  revealHintLetters,
  calculateGuessScore,
  calculateDrawerScore,
  pickRandomWords,
  getCurrentDrawer,
  encodeWord,
  decodeWord,
  type Player,
  type GameState,
} from './logic'

function makeHost(): Player {
  return { id: 'host', name: 'Host', isHost: true, score: 0 }
}

function makePlayer(id: string, name: string): Player {
  return { id, name, isHost: false, score: 0 }
}

function lobbyWithPlayers(): GameState {
  let state = createLobbyState(makeHost())
  state = addPlayer(state, makePlayer('p2', 'Player2'))
  state = addPlayer(state, makePlayer('p3', 'Player3'))
  return state
}

function startedGame(): GameState {
  const state = lobbyWithPlayers()
  return applyAction(state, { type: 'START_GAME', playerId: 'host' })
}

describe('createLobbyState', () => {
  it('creates lobby with host', () => {
    const state = createLobbyState(makeHost())
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(1)
    expect(state.players[0].isHost).toBe(true)
    expect(state.round).toBe(1)
    expect(state.totalRounds).toBe(3)
  })
})

describe('addPlayer', () => {
  it('adds a player to lobby', () => {
    const state = createLobbyState(makeHost())
    const next = addPlayer(state, makePlayer('p2', 'Player2'))
    expect(next.players).toHaveLength(2)
  })

  it('does not add duplicate', () => {
    const state = createLobbyState(makeHost())
    const next = addPlayer(state, makePlayer('host', 'Host'))
    expect(next.players).toHaveLength(1)
  })

  it('caps at 8 players', () => {
    let state = createLobbyState(makeHost())
    for (let i = 2; i <= 8; i++) {
      state = addPlayer(state, makePlayer(`p${i}`, `P${i}`))
    }
    expect(state.players).toHaveLength(8)
    const next = addPlayer(state, makePlayer('p9', 'P9'))
    expect(next.players).toHaveLength(8)
  })

  it('does not add during non-lobby phase', () => {
    const state = startedGame()
    const next = addPlayer(state, makePlayer('p4', 'P4'))
    expect(next.players).toHaveLength(3)
  })
})

describe('removePlayer', () => {
  it('removes a player', () => {
    const state = lobbyWithPlayers()
    const next = removePlayer(state, 'p2')
    expect(next.players).toHaveLength(2)
  })

  it('adjusts drawer index when removing before it', () => {
    let state = lobbyWithPlayers()
    state = { ...state, currentDrawerIndex: 2 }
    const next = removePlayer(state, 'p2')
    expect(next.currentDrawerIndex).toBe(1)
  })

  it('no-ops for unknown player', () => {
    const state = lobbyWithPlayers()
    const next = removePlayer(state, 'unknown')
    expect(next).toBe(state)
  })
})

describe('START_GAME', () => {
  it('transitions to picking phase', () => {
    const state = startedGame()
    expect(state.phase).toBe('picking')
    expect(state.wordChoices).toHaveLength(3)
  })

  it('only host can start', () => {
    const state = lobbyWithPlayers()
    const next = applyAction(state, { type: 'START_GAME', playerId: 'p2' })
    expect(next.phase).toBe('lobby')
  })

  it('needs at least 2 players', () => {
    const state = createLobbyState(makeHost())
    const next = applyAction(state, { type: 'START_GAME', playerId: 'host' })
    expect(next.phase).toBe('lobby')
  })

  it('resets scores on start', () => {
    let state = lobbyWithPlayers()
    state = { ...state, players: state.players.map((p) => ({ ...p, score: 100 })) }
    const next = applyAction(state, { type: 'START_GAME', playerId: 'host' })
    expect(next.players.every((p) => p.score === 0)).toBe(true)
  })
})

describe('PICK_WORD', () => {
  it('transitions to drawing phase with encoded word', () => {
    const state = startedGame()
    const drawer = getCurrentDrawer(state)!
    const word = state.wordChoices[0] // already encoded
    const next = applyAction(state, { type: 'PICK_WORD', playerId: drawer.id, word })
    expect(next.phase).toBe('drawing')
    // Word should remain encoded (same as in wordChoices, no double-encoding)
    expect(next.word).toBe(word)
    // Decoding should recover the plaintext
    const plainWord = decodeWord(word)
    expect(decodeWord(next.word!)).toBe(plainWord)
    // Hint should match the plaintext word length, not the encoded form
    expect(next.hint).toBe(
      plainWord
        .split('')
        .map((ch) => (ch === ' ' ? '  ' : '_'))
        .join(' ')
    )
    expect(next.drawStartTime).toBeTruthy()
  })

  it('only drawer can pick', () => {
    const state = startedGame()
    const word = state.wordChoices[0]
    const next = applyAction(state, { type: 'PICK_WORD', playerId: 'p2', word })
    expect(next.phase).toBe('picking')
  })

  it('rejects word not in choices', () => {
    const state = startedGame()
    const drawer = getCurrentDrawer(state)!
    const next = applyAction(state, { type: 'PICK_WORD', playerId: drawer.id, word: 'zzzzz' })
    expect(next.phase).toBe('picking')
  })
})

describe('ADD_STROKE / CLEAR_CANVAS / UNDO_STROKE', () => {
  function drawingState(): GameState {
    const state = startedGame()
    const drawer = getCurrentDrawer(state)!
    return applyAction(state, {
      type: 'PICK_WORD',
      playerId: drawer.id,
      word: state.wordChoices[0],
    })
  }

  it('drawer can add strokes', () => {
    const state = drawingState()
    const drawer = getCurrentDrawer(state)!
    const stroke = { points: [{ x: 0, y: 0, color: '#000', size: 3, tool: 'pen' as const }] }
    const next = applyAction(state, { type: 'ADD_STROKE', playerId: drawer.id, stroke })
    expect(next.strokes).toHaveLength(1)
  })

  it('non-drawer cannot add strokes', () => {
    const state = drawingState()
    const stroke = { points: [{ x: 0, y: 0, color: '#000', size: 3, tool: 'pen' as const }] }
    const next = applyAction(state, { type: 'ADD_STROKE', playerId: 'p2', stroke })
    expect(next.strokes).toHaveLength(0)
  })

  it('drawer can clear canvas', () => {
    const state = drawingState()
    const drawer = getCurrentDrawer(state)!
    const stroke = { points: [{ x: 0, y: 0, color: '#000', size: 3, tool: 'pen' as const }] }
    let next = applyAction(state, { type: 'ADD_STROKE', playerId: drawer.id, stroke })
    next = applyAction(next, { type: 'CLEAR_CANVAS', playerId: drawer.id })
    expect(next.strokes).toHaveLength(0)
  })

  it('drawer can undo last stroke', () => {
    const state = drawingState()
    const drawer = getCurrentDrawer(state)!
    const stroke = { points: [{ x: 0, y: 0, color: '#000', size: 3, tool: 'pen' as const }] }
    let next = applyAction(state, { type: 'ADD_STROKE', playerId: drawer.id, stroke })
    next = applyAction(next, { type: 'ADD_STROKE', playerId: drawer.id, stroke })
    expect(next.strokes).toHaveLength(2)
    next = applyAction(next, { type: 'UNDO_STROKE', playerId: drawer.id })
    expect(next.strokes).toHaveLength(1)
  })
})

describe('GUESS', () => {
  function drawingState(): GameState {
    const state = startedGame()
    const drawer = getCurrentDrawer(state)!
    return applyAction(state, {
      type: 'PICK_WORD',
      playerId: drawer.id,
      word: state.wordChoices[0],
    })
  }

  it('correct guess awards score and adds system message', () => {
    const state = drawingState()
    const word = decodeWord(state.word!)
    const next = applyAction(state, { type: 'GUESS', playerId: 'p2', text: word })
    expect(next.guessedPlayers).toContain('p2')
    expect(next.players.find((p) => p.id === 'p2')!.score).toBeGreaterThan(0)
    expect(next.messages.some((m) => m.isCorrect)).toBe(true)
  })

  it('wrong guess adds chat message', () => {
    const state = drawingState()
    const next = applyAction(state, { type: 'GUESS', playerId: 'p2', text: 'wrongguess' })
    expect(next.guessedPlayers).not.toContain('p2')
    expect(next.messages).toHaveLength(1)
    expect(next.messages[0].text).toBe('wrongguess')
  })

  it('drawer cannot guess', () => {
    const state = drawingState()
    const drawer = getCurrentDrawer(state)!
    const word = decodeWord(state.word!)
    const next = applyAction(state, { type: 'GUESS', playerId: drawer.id, text: word })
    expect(next.guessedPlayers).toHaveLength(0)
  })

  it('player cannot guess twice', () => {
    const state = drawingState()
    const word = decodeWord(state.word!)
    let next = applyAction(state, { type: 'GUESS', playerId: 'p2', text: word })
    const score = next.players.find((p) => p.id === 'p2')!.score
    next = applyAction(next, { type: 'GUESS', playerId: 'p2', text: word })
    expect(next.players.find((p) => p.id === 'p2')!.score).toBe(score)
  })

  it('ends turn when all players guess correctly', () => {
    const state = drawingState()
    const word = decodeWord(state.word!)
    let next = applyAction(state, { type: 'GUESS', playerId: 'p2', text: word })
    next = applyAction(next, { type: 'GUESS', playerId: 'p3', text: word })
    expect(next.phase).toBe('round-end')
  })

  it('case insensitive matching', () => {
    const state = drawingState()
    const word = decodeWord(state.word!)
    const next = applyAction(state, { type: 'GUESS', playerId: 'p2', text: word.toUpperCase() })
    expect(next.guessedPlayers).toContain('p2')
  })
})

describe('END_TURN', () => {
  it('transitions to round-end', () => {
    const state = startedGame()
    const drawer = getCurrentDrawer(state)!
    let next = applyAction(state, {
      type: 'PICK_WORD',
      playerId: drawer.id,
      word: state.wordChoices[0],
    })
    next = applyAction(next, { type: 'END_TURN', playerId: 'host' })
    expect(next.phase).toBe('round-end')
  })
})

describe('NEXT_TURN', () => {
  function roundEndState(): GameState {
    let state = startedGame()
    const drawer = getCurrentDrawer(state)!
    state = applyAction(state, {
      type: 'PICK_WORD',
      playerId: drawer.id,
      word: state.wordChoices[0],
    })
    state = applyAction(state, { type: 'END_TURN', playerId: 'host' })
    return state
  }

  it('advances to next drawer', () => {
    const state = roundEndState()
    const next = applyAction(state, { type: 'NEXT_TURN', playerId: 'host' })
    expect(next.phase).toBe('picking')
    expect(next.currentDrawerIndex).toBe(1)
  })

  it('only host can advance', () => {
    const state = roundEndState()
    const next = applyAction(state, { type: 'NEXT_TURN', playerId: 'p2' })
    expect(next.phase).toBe('round-end')
  })

  it('advances round after all players draw', () => {
    let state = startedGame()
    // Go through all 3 players in round 1
    for (let i = 0; i < 3; i++) {
      const drawer = getCurrentDrawer(state)!
      state = applyAction(state, {
        type: 'PICK_WORD',
        playerId: drawer.id,
        word: state.wordChoices[0],
      })
      state = applyAction(state, { type: 'END_TURN', playerId: 'host' })
      state = applyAction(state, { type: 'NEXT_TURN', playerId: 'host' })
    }
    expect(state.round).toBe(2)
    expect(state.currentDrawerIndex).toBe(0)
  })

  it('finishes game after all rounds', () => {
    let state = startedGame()
    // 3 rounds × 3 players = 9 turns
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 3; i++) {
        const drawer = getCurrentDrawer(state)!
        state = applyAction(state, {
          type: 'PICK_WORD',
          playerId: drawer.id,
          word: state.wordChoices[0],
        })
        state = applyAction(state, { type: 'END_TURN', playerId: 'host' })
        if (r === 2 && i === 2) break // last turn goes to finished
        state = applyAction(state, { type: 'NEXT_TURN', playerId: 'host' })
      }
    }
    expect(state.phase).toBe('round-end')
    state = applyAction(state, { type: 'NEXT_TURN', playerId: 'host' })
    expect(state.phase).toBe('finished')
  })
})

describe('PLAY_AGAIN', () => {
  it('restarts from finished state', () => {
    let state = startedGame()
    state = { ...state, phase: 'finished' }
    const next = applyAction(state, { type: 'PLAY_AGAIN', playerId: 'host' })
    expect(next.phase).toBe('picking')
    expect(next.round).toBe(1)
    expect(next.players.every((p) => p.score === 0)).toBe(true)
  })
})

describe('generateHint', () => {
  it('generates underscores for letters', () => {
    expect(generateHint('apple')).toBe('_ _ _ _ _')
  })

  it('preserves spaces', () => {
    expect(generateHint('ice cream')).toBe('_ _ _    _ _ _ _ _')
  })
})

describe('revealHintLetters', () => {
  it('reveals specified number of letters', () => {
    const hint = revealHintLetters('apple', 2)
    const revealed = hint.split(' ').filter((ch) => ch !== '_' && ch !== '')
    expect(revealed.length).toBe(2)
  })
})

describe('REVEAL_HINT', () => {
  function drawingState(): GameState {
    const state = startedGame()
    const drawer = getCurrentDrawer(state)!
    const next = applyAction(state, {
      type: 'PICK_WORD',
      playerId: drawer.id,
      word: state.wordChoices[0],
    })
    return { ...next, drawStartTime: Date.now() - 40000 }
  }

  it('non-drawer cannot reveal hints', () => {
    const state = drawingState()
    const next = applyAction(state, { type: 'REVEAL_HINT', playerId: 'p2', ratio: 0.5 })
    expect(next).toBe(state)
  })

  it('does nothing in wrong phase', () => {
    const state = { ...drawingState(), phase: 'lobby' as const }
    const drawer = getCurrentDrawer(state)!
    const next = applyAction(state, { type: 'REVEAL_HINT', playerId: drawer.id, ratio: 0.5 })
    expect(next).toBe(state)
  })

  it('does nothing when ratio is below 0.5', () => {
    const state = drawingState()
    const drawer = getCurrentDrawer(state)!
    const next = applyAction(state, { type: 'REVEAL_HINT', playerId: drawer.id, ratio: 0.3 })
    expect(next).toBe(state)
  })

  it('reveals ~30% of letters at ratio 0.5', () => {
    const state = drawingState()
    const drawer = getCurrentDrawer(state)!
    const next = applyAction(state, { type: 'REVEAL_HINT', playerId: drawer.id, ratio: 0.5 })
    expect(next.hint).not.toBe(state.hint)
    const revealed = next.hint.split(' ').filter((ch) => ch !== '_' && ch !== '')
    expect(revealed.length).toBeGreaterThan(0)
  })

  it('reveals ~60% of letters at ratio 0.75', () => {
    const state = drawingState()
    const drawer = getCurrentDrawer(state)!
    const at50 = applyAction(state, { type: 'REVEAL_HINT', playerId: drawer.id, ratio: 0.5 })
    const at75 = applyAction(state, { type: 'REVEAL_HINT', playerId: drawer.id, ratio: 0.75 })
    const revealed50 = at50.hint.split(' ').filter((ch) => ch !== '_' && ch !== '').length
    const revealed75 = at75.hint.split(' ').filter((ch) => ch !== '_' && ch !== '').length
    expect(revealed75).toBeGreaterThan(revealed50)
  })
})

describe('calculateGuessScore', () => {
  it('gives higher score for faster guesses', () => {
    const fast = calculateGuessScore(1000, 80000, 3, 0)
    const slow = calculateGuessScore(70000, 80000, 3, 0)
    expect(fast).toBeGreaterThan(slow)
  })

  it('gives bonus for early guess order', () => {
    const first = calculateGuessScore(10000, 80000, 3, 0)
    const last = calculateGuessScore(10000, 80000, 3, 2)
    expect(first).toBeGreaterThan(last)
  })
})

describe('calculateDrawerScore', () => {
  it('returns 0 when no one guessed', () => {
    expect(calculateDrawerScore(0, 3)).toBe(0)
  })

  it('gives full score when all guessed', () => {
    expect(calculateDrawerScore(3, 3)).toBe(100)
  })

  it('gives partial score', () => {
    const score = calculateDrawerScore(1, 3)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })
})

describe('encodeWord / decodeWord', () => {
  it('round-trips a simple word', () => {
    expect(decodeWord(encodeWord('apple'))).toBe('apple')
  })

  it('round-trips a phrase with spaces', () => {
    expect(decodeWord(encodeWord('ice cream'))).toBe('ice cream')
  })

  it('encoded form differs from original', () => {
    expect(encodeWord('apple')).not.toBe('apple')
  })

  it('decodeWord returns empty string for empty input', () => {
    expect(decodeWord('')).toBe('')
  })
})

describe('pickRandomWords', () => {
  it('returns requested number of words', () => {
    expect(pickRandomWords(3)).toHaveLength(3)
  })

  it('excludes specified words', () => {
    const words = pickRandomWords(3, ['accordion', 'avalanche'])
    expect(words).not.toContain('accordion')
    expect(words).not.toContain('avalanche')
  })
})
