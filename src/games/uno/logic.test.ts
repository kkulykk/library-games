import {
  createDeck,
  shuffleDeck,
  canPlayCard,
  canPlayWild4,
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

// ─── canPlayWild4 ────────────────────────────────────────────────────────────

describe('canPlayWild4', () => {
  it('allows wild4 when no cards match current color', () => {
    const hand: Card[] = [
      { id: 'w4', color: 'wild', value: 'wild4' },
      { id: 'b1', color: 'blue', value: 1 },
      { id: 'g2', color: 'green', value: 2 },
    ]
    expect(canPlayWild4(hand, 'w4', 'red')).toBe(true)
  })

  it('disallows wild4 when a card matches current color', () => {
    const hand: Card[] = [
      { id: 'w4', color: 'wild', value: 'wild4' },
      { id: 'r1', color: 'red', value: 1 },
      { id: 'b2', color: 'blue', value: 2 },
    ]
    expect(canPlayWild4(hand, 'w4', 'red')).toBe(false)
  })

  it('does not count the wild4 card itself as a match', () => {
    const hand: Card[] = [{ id: 'w4', color: 'wild', value: 'wild4' }]
    expect(canPlayWild4(hand, 'w4', 'red')).toBe(true)
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

  it('resets pendingDrawCount, direction, and drawnCardId', () => {
    const state = startGame(makeLobby(p1, p2))
    expect(state.pendingDrawCount).toBe(0)
    expect(state.direction).toBe(1)
    expect(state.drawnCardId).toBeNull()
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

  it('draw2 sets pendingDrawCount to 2 (no stacking)', () => {
    let state = makePlayingState()
    const draw2: Card = { id: 'd2', color: state.currentColor, value: 'draw2' }
    const extra: Card = { id: 'extra4', color: state.currentColor, value: 4 }
    state = injectHand(state, 'p1', [draw2, extra])
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'd2' })
    expect(next.pendingDrawCount).toBe(2)
  })

  it('wild4 sets pendingDrawCount to 4 (no stacking)', () => {
    let state = makePlayingState()
    // Give p1 only non-matching-color cards + the wild4
    const wild4: Card = { id: 'w4', color: 'wild', value: 'wild4' }
    const otherColor = state.currentColor === 'red' ? 'blue' : 'red'
    const extra: Card = { id: 'extra5', color: otherColor, value: 5 }
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

  it('wild4 is blocked when player has cards matching current color', () => {
    let state = makePlayingState()
    const wild4: Card = { id: 'w4', color: 'wild', value: 'wild4' }
    const matchCard: Card = { id: 'match', color: state.currentColor, value: 3 }
    state = injectHand(state, 'p1', [wild4, matchCard])
    const next = applyAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardId: 'w4',
      chosenColor: 'blue',
    })
    expect(next).toBe(state) // rejected
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

  it('cannot play cards when pendingDraw > 0 (no stacking)', () => {
    let state = makePlayingState()
    state = { ...state, pendingDrawCount: 2 }
    const topDiscard: Card = { id: 'td', color: 'red', value: 'draw2' }
    state = { ...state, discardPile: [...state.discardPile, topDiscard] }
    // Even a matching draw2 cannot be played — must draw
    const draw2: Card = { id: 'd2', color: 'red', value: 'draw2' }
    state = injectHand(state, 'p1', [draw2])
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'd2' })
    expect(next).toBe(state)
  })

  it('can only play drawn card when drawnCardId is set', () => {
    let state = makePlayingState()
    const topCard = getTopCard(state)!
    const drawnCard: Card = { id: 'drawn', color: topCard.color as 'red', value: 3 }
    const otherCard: Card = { id: 'other', color: topCard.color as 'red', value: 5 }
    state = injectHand(state, 'p1', [otherCard, drawnCard])
    state = { ...state, drawnCardId: 'drawn', currentColor: topCard.color as 'red' }

    // Cannot play the other card
    const rejected = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'other' })
    expect(rejected).toBe(state)

    // Can play the drawn card
    const accepted = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'drawn' })
    expect(accepted).not.toBe(state)
    expect(getTopCard(accepted)?.id).toBe('drawn')
  })

  it('clears drawnCardId after playing', () => {
    let state = makePlayingState()
    const topCard = getTopCard(state)!
    const drawnCard: Card = { id: 'drawn', color: topCard.color as 'red', value: 3 }
    state = injectHand(state, 'p1', [drawnCard, { id: 'x', color: 'blue', value: 9 }])
    state = { ...state, drawnCardId: 'drawn', currentColor: topCard.color as 'red' }
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'drawn' })
    expect(next.drawnCardId).toBeNull()
  })
})

