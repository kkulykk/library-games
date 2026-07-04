import {
  addPlayer,
  allPlayersGuessed,
  applyAction,
  BULLSEYE_KM,
  canStartGame,
  clampLat,
  clampLng,
  createLobbyState,
  createSoloGame,
  currentSoloLocation,
  formatKm,
  getLeaderboard,
  getWinners,
  hasPlayerGuessed,
  haversineKm,
  isValidGuess,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_PLAYERS,
  MAX_ROUND_SCORE,
  MIN_PLAYERS,
  nextSoloRound,
  pickLocations,
  project,
  redactForPlayer,
  removePlayer,
  scoreDistance,
  submitSoloGuess,
  TOTAL_ROUNDS,
  unproject,
  type GameState,
  type Player,
} from './logic'
import { LOCATIONS } from './locations'
import { isLand, landDots } from './worldMap'

const host: Player = { id: 'h1', name: 'Host', isHost: true, score: 0 }
const guest: Player = { id: 'g1', name: 'Guest', isHost: false, score: 0 }
const third: Player = { id: 'g2', name: 'Third', isHost: false, score: 0 }

// Deterministic rng: always 0 → shuffle keeps a stable order.
const rngZero = () => 0

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

  it('project maps the corners of the world to the viewBox corners', () => {
    expect(project(90, -180)).toEqual({ x: 0, y: 0 })
    expect(project(-90, 180)).toEqual({ x: MAP_WIDTH, y: MAP_HEIGHT })
    expect(project(0, 0)).toEqual({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 })
  })

  it('unproject inverts project', () => {
    const { x, y } = project(48.8566, 2.3522)
    const back = unproject(x, y)
    expect(back.lat).toBeCloseTo(48.8566, 5)
    expect(back.lng).toBeCloseTo(2.3522, 5)
  })

  it('unproject clamps out-of-range coordinates', () => {
    expect(unproject(-50, -50)).toEqual({ lat: 90, lng: -180 })
    expect(unproject(MAP_WIDTH + 50, MAP_HEIGHT + 50)).toEqual({ lat: -90, lng: 180 })
  })

  it('clamps latitudes and longitudes', () => {
    expect(clampLat(120)).toBe(90)
    expect(clampLat(-120)).toBe(-90)
    expect(clampLng(200)).toBe(180)
    expect(clampLng(-200)).toBe(-180)
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

  it('land mask covers famous landmarks and not open ocean', () => {
    expect(isLand(48.8, 2.3)).toBe(true) // Paris
    expect(isLand(-25.3, 131)).toBe(true) // Uluru
    expect(isLand(40.7, -74)).toBe(true) // New York
    expect(isLand(0, -30)).toBe(false) // mid-Atlantic
    expect(isLand(-40, -120)).toBe(false) // South Pacific
  })

  it('landDots samples a plausible share of the globe as land', () => {
    const dots = landDots(3)
    const total = (360 / 3) * (180 / 3)
    expect(dots.length / total).toBeGreaterThan(0.15)
    expect(dots.length / total).toBeLessThan(0.5)
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

describe('unknown action', () => {
  it('returns the state unchanged', () => {
    const state = playingState()
    expect(applyAction(state, { type: 'NOPE' } as never)).toBe(state)
  })
})

describe('solo mode', () => {
  it('creates a solo game with distinct rounds', () => {
    const game = createSoloGame(rngZero)
    expect(game.rounds).toHaveLength(TOTAL_ROUNDS)
    expect(game.roundNumber).toBe(1)
    expect(game.phase).toBe('guessing')
    expect(currentSoloLocation(game)).toEqual(game.rounds[0])
  })

  it('scores a bullseye guess and accumulates the total', () => {
    let game = createSoloGame(rngZero)
    const target = currentSoloLocation(game)
    game = submitSoloGuess(game, target.lat, target.lng)
    expect(game.phase).toBe('reveal')
    expect(game.results[0].points).toBe(MAX_ROUND_SCORE)
    expect(game.results[0].distanceKm).toBe(0)
    expect(game.totalScore).toBe(MAX_ROUND_SCORE)
  })

  it('ignores invalid or repeated guesses', () => {
    let game = createSoloGame(rngZero)
    expect(submitSoloGuess(game, 999, 0)).toBe(game)
    game = submitSoloGuess(game, 0, 0)
    expect(submitSoloGuess(game, 1, 1)).toBe(game)
  })

  it('advances rounds and finishes after the last one', () => {
    let game = createSoloGame(rngZero)
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
