import {
  addPlayer,
  allPlayersGuessed,
  applyAction,
  BULLSEYE_KM,
  canStartGame,
  createLobbyState,
  createSoloGame,
  currentSoloLocation,
  formatKm,
  getLeaderboard,
  getWinners,
  hasPlayerGuessed,
  haversineKm,
  isValidGuess,
  MAX_PLAYERS,
  MAX_ROUND_SCORE,
  MIN_PLAYERS,
  nextSoloRound,
  pickLocations,
  redactForPlayer,
  removePlayer,
  scoreDistance,
  submitSoloGuess,
  TOTAL_ROUNDS,
  type GameState,
  type GeoLocation,
  type Player,
} from './logic'
import { LOCATIONS } from './locations'
import { isLand, LAND_RINGS } from './worldMap'

const host: Player = { id: 'h1', name: 'Host', isHost: true, score: 0 }
const guest: Player = { id: 'g1', name: 'Guest', isHost: false, score: 0 }
const third: Player = { id: 'g2', name: 'Third', isHost: false, score: 0 }

// Stand-in for a scouted Random World deck: no clues, spread-out coordinates.
const randomDeck: GeoLocation[] = Array.from({ length: TOTAL_ROUNDS }, (_, i) => ({
  name: `Country ${i}`,
  country: `${i}.00°N, ${i}.00°E`,
  lat: i,
  lng: i,
  emoji: '🌐',
  clues: [],
}))

function playingState(players: Player[] = [host, guest]): GameState {
  let state = createLobbyState(host)
  for (const p of players.slice(1)) state = addPlayer(state, p)
  return applyAction(state, { type: 'START_GAME', playerId: host.id })
}

describe('geometry', () => {
  it('haversine distance between Paris and London is ~344 km', () => {
    const km = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 })
    expect(km).toBeGreaterThan(330)
    expect(km).toBeLessThan(360)
  })

  it('haversine distance to the same point is 0', () => {
    expect(haversineKm({ lat: 10, lng: 20 }, { lat: 10, lng: 20 })).toBe(0)
  })

  it('haversine distance between antipodes is ~half the circumference', () => {
    const km = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })
    expect(km).toBeGreaterThan(20000)
    expect(km).toBeLessThan(20050)
  })
})

describe('scoring', () => {
  it('awards the maximum inside the bullseye radius', () => {
    expect(scoreDistance(0)).toBe(MAX_ROUND_SCORE)
    expect(scoreDistance(BULLSEYE_KM)).toBe(MAX_ROUND_SCORE)
  })

  it('decays with distance', () => {
    const near = scoreDistance(200)
    const far = scoreDistance(3000)
    expect(near).toBeLessThan(MAX_ROUND_SCORE)
    expect(far).toBeLessThan(near)
    expect(far).toBeGreaterThanOrEqual(0)
  })

  it('is effectively zero on the other side of the planet', () => {
    expect(scoreDistance(19000)).toBe(0)
  })

  it('validates guesses', () => {
    expect(isValidGuess(0, 0)).toBe(true)
    expect(isValidGuess(91, 0)).toBe(false)
    expect(isValidGuess(0, 181)).toBe(false)
    expect(isValidGuess(NaN, 0)).toBe(false)
    expect(isValidGuess(0, Infinity)).toBe(false)
  })

  it('formats distances for display', () => {
    expect(formatKm(0.4)).toBe('<1 km')
    expect(formatKm(42.35)).toBe('42.4 km')
    expect(formatKm(12345)).toBe('12,345 km')
  })
})

