import {
  createDeck,
  shuffleDeck,
  canPlayCard,
  getPlayableCards,
  createLobbyState,
  addPlayer,
  removePlayer,
  startGame,
  applyAction,
  getCurrentPlayer,
  getTopCard,
  type Player,
  type GameState,
  type Card,
} from './logic'

const makePlayer = (id: string, name: string, isHost = false): Player => ({ id, name, isHost })

const p1 = makePlayer('p1', 'Alice', true)
const p2 = makePlayer('p2', 'Bob')
const p3 = makePlayer('p3', 'Carol')

function makeLobby(...players: Player[]): GameState {
  let state = createLobbyState(players[0])
  for (const p of players.slice(1)) state = addPlayer(state, p)
  return state
}

// ─── createDeck ──────────────────────────────────────────────────────────────

describe('createDeck', () => {
  it('creates 108 cards', () => {
    expect(createDeck()).toHaveLength(108)
  })

  it('has 25 cards per color', () => {
    const deck = createDeck()
    for (const color of ['red', 'yellow', 'green', 'blue']) {
      expect(deck.filter((c) => c.color === color)).toHaveLength(25)
    }
  })

  it('has one 0 per color', () => {
    const deck = createDeck()
    for (const color of ['red', 'yellow', 'green', 'blue']) {
      expect(deck.filter((c) => c.color === color && c.value === 0)).toHaveLength(1)
    }
  })

  it('has two 1–9 per color', () => {
    const deck = createDeck()
    for (const color of ['red', 'yellow', 'green', 'blue']) {
      for (let n = 1; n <= 9; n++) {
        expect(deck.filter((c) => c.color === color && c.value === n)).toHaveLength(2)
      }
    }
  })

  it('has 4 wild and 4 wild4 cards', () => {
    const deck = createDeck()
    expect(deck.filter((c) => c.value === 'wild')).toHaveLength(4)
    expect(deck.filter((c) => c.value === 'wild4')).toHaveLength(4)
  })

  it('assigns unique ids', () => {
    const ids = createDeck().map((c) => c.id)
    expect(new Set(ids).size).toBe(108)
  })
})

// ─── shuffleDeck ─────────────────────────────────────────────────────────────

describe('shuffleDeck', () => {
  it('preserves all cards', () => {
    const deck = createDeck()
    const shuffled = shuffleDeck(deck)
    expect(shuffled).toHaveLength(deck.length)
    expect(shuffled.map((c) => c.id).sort()).toEqual(deck.map((c) => c.id).sort())
  })

  it('does not mutate the original', () => {
    const deck = createDeck()
    const first = deck[0].id
    shuffleDeck(deck)
    expect(deck[0].id).toBe(first)
  })

  it('is deterministic with a seeded rng', () => {
    const deck = createDeck()
    const seed = () => 0.5
    expect(shuffleDeck(deck, seed)).toEqual(shuffleDeck(deck, seed))
  })
})

// ─── canPlayCard ─────────────────────────────────────────────────────────────

describe('canPlayCard', () => {
  const red5: Card = { id: '1', color: 'red', value: 5 }
  const blue5: Card = { id: '2', color: 'blue', value: 5 }
  const blue3: Card = { id: '3', color: 'blue', value: 3 }
  const wildCard: Card = { id: '4', color: 'wild', value: 'wild' }
  const wild4: Card = { id: '5', color: 'wild', value: 'wild4' }

  it('wild card can always be played', () => {
    expect(canPlayCard(wildCard, red5, 'red')).toBe(true)
    expect(canPlayCard(wild4, blue3, 'green')).toBe(true)
  })

  it('same color can be played', () => {
    expect(canPlayCard(blue3, blue5, 'blue')).toBe(true)
  })

  it('same value on different color can be played', () => {
    expect(canPlayCard(red5, blue5, 'blue')).toBe(true)
  })

  it('different color different value cannot be played', () => {
    expect(canPlayCard(red5, blue3, 'blue')).toBe(false)
  })

  it('matches currentColor (after wild played)', () => {
    // Wild was played and red was chosen
    const topWild: Card = { id: '6', color: 'wild', value: 'wild' }
    expect(canPlayCard(red5, topWild, 'red')).toBe(true)
    expect(canPlayCard(blue3, topWild, 'red')).toBe(false)
  })
})