describe('applyAction – DRAW_CARD', () => {
  it('draws 1 card when no pending draw and card is not playable', () => {
    let state = makePlayingState()
    // Make the top card something specific so we can control playability
    const topCard: Card = { id: 'top', color: 'red', value: 5 }
    state = { ...state, discardPile: [topCard], currentColor: 'red' }
    // Put a non-matching card on top of draw pile
    const unplayable: Card = { id: 'unplay', color: 'blue', value: 3 }
    state = { ...state, drawPile: [unplayable, ...state.drawPile.slice(1)] }
    const handBefore = state.hands['p1'].length
    const next = applyAction(state, { type: 'DRAW_CARD', playerId: 'p1' })
    expect(next.hands['p1']).toHaveLength(handBefore + 1)
    expect(next.currentPlayerIndex).toBe(1) // turn passed
    expect(next.drawnCardId).toBeNull()
  })

  it('sets drawnCardId when drawn card is playable', () => {
    let state = makePlayingState()
    const topCard: Card = { id: 'top', color: 'red', value: 5 }
    state = { ...state, discardPile: [topCard], currentColor: 'red' }
    // Put a matching card on top of draw pile
    const playableCard: Card = { id: 'play', color: 'red', value: 7 }
    state = { ...state, drawPile: [playableCard, ...state.drawPile.slice(1)] }
    const next = applyAction(state, { type: 'DRAW_CARD', playerId: 'p1' })
    expect(next.drawnCardId).toBe('play')
    expect(next.currentPlayerIndex).toBe(0) // turn NOT passed
  })

  it('draws pendingDrawCount cards and clears it', () => {
    let state = makePlayingState()
    // First advance to p2's turn with pending draw
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

  it('is blocked when drawnCardId is already set', () => {
    let state = makePlayingState()
    state = { ...state, drawnCardId: 'some-card' }
    const next = applyAction(state, { type: 'DRAW_CARD', playerId: 'p1' })
    expect(next).toBe(state)
  })
})

describe('applyAction – PASS_AFTER_DRAW', () => {
  it('advances turn when drawnCardId is set', () => {
    let state = makePlayingState()
    state = { ...state, drawnCardId: 'some-card' }
    const next = applyAction(state, { type: 'PASS_AFTER_DRAW', playerId: 'p1' })
    expect(next.drawnCardId).toBeNull()
    expect(next.currentPlayerIndex).toBe(1)
  })

  it('is a no-op when drawnCardId is not set', () => {
    const state = makePlayingState()
    const next = applyAction(state, { type: 'PASS_AFTER_DRAW', playerId: 'p1' })
    expect(next).toBe(state)
  })

  it('is a no-op for non-current player', () => {
    let state = makePlayingState()
    state = { ...state, drawnCardId: 'some-card' }
    const next = applyAction(state, { type: 'PASS_AFTER_DRAW', playerId: 'p2' })
    expect(next).toBe(state)
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

describe('applyAction – CATCH_UNO', () => {
  it('forces target to draw 2 if they have 1 card and did not call UNO', () => {
    let state = makePlayingState()
    state = injectHand(state, 'p2', [{ id: 'only', color: 'red', value: 1 }])
    const next = applyAction(state, { type: 'CATCH_UNO', playerId: 'p1', targetId: 'p2' })
    expect(next.hands['p2']).toHaveLength(3) // 1 + 2 penalty
  })

  it('is a no-op if target already called UNO', () => {
    let state = makePlayingState()
    state = injectHand(state, 'p2', [{ id: 'only', color: 'red', value: 1 }])
    state = { ...state, calledUno: ['p2'] }
    const next = applyAction(state, { type: 'CATCH_UNO', playerId: 'p1', targetId: 'p2' })
    expect(next).toBe(state)
  })

  it('is a no-op if target has more than 1 card', () => {
    const state = makePlayingState()
    const next = applyAction(state, { type: 'CATCH_UNO', playerId: 'p1', targetId: 'p2' })
    expect(next).toBe(state)
  })

  it('cannot catch yourself', () => {
    let state = makePlayingState()
    state = injectHand(state, 'p1', [{ id: 'only', color: 'red', value: 1 }])
    const next = applyAction(state, { type: 'CATCH_UNO', playerId: 'p1', targetId: 'p1' })
    expect(next).toBe(state)
  })

  it('is a no-op while the grace window has not expired', () => {
    let state = makePlayingState()
    state = injectHand(state, 'p2', [{ id: 'only', color: 'red', value: 1 }])
    // Simulate a grace window ending 10 seconds in the future
    state = { ...state, unoWindow: { p2: Date.now() + 10_000 } }
    const next = applyAction(state, { type: 'CATCH_UNO', playerId: 'p1', targetId: 'p2' })
    expect(next).toBe(state)
  })

  it('allows catch once the grace window has expired', () => {
    let state = makePlayingState()
    state = injectHand(state, 'p2', [{ id: 'only', color: 'red', value: 1 }])
    // Simulate a grace window that already expired
    state = { ...state, unoWindow: { p2: Date.now() - 1_000 } }
    const next = applyAction(state, { type: 'CATCH_UNO', playerId: 'p1', targetId: 'p2' })
    expect(next.hands['p2']).toHaveLength(3) // 1 + 2 penalty
  })
})

describe('applyAction – unoWindow on PLAY_CARD', () => {
  it('sets unoWindow when a player plays down to 1 card', () => {
    let state = makePlayingState()
    const topCard = getTopCard(state)!
    const card1: Card = { id: 'c1', color: topCard.color as 'red', value: 1 }
    const card2: Card = { id: 'c2', color: topCard.color as 'red', value: 2 }
    state = injectHand(state, 'p1', [card1, card2])
    state = { ...state, currentColor: topCard.color as 'red' }
    const before = Date.now()
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'c1' })
    expect(next.unoWindow['p1']).toBeGreaterThanOrEqual(before + 2000)
  })

  it('clears unoWindow when a player plays down from 2 to more cards (not 1)', () => {
    let state = makePlayingState()
    const topCard = getTopCard(state)!
    const card1: Card = { id: 'c1', color: topCard.color as 'red', value: 1 }
    const card2: Card = { id: 'c2', color: topCard.color as 'red', value: 2 }
    const card3: Card = { id: 'c3', color: topCard.color as 'red', value: 3 }
    state = injectHand(state, 'p1', [card1, card2, card3])
    state = {
      ...state,
      currentColor: topCard.color as 'red',
      unoWindow: { p1: Date.now() + 99999 },
    }
    const next = applyAction(state, { type: 'PLAY_CARD', playerId: 'p1', cardId: 'c1' })
    // Playing leaves 2 cards — window should be cleared (set to 0)
    expect(next.unoWindow['p1'] ?? 0).toBe(0)
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
      { id: 'a', color: 'red', value: 3 }, // same color
      { id: 'b', color: 'blue', value: 5 }, // same value
      { id: 'c', color: 'green', value: 2 }, // neither
      { id: 'd', color: 'wild', value: 'wild' }, // wild
    ]
    const playable = getPlayableCards(hand, topCard, 'red', 0)
    expect(playable.has('a')).toBe(true)
    expect(playable.has('b')).toBe(true)
    expect(playable.has('c')).toBe(false)
    expect(playable.has('d')).toBe(true)
  })

  it('returns empty set when pendingDraw > 0 (no stacking)', () => {
    const topCard: Card = { id: 't', color: 'red', value: 'draw2' }
    const hand: Card[] = [
      { id: 'a', color: 'blue', value: 'draw2' },
      { id: 'b', color: 'wild', value: 'wild4' },
      { id: 'c', color: 'red', value: 3 },
    ]
    const playable = getPlayableCards(hand, topCard, 'red', 2)
    expect(playable.size).toBe(0)
  })

  it('wild4 only playable when no matching color in hand', () => {
    const topCard: Card = { id: 't', color: 'red', value: 5 }
    const hand: Card[] = [
      { id: 'w', color: 'wild', value: 'wild4' },
      { id: 'r', color: 'red', value: 3 }, // matches current color
    ]
    const playable = getPlayableCards(hand, topCard, 'red', 0)
    expect(playable.has('w')).toBe(false)
    expect(playable.has('r')).toBe(true)
  })

  it('wild4 playable when no matching color', () => {
    const topCard: Card = { id: 't', color: 'red', value: 5 }
    const hand: Card[] = [
      { id: 'w', color: 'wild', value: 'wild4' },
      { id: 'b', color: 'blue', value: 3 },
    ]
    const playable = getPlayableCards(hand, topCard, 'red', 0)
    expect(playable.has('w')).toBe(true)
  })

  it('restricts to drawn card only when drawnCardId is set', () => {
    const topCard: Card = { id: 't', color: 'red', value: 5 }
    const hand: Card[] = [
      { id: 'a', color: 'red', value: 3 },
      { id: 'drawn', color: 'red', value: 7 },
    ]
    const playable = getPlayableCards(hand, topCard, 'red', 0, 'drawn')
    expect(playable.has('drawn')).toBe(true)
    expect(playable.has('a')).toBe(false)
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