describe('locations & map data', () => {
  it('has a big enough pool for a full game', () => {
    expect(LOCATIONS.length).toBeGreaterThanOrEqual(TOTAL_ROUNDS * 4)
  })

  it('every location has valid coordinates and at least 3 clues', () => {
    for (const loc of LOCATIONS) {
      expect(isValidGuess(loc.lat, loc.lng)).toBe(true)
      expect(loc.clues.length).toBeGreaterThanOrEqual(3)
      expect(loc.name.length).toBeGreaterThan(0)
      expect(loc.country.length).toBeGreaterThan(0)
    }
  })

  it('location names are unique', () => {
    const names = LOCATIONS.map((l) => l.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('pickLocations returns distinct locations', () => {
    const picked = pickLocations(TOTAL_ROUNDS)
    expect(picked).toHaveLength(TOTAL_ROUNDS)
    expect(new Set(picked.map((l) => l.name)).size).toBe(TOTAL_ROUNDS)
  })

  it('pickLocations never returns more than the pool', () => {
    const pool = LOCATIONS.slice(0, 3)
    expect(pickLocations(10, Math.random, pool)).toHaveLength(3)
  })

  it('land geometry covers famous landmarks and not open ocean', () => {
    expect(isLand(48.8, 2.3)).toBe(true) // Paris
    expect(isLand(-25.3, 131)).toBe(true) // Uluru
    expect(isLand(40.75, -74)).toBe(true) // New York
    expect(isLand(55.75, 37.62)).toBe(true) // Moscow
    expect(isLand(0, -30)).toBe(false) // mid-Atlantic
    expect(isLand(-40, -120)).toBe(false) // South Pacific
    expect(isLand(42, 50.5)).toBe(false) // Caspian Sea (a hole in the Eurasia ring)
  })

  it('ships closed Natural Earth rings with sane coordinates', () => {
    expect(LAND_RINGS.length).toBeGreaterThan(100)
    for (const ring of LAND_RINGS) {
      expect(ring.length).toBeGreaterThanOrEqual(4)
      for (const [lng, lat] of ring) {
        expect(Math.abs(lng)).toBeLessThanOrEqual(180)
        expect(Math.abs(lat)).toBeLessThanOrEqual(90)
      }
    }
  })
})

describe('lobby', () => {
  it('creates a lobby with the host', () => {
    const state = createLobbyState(host)
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(1)
    expect(state.totalRounds).toBe(TOTAL_ROUNDS)
    expect(canStartGame(state)).toBe(false)
  })

  it('adds players up to the maximum', () => {
    let state = createLobbyState(host)
    for (let i = 0; i < MAX_PLAYERS + 2; i++) {
      state = addPlayer(state, { id: `p${i}`, name: `P${i}`, isHost: false, score: 0 })
    }
    expect(state.players).toHaveLength(MAX_PLAYERS)
  })

  it('ignores duplicate player ids and joins after the lobby', () => {
    let state = createLobbyState(host)
    state = addPlayer(state, guest)
    expect(addPlayer(state, guest).players).toHaveLength(2)
    const started = applyAction(state, { type: 'START_GAME', playerId: host.id })
    expect(addPlayer(started, third)).toBe(started)
  })
})

describe('START_GAME', () => {
  it('uses a supplied playable deck (Random World mode)', () => {
    let state = createLobbyState(host)
    state = addPlayer(state, guest)
    state = applyAction(state, { type: 'START_GAME', playerId: host.id, deck: randomDeck })
    expect(state.phase).toBe('playing')
    expect(state.deck).toEqual(randomDeck)
    expect(state.currentRound?.location.name).toBe('Country 0')
  })

  it('falls back to the landmark pool when a supplied deck is short or malformed', () => {
    let state = createLobbyState(host)
    state = addPlayer(state, guest)
    const short = applyAction(state, {
      type: 'START_GAME',
      playerId: host.id,
      deck: randomDeck.slice(0, 2),
    })
    expect(short.phase).toBe('playing')
    expect(short.deck.map((l) => l.name)).not.toEqual(randomDeck.slice(0, 2).map((l) => l.name))

    const malformed = applyAction(state, {
      type: 'START_GAME',
      playerId: host.id,
      deck: randomDeck.map((l) => ({ ...l, lat: 999 })),
    })
    expect(malformed.phase).toBe('playing')
    expect(malformed.deck.every((l) => Math.abs(l.lat) <= 90)).toBe(true)
  })

  it('createSoloGame plays the supplied deck and drops malformed entries', () => {
    const game = createSoloGame(randomDeck)
    expect(game.rounds).toEqual(randomDeck)
    const dirty = createSoloGame([...randomDeck.slice(0, 2), { ...randomDeck[2], lat: 999 }])
    expect(dirty.rounds).toHaveLength(2)
  })

  it('starts with a full deck and round 1 in guessing phase', () => {
    const state = playingState()
    expect(state.phase).toBe('playing')
    expect(state.roundNumber).toBe(1)
    expect(state.deck).toHaveLength(TOTAL_ROUNDS)
    expect(state.currentRound?.phase).toBe('guessing')
    expect(state.currentRound?.location).toEqual(state.deck[0])
  })

  it('only the host can start, and only with enough players', () => {
    let state = createLobbyState(host)
    expect(applyAction(state, { type: 'START_GAME', playerId: host.id })).toBe(state)
    state = addPlayer(state, guest)
    expect(applyAction(state, { type: 'START_GAME', playerId: guest.id })).toBe(state)
    expect(state.players.length).toBeGreaterThanOrEqual(MIN_PLAYERS)
  })
})

describe('SUBMIT_GUESS', () => {
  it('records a guess without revealing until everyone is in', () => {
    let state = playingState()
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 10, lng: 20 })
    expect(state.currentRound?.phase).toBe('guessing')
    expect(hasPlayerGuessed(state, host.id)).toBe(true)
    expect(hasPlayerGuessed(state, guest.id)).toBe(false)
    expect(allPlayersGuessed(state)).toBe(false)
  })

  it('reveals and scores once all players have guessed', () => {
    let state = playingState()
    const target = state.currentRound!.location
    state = applyAction(state, {
      type: 'SUBMIT_GUESS',
      playerId: host.id,
      lat: target.lat,
      lng: target.lng,
    })
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guest.id, lat: 0, lng: 0 })

    const round = state.currentRound!
    expect(round.phase).toBe('reveal')
    expect(round.roundScores[host.id]).toBe(MAX_ROUND_SCORE)
    expect(round.distances[host.id]).toBe(0)
    expect(state.players.find((p) => p.id === host.id)?.score).toBe(MAX_ROUND_SCORE)
    expect(allPlayersGuessed(state)).toBe(true)
  })

  it('rejects double guesses, invalid coordinates, and unknown players', () => {
    let state = playingState()
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 10, lng: 20 })
    const again = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 30, lng: 40 })
    expect(again.currentRound?.guesses[host.id]).toEqual({ lat: 10, lng: 20 })
    expect(applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 999, lng: 0 })).toBe(
      state
    )
    expect(applyAction(state, { type: 'SUBMIT_GUESS', playerId: 'nope', lat: 1, lng: 1 })).toBe(
      state
    )
  })

  it('is a no-op outside the guessing phase', () => {
    const lobby = createLobbyState(host)
    expect(applyAction(lobby, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 1, lng: 1 })).toBe(
      lobby
    )
  })
})