// ─── addPlayer / removePlayer ─────────────────────────────────────────────────

describe('addPlayer', () => {
  it('adds a player in lobby', () => {
    const state = createLobbyState(p1)
    expect(addPlayer(state, p2).players).toHaveLength(2)
  })

  it('does not add duplicate', () => {
    const state = createLobbyState(p1)
    expect(addPlayer(state, p1).players).toHaveLength(1)
  })

  it('does not add when not in lobby phase', () => {
    const state = startGame(makeLobby(p1, p2))
    expect(addPlayer(state, p3).players).toHaveLength(2)
  })

  it('does not exceed 10 players', () => {
    let state = createLobbyState(p1)
    for (let i = 2; i <= 11; i++) {
      state = addPlayer(state, makePlayer(`p${i}`, `P${i}`))
    }
    expect(state.players).toHaveLength(10)
  })
})

describe('removePlayer', () => {
  it('removes a player by id', () => {
    const state = makeLobby(p1, p2, p3)
    expect(removePlayer(state, 'p2').players).toHaveLength(2)
  })

  it('adjusts currentPlayerIndex when earlier player removed', () => {
    const state = { ...makeLobby(p1, p2, p3), currentPlayerIndex: 2 }
    const next = removePlayer(state, 'p1')
    expect(next.currentPlayerIndex).toBe(1)
  })
})

// ─── startGame ───────────────────────────────────────────────────────────────

describe('startGame', () => {
  it('requires at least 2 players', () => {
    const state = createLobbyState(p1)
    expect(startGame(state).phase).toBe('lobby')
  })

  it('deals 7 cards to each player', () => {
    const state = startGame(makeLobby(p1, p2, p3))
    for (const player of [p1, p2, p3]) {
      expect(state.hands[player.id]).toHaveLength(7)
    }
  })

  it('sets phase to playing', () => {
    expect(startGame(makeLobby(p1, p2)).phase).toBe('playing')
  })

  it('draw pile has remaining cards', () => {
    const state = startGame(makeLobby(p1, p2))
    // 108 - 7*2 - 1 (discard) = 93
    expect(state.drawPile.length).toBe(93)
  })

  it('starting discard card is a number card', () => {
    const state = startGame(makeLobby(p1, p2))
    const top = getTopCard(state)
    expect(typeof top?.value).toBe('number')
  })

  it('resets pendingDrawCount and direction', () => {
    const state = startGame(makeLobby(p1, p2))
    expect(state.pendingDrawCount).toBe(0)
    expect(state.direction).toBe(1)
  })
})

// ─── applyAction ─────────────────────────────────────────────────────────────

function makePlayingState(players = [p1, p2]): GameState {
  return startGame(makeLobby(...players))
}

function injectHand(state: GameState, playerId: string, cards: Card[]): GameState {
  return { ...state, hands: { ...state.hands, [playerId]: cards } }
}

describe('applyAction – PLAY_CARD', () => {
  it('removes card from hand and adds to discard', () => {
    let state = makePlayingState()
    const topCard = getTopCard(state)!
    const matchCard: Card = {
      id: 'test1',
      color: topCard.color as 'red',
      value: topCard.value as 0,
    }
    state = injectHand(state, 'p1', [matchCard, ...state.hands['p1'].slice(1)])
    state = { ...state, currentColor: topCard.color as 'red' }

    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'test1' })
    expect(next.hands['p1']).not.toContainEqual(matchCard)
    expect(getTopCard(next)?.id).toBe('test1')
  })

  it('ignores invalid card (not in hand)', () => {
    const state = makePlayingState()
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'nonexistent' })
    expect(next).toBe(state)
  })

  it("ignores play when it is not the player's turn", () => {
    let state = makePlayingState()
    const card: Card = { id: 'tx', color: 'red', value: 1 }
    state = injectHand(state, 'p2', [card])
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p2', cardId: 'tx' })
    expect(next).toBe(state)
  })

  it('skip card advances two players', () => {
    const players = [p1, p2, p3]
    let state = makePlayingState(players)
    // extra card prevents the win condition from triggering
    const skipCard: Card = { id: 'skip1', color: state.currentColor, value: 'skip' }
    const extra: Card = { id: 'extra1', color: state.currentColor, value: 1 }
    state = injectHand(state, 'p1', [skipCard, extra])
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'skip1' })
    // p1(0) → skip 2 → p3(2)
    expect(next.currentPlayerIndex).toBe(2)
  })

  it('reverse card flips direction', () => {
    const players = [p1, p2, p3]
    let state = makePlayingState(players)
    const reverseCard: Card = { id: 'rev1', color: state.currentColor, value: 'reverse' }
    const extra: Card = { id: 'extra2', color: state.currentColor, value: 2 }
    state = injectHand(state, 'p1', [reverseCard, extra])
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'rev1' })
    expect(next.direction).toBe(-1)
    // With 3 players, reverse from idx 0 with dir=-1 → idx 2
    expect(next.currentPlayerIndex).toBe(2)
  })

  it('reverse in 2-player acts as skip (same player goes again)', () => {
    let state = makePlayingState([p1, p2])
    const reverseCard: Card = { id: 'rev2', color: state.currentColor, value: 'reverse' }
    const extra: Card = { id: 'extra3', color: state.currentColor, value: 3 }
    state = injectHand(state, 'p1', [reverseCard, extra])
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'rev2' })
    expect(next.currentPlayerIndex).toBe(0) // p1 goes again
  })

  it('draw2 adds 2 to pendingDrawCount', () => {
    let state = makePlayingState()
    const draw2: Card = { id: 'd2', color: state.currentColor, value: 'draw2' }
    const extra: Card = { id: 'extra4', color: state.currentColor, value: 4 }
    state = injectHand(state, 'p1', [draw2, extra])
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'd2' })
    expect(next.pendingDrawCount).toBe(2)
  })

  it('wild4 adds 4 to pendingDrawCount', () => {
    let state = makePlayingState()
    const wild4: Card = { id: 'w4', color: 'wild', value: 'wild4' }
    const extra: Card = { id: 'extra5', color: state.currentColor, value: 5 }
    state = injectHand(state, 'p1', [wild4, extra])
    const next = applyAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'w4',
      chosenColor: 'blue',
    })
    expect(next.pendingDrawCount).toBe(4)
    expect(next.currentColor).toBe('blue')
  })

  it('wild card sets the chosen color', () => {
    let state = makePlayingState()
    const wildCard: Card = { id: 'w1', color: 'wild', value: 'wild' }
    state = injectHand(state, 'p1', [wildCard])
    const next = applyAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'w1',
      chosenColor: 'green',
    })
    expect(next.currentColor).toBe('green')
  })

  it('sets phase to finished when hand is emptied', () => {
    let state = makePlayingState()
    const topCard = getTopCard(state)!
    const matchCard: Card = { id: 'last', color: topCard.color as 'red', value: topCard.value as 0 }
    state = injectHand(state, 'p1', [matchCard])
    state = { ...state, currentColor: topCard.color as 'red' }
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'last' })
    expect(next.phase).toBe('finished')
    expect(next.winnerId).toBe('p1')
  })

  it('cannot play unrelated card when pendingDraw > 0', () => {
    let state = makePlayingState()
    state = { ...state, pendingDrawCount: 2 }
    const topDiscard: Card = { id: 'td', color: 'red', value: 'draw2' }
    state = { ...state, discardPile: [...state.discardPile, topDiscard] }
    const blueCard: Card = { id: 'b3', color: 'blue', value: 3 }
    state = injectHand(state, 'p1', [blueCard])
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'b3' })
    expect(next).toBe(state)
  })
})

describe('applyAction – DRAW_CARD', () => {
  it('draws 1 card when no pending draw', () => {
    const state = makePlayingState()
    const handBefore = state.hands['p1'].length
    const next = applyAction(state, { type: 'DRAW_CARD', playerId: 'p1' })
    expect(next.hands['p1']).toHaveLength(handBefore + 1)
    expect(next.currentPlayerIndex).toBe(1)
  })

  it('draws pendingDrawCount cards and clears it', () => {
    let state = makePlayingState()
    // First advance to p2's turn with pending draw (extra card avoids win condition)
    const draw2: Card = { id: 'da', color: state.currentColor, value: 'draw2' }
    const extra: Card = { id: 'extraDraw', color: state.currentColor, value: 6 }
    state = injectHand(state, 'p1', [draw2, extra])
    state = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'da' })
    expect(state.pendingDrawCount).toBe(2)
    expect(state.currentPlayerIndex).toBe(1)

    const handBefore = state.hands['p2'].length
    const next = applyAction(state, { type: 'DRAW_CARD', playerId: 'p2' })
    expect(next.hands['p2']).toHaveLength(handBefore + 2)
    expect(next.pendingDrawCount).toBe(0)
  })
})