describe('NEXT_ROUND / PLAY_AGAIN', () => {
  function revealedState(): GameState {
    let state = playingState()
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 0, lng: 0 })
    return applyAction(state, { type: 'SUBMIT_GUESS', playerId: guest.id, lat: 0, lng: 0 })
  }

  it('advances to the next round with the next deck location', () => {
    let state = revealedState()
    state = applyAction(state, { type: 'NEXT_ROUND', playerId: host.id })
    expect(state.roundNumber).toBe(2)
    expect(state.currentRound?.phase).toBe('guessing')
    expect(state.currentRound?.location).toEqual(state.deck[1])
  })

  it('only the host can advance, and only from reveal', () => {
    const state = revealedState()
    expect(applyAction(state, { type: 'NEXT_ROUND', playerId: guest.id })).toBe(state)
    const guessing = playingState()
    expect(applyAction(guessing, { type: 'NEXT_ROUND', playerId: host.id })).toBe(guessing)
  })

  it('finishes after the final round and can be restarted by the host', () => {
    let state = revealedState()
    for (let i = 1; i < TOTAL_ROUNDS; i++) {
      state = applyAction(state, { type: 'NEXT_ROUND', playerId: host.id })
      state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 0, lng: 0 })
      state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guest.id, lat: 0, lng: 0 })
    }
    state = applyAction(state, { type: 'NEXT_ROUND', playerId: host.id })
    expect(state.phase).toBe('finished')
    expect(state.currentRound).toBeNull()

    expect(applyAction(state, { type: 'PLAY_AGAIN', playerId: guest.id })).toBe(state)
    const again = applyAction(state, { type: 'PLAY_AGAIN', playerId: host.id })
    expect(again.phase).toBe('lobby')
    expect(again.players.every((p) => p.score === 0)).toBe(true)
    expect(again.deck).toHaveLength(0)
  })

  it('PLAY_AGAIN is a no-op unless finished', () => {
    const state = playingState()
    expect(applyAction(state, { type: 'PLAY_AGAIN', playerId: host.id })).toBe(state)
  })
})

describe('REMOVE_PLAYER', () => {
  /** A played-out room: `guest` pinned the target every round and won it. */
  function finishedState(): GameState {
    let state = playingState([host, guest, third])
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      const target = state.currentRound!.location
      state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 40, lng: 40 })
      state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: third.id, lat: 60, lng: 60 })
      state = applyAction(state, {
        type: 'SUBMIT_GUESS',
        playerId: guest.id,
        lat: target.lat,
        lng: target.lng,
      })
      state = applyAction(state, { type: 'NEXT_ROUND', playerId: host.id })
    }
    expect(state.phase).toBe('finished')
    return state
  }

  it('removes a player in the lobby', () => {
    let state = createLobbyState(host)
    state = addPlayer(state, guest)
    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: guest.id })
    expect(state.players).toHaveLength(1)
    expect(state.phase).toBe('lobby')
  })

  it('is a no-op for unknown players', () => {
    const state = playingState()
    expect(removePlayer(state, 'nope')).toBe(state)
  })

  it('ends the game when too few players remain mid-game', () => {
    let state = playingState()
    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: guest.id })
    expect(state.phase).toBe('finished')
    expect(state.currentRound).toBeNull()
  })

  it('reveals when the leaver was the last hold-out', () => {
    let state = playingState([host, guest, third])
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 0, lng: 0 })
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guest.id, lat: 5, lng: 5 })
    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: third.id })
    expect(state.players).toHaveLength(2)
    expect(state.currentRound?.phase).toBe('reveal')
    expect(state.currentRound?.roundScores[host.id]).toBeGreaterThanOrEqual(0)
  })

  it('keeps the winner on the board when they leave a finished room', () => {
    // The scoreboard is the result of the game. Deleting the leaver's row would
    // promote whoever came second — a room that rewrites its own ending as
    // people close their tabs.
    let state = finishedState()
    const winner = getWinners(state)[0]
    expect(winner.id).toBe(guest.id)

    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: guest.id })

    expect(state.players).toHaveLength(3)
    expect(getWinners(state).map((p) => p.id)).toEqual([guest.id])
    expect(getLeaderboard(state)[0].id).toBe(guest.id)
    expect(state.players.find((p) => p.id === guest.id)?.left).toBe(true)
    expect(state.log.at(-1)).toContain('left the expedition')
  })

  it('hands the host badge to somebody still in the finished room', () => {
    let state = finishedState()
    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: host.id })

    const stillHere = state.players.filter((p) => !p.left)
    expect(stillHere.filter((p) => p.isHost)).toHaveLength(1)
    expect(state.players.find((p) => p.id === host.id)?.isHost).toBe(false)
    // Leaving twice must not shuffle the badge again.
    expect(applyAction(state, { type: 'REMOVE_PLAYER', playerId: host.id })).toBe(state)
  })

  it('leaves the departed behind when the room plays again', () => {
    let state = finishedState()
    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: guest.id })
    const newHost = state.players.find((p) => p.isHost)!

    state = applyAction(state, { type: 'PLAY_AGAIN', playerId: newHost.id })

    expect(state.phase).toBe('lobby')
    expect(state.players.map((p) => p.id)).not.toContain(guest.id)
    expect(state.players.every((p) => p.score === 0 && !p.left)).toBe(true)
    expect(state.players.filter((p) => p.isHost)).toHaveLength(1)
  })

  it('drops the leaver from a revealed round without touching others', () => {
    let state = playingState([host, guest, third])
    for (const p of [host, guest, third]) {
      state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: p.id, lat: 0, lng: 0 })
    }
    expect(state.currentRound?.phase).toBe('reveal')
    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: guest.id })
    expect(state.currentRound?.roundScores[guest.id]).toBeUndefined()
    expect(state.currentRound?.roundScores[host.id]).toBeDefined()
  })
})