describe('applyAction – SAY_UNO', () => {
  it('adds player to calledUno when they have 1 card', () => {
    let state = makePlayingState()
    state = injectHand(state, 'p1', [{ id: 'only', color: 'red', value: 1 }])
    const next = applyAction(state, { type: 'SAY_UNO', playerId: 'p1' })
    expect(next.calledUno).toContain('p1')
  })

  it('does not add player if they do not have exactly 1 card', () => {
    const state = makePlayingState()
    const next = applyAction(state, { type: 'SAY_UNO', playerId: 'p1' })
    expect(next.calledUno).not.toContain('p1')
  })

  it('does not duplicate entry', () => {
    let state = makePlayingState()
    state = injectHand(state, 'p1', [{ id: 'only', color: 'red', value: 1 }])
    state = applyAction(state, { type: 'SAY_UNO', playerId: 'p1' })
    const next = applyAction(state, { type: 'SAY_UNO', playerId: 'p1' })
    expect(next.calledUno.filter((id) => id === 'p1')).toHaveLength(1)
  })
})

describe('applyAction – START_GAME / PLAY_AGAIN', () => {
  it('START_GAME only works for host', () => {
    const state = makeLobby(p1, p2)
    expect(applyAction(state, { type: 'START_GAME', playerId: 'p2' }).phase).toBe('lobby')
    expect(applyAction(state, { type: 'START_GAME', playerId: 'p1' }).phase).toBe('playing')
  })

  it('PLAY_AGAIN restarts a finished game', () => {
    let state = startGame(makeLobby(p1, p2))
    state = { ...state, phase: 'finished', winnerId: 'p1' }
    const next = applyAction(state, { type: 'PLAY_AGAIN', playerId: 'p1' })
    expect(next.phase).toBe('playing')
    expect(next.winnerId).toBeNull()
  })
})

// ─── getPlayableCards ─────────────────────────────────────────────────────────

describe('getPlayableCards', () => {
  it('returns cards playable on current color/value', () => {
    const topCard: Card = { id: 't', color: 'red', value: 5 }
    const hand: Card[] = [
      { id: 'a', color: 'red', value: 3 }, // same color ✓
      { id: 'b', color: 'blue', value: 5 }, // same value ✓
      { id: 'c', color: 'green', value: 2 }, // neither ✗
      { id: 'd', color: 'wild', value: 'wild' }, // wild ✓
    ]
    const playable = getPlayableCards(hand, topCard, 'red', 0)
    expect(playable.has('a')).toBe(true)
    expect(playable.has('b')).toBe(true)
    expect(playable.has('c')).toBe(false)
    expect(playable.has('d')).toBe(true)
  })

  it('with pendingDraw only allows matching draw cards', () => {
    const topCard: Card = { id: 't', color: 'red', value: 'draw2' }
    const hand: Card[] = [
      { id: 'a', color: 'blue', value: 'draw2' }, // can stack ✓
      { id: 'b', color: 'wild', value: 'wild4' }, // can stack ✓
      { id: 'c', color: 'red', value: 3 }, // cannot ✗
    ]
    const playable = getPlayableCards(hand, topCard, 'red', 2)
    expect(playable.has('a')).toBe(true)
    expect(playable.has('b')).toBe(true)
    expect(playable.has('c')).toBe(false)
  })
})

describe('getCurrentPlayer / getTopCard', () => {
  it('getCurrentPlayer returns the player whose turn it is', () => {
    const state = makePlayingState()
    expect(getCurrentPlayer(state)?.id).toBe('p1')
  })

  it('getTopCard returns the last discard pile card', () => {
    const state = makePlayingState()
    expect(getTopCard(state)).toBeDefined()
  })
})