describe('KICK_PLAYER', () => {
  const kick = (state: GameState, playerId: string, targetId: string) =>
    applyAction(state, { type: 'KICK_PLAYER', playerId, targetId })

  it('drops a player who stopped answering and carries on', () => {
    let state = playingState([host, guest, third])
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 0, lng: 0 })
    state = kick(state, host.id, third.id)
    expect(state.players.map((p) => p.id)).toEqual([host.id, guest.id])
    expect(state.phase).toBe('playing')
    // Named both ways round: dropping somebody is the one thing a player does
    // on another's behalf, so the room log says who did it.
    expect(state.log.at(-1)).toBe(`${third.name} was dropped by ${host.name}.`)
  })

  it('tells a leaver apart from somebody who was dropped', () => {
    let state = playingState([host, guest, third])
    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: third.id })
    expect(state.log.at(-1)).toBe(`${third.name} left the expedition.`)
  })

  it('reveals the round when the dropped player was the last hold-out', () => {
    let state = playingState([host, guest, third])
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 0, lng: 0 })
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guest.id, lat: 4, lng: 4 })
    state = kick(state, guest.id, third.id)
    expect(state.currentRound?.phase).toBe('reveal')
  })

  it('lets a stranded room drop the host and hands the badge on', () => {
    let state = playingState([host, guest, third])
    state = kick(state, guest.id, host.id)
    expect(state.players.find((p) => p.id === guest.id)?.isHost).toBe(true)
    expect(state.players.some((p) => p.id === host.id)).toBe(false)
  })

  it('promotes a new host when the host simply leaves too', () => {
    let state = playingState([host, guest, third])
    state = applyAction(state, { type: 'REMOVE_PLAYER', playerId: host.id })
    expect(state.players.filter((p) => p.isHost)).toHaveLength(1)
    expect(state.players[0].isHost).toBe(true)
  })

  it('keeps the existing host when somebody else goes', () => {
    let state = playingState([host, guest, third])
    state = kick(state, host.id, third.id)
    expect(state.players.find((p) => p.id === host.id)?.isHost).toBe(true)
    expect(state.players.filter((p) => p.isHost)).toHaveLength(1)
  })

  it('works in the lobby as well as mid-round', () => {
    let state = createLobbyState(host)
    state = addPlayer(state, guest)
    state = kick(state, host.id, guest.id)
    expect(state.players).toHaveLength(1)
    expect(state.phase).toBe('lobby')
  })

  it('refuses kicks from strangers, kicks of strangers, and self-kicks', () => {
    const state = playingState([host, guest, third])
    expect(kick(state, 'nobody', guest.id)).toBe(state)
    expect(kick(state, host.id, 'nobody')).toBe(state)
    expect(kick(state, host.id, host.id)).toBe(state)
  })

  it('leaves a finished scoreboard alone', () => {
    let state = playingState([host, guest])
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 0, lng: 0 })
      state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guest.id, lat: 8, lng: 8 })
      state = applyAction(state, { type: 'NEXT_ROUND', playerId: host.id })
    }
    expect(state.phase).toBe('finished')
    expect(kick(state, host.id, guest.id)).toBe(state)
  })

  it('ends the expedition when a kick leaves too few players', () => {
    let state = playingState([host, guest])
    state = kick(state, host.id, guest.id)
    expect(state.phase).toBe('finished')
    expect(state.log.at(-1)).toContain('not enough players')
  })
})

describe('leaderboard & redaction', () => {
  it('sorts the leaderboard and finds winners (including ties)', () => {
    const state: GameState = {
      ...createLobbyState(host),
      players: [
        { ...host, score: 100 },
        { ...guest, score: 300 },
        { ...third, score: 300 },
      ],
    }
    expect(getLeaderboard(state)[0].id).toBe(guest.id)
    expect(
      getWinners(state)
        .map((p) => p.id)
        .sort()
    ).toEqual([guest.id, third.id])
    expect(getWinners({ ...state, players: [] })).toEqual([])
  })

  it('hides the answer and the deck while guessing', () => {
    const state = playingState()
    const redacted = redactForPlayer(state, guest.id)
    expect(redacted.deck).toHaveLength(0)
    expect(redacted.currentRound?.location.name).toBe('')
    expect(redacted.currentRound?.location.lat).toBe(0)
    expect(redacted.currentRound?.location.clues).toEqual(state.currentRound?.location.clues)
  })

  it('keeps the 360° pano visible while guessing — players need it to guess', () => {
    const base = playingState()
    const pano = {
      url: 'https://upload.wikimedia.org/example.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
      author: 'Jane Doe',
      license: 'CC BY-SA 4.0',
    }
    const state: GameState = {
      ...base,
      currentRound: {
        ...base.currentRound!,
        location: { ...base.currentRound!.location, pano },
      },
    }
    const redacted = redactForPlayer(state, guest.id)
    expect(redacted.currentRound?.location.pano).toEqual(pano)
    expect(redacted.currentRound?.location.name).toBe('')
  })

  it('reveals the answer (but not the deck) after the reveal', () => {
    let state = playingState()
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 0, lng: 0 })
    state = applyAction(state, { type: 'SUBMIT_GUESS', playerId: guest.id, lat: 0, lng: 0 })
    const redacted = redactForPlayer(state, guest.id)
    expect(redacted.currentRound?.location.name).not.toBe('')
    expect(redacted.deck).toHaveLength(0)
  })

  it('passes lobby states through (minus the deck)', () => {
    const lobby = createLobbyState(host)
    expect(redactForPlayer(lobby, host.id).currentRound).toBeNull()
  })
})

describe('SET_PLACE', () => {
  function randomWorldRound(): GameState {
    let state = createLobbyState(host)
    state = addPlayer(state, guest)
    return applyAction(state, { type: 'START_GAME', playerId: host.id, deck: randomDeck })
  }

  const place = { name: 'Ternberg', country: 'Austria' }

  it('records the host lookup on the current round', () => {
    const state = applyAction(randomWorldRound(), {
      type: 'SET_PLACE',
      playerId: host.id,
      roundNumber: 1,
      place,
    })
    expect(state.currentRound?.location.place).toEqual(place)
  })

  it('keeps a null country (open country has no settlement above it)', () => {
    const state = applyAction(randomWorldRound(), {
      type: 'SET_PLACE',
      playerId: host.id,
      roundNumber: 1,
      place: { name: 'Somewhere', country: null },
    })
    expect(state.currentRound?.location.place).toEqual({ name: 'Somewhere', country: null })
  })

  it('ignores non-hosts, stale rounds, blank names, and repeat writes', () => {
    const base = randomWorldRound()

    expect(
      applyAction(base, { type: 'SET_PLACE', playerId: guest.id, roundNumber: 1, place })
    ).toBe(base)
    expect(applyAction(base, { type: 'SET_PLACE', playerId: host.id, roundNumber: 2, place })).toBe(
      base
    )
    expect(
      applyAction(base, {
        type: 'SET_PLACE',
        playerId: host.id,
        roundNumber: 1,
        place: { name: '  ', country: 'Austria' },
      })
    ).toBe(base)

    // First write wins — a duplicate or late answer cannot overwrite it.
    const named = applyAction(base, {
      type: 'SET_PLACE',
      playerId: host.id,
      roundNumber: 1,
      place,
    })
    expect(
      applyAction(named, {
        type: 'SET_PLACE',
        playerId: host.id,
        roundNumber: 1,
        place: { name: 'Elsewhere', country: 'France' },
      })
    ).toBe(named)
  })

  it('is a no-op outside a live round', () => {
    const lobby = createLobbyState(host)
    expect(
      applyAction(lobby, { type: 'SET_PLACE', playerId: host.id, roundNumber: 1, place })
    ).toBe(lobby)
  })

  it('stays hidden until the reveal', () => {
    const state = applyAction(randomWorldRound(), {
      type: 'SET_PLACE',
      playerId: host.id,
      roundNumber: 1,
      place,
    })
    expect(redactForPlayer(state, guest.id).currentRound?.location.place).toBeUndefined()

    const revealed = applyAction(
      applyAction(state, { type: 'SUBMIT_GUESS', playerId: host.id, lat: 1, lng: 1 }),
      { type: 'SUBMIT_GUESS', playerId: guest.id, lat: 2, lng: 2 }
    )
    expect(redactForPlayer(revealed, guest.id).currentRound?.location.place).toEqual(place)
  })
})

describe('unknown action', () => {
  it('returns the state unchanged', () => {
    const state = playingState()
    expect(applyAction(state, { type: 'NOPE' } as never)).toBe(state)
  })
})

describe('solo mode', () => {
  it('creates a solo game with distinct rounds', () => {
    const game = createSoloGame(randomDeck)
    expect(game.rounds).toHaveLength(TOTAL_ROUNDS)
    expect(game.roundNumber).toBe(1)
    expect(game.phase).toBe('guessing')
    expect(currentSoloLocation(game)).toEqual(game.rounds[0])
  })

  it('scores a bullseye guess and accumulates the total', () => {
    let game = createSoloGame(randomDeck)
    const target = currentSoloLocation(game)
    game = submitSoloGuess(game, target.lat, target.lng)
    expect(game.phase).toBe('reveal')
    expect(game.results[0].points).toBe(MAX_ROUND_SCORE)
    expect(game.results[0].distanceKm).toBe(0)
    expect(game.totalScore).toBe(MAX_ROUND_SCORE)
  })

  it('ignores invalid or repeated guesses', () => {
    let game = createSoloGame(randomDeck)
    expect(submitSoloGuess(game, 999, 0)).toBe(game)
    game = submitSoloGuess(game, 0, 0)
    expect(submitSoloGuess(game, 1, 1)).toBe(game)
  })

  it('advances rounds and finishes after the last one', () => {
    let game = createSoloGame(randomDeck)
    expect(nextSoloRound(game)).toBe(game) // guessing phase — no-op
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      game = submitSoloGuess(game, 0, 0)
      game = nextSoloRound(game)
    }
    expect(game.phase).toBe('finished')
    expect(game.results).toHaveLength(TOTAL_ROUNDS)
    expect(nextSoloRound(game)).toBe(game)
  })
})
