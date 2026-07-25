import { GameStateSchema } from './schema'

const validLocation = {
  name: 'Eiffel Tower',
  country: 'France',
  lat: 48.858,
  lng: 2.294,
  emoji: '🗼',
  clues: ['clue one', 'clue two', 'clue three'],
}

const validGameState = {
  phase: 'lobby' as const,
  players: [{ id: 'p1', name: 'Alice', isHost: true, score: 0 }],
  totalRounds: 5,
  roundNumber: 0,
  deck: [],
  currentRound: null,
  log: [],
}

const validRound = {
  number: 1,
  location: validLocation,
  guesses: {},
  distances: {},
  roundScores: {},
  phase: 'guessing' as const,
}

const playing = {
  ...validGameState,
  phase: 'playing' as const,
  roundNumber: 1,
  deck: [validLocation],
}

describe('globetrotter GameStateSchema', () => {
  it('accepts a valid lobby state', () => {
    expect(GameStateSchema.safeParse(validGameState).success).toBe(true)
  })

  it('accepts a playing state with a current round', () => {
    const state = { ...playing, currentRound: validRound }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects an unknown phase', () => {
    expect(GameStateSchema.safeParse({ ...validGameState, phase: 'warmup' }).success).toBe(false)
  })

  it('rejects a player missing score', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'Alice', isHost: true }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a blank player name', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: '   ', isHost: true, score: 0 }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a 21-char player name', () => {
    const invalid = {
      ...validGameState,
      players: [{ id: 'p1', name: 'a'.repeat(21), isHost: true, score: 0 }],
    }
    expect(GameStateSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a location latitude beyond ±90', () => {
    const state = {
      ...playing,
      currentRound: { ...validRound, location: { ...validLocation, lat: 91 } },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('rejects a location longitude beyond ±180', () => {
    const state = {
      ...playing,
      currentRound: { ...validRound, location: { ...validLocation, lng: -181 } },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('accepts a round with populated guesses, distances, and scores', () => {
    const state = {
      ...playing,
      currentRound: {
        ...validRound,
        phase: 'reveal' as const,
        guesses: { p1: { lat: 40.5, lng: -74 } },
        distances: { p1: 812.4 },
        roundScores: { p1: 2941 },
      },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(true)
  })

  it('rejects a guess with out-of-range latitude', () => {
    const state = {
      ...playing,
      currentRound: { ...validRound, guesses: { p1: { lat: 120, lng: 0 } } },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('rejects a negative distance', () => {
    const state = {
      ...playing,
      currentRound: { ...validRound, distances: { p1: -3 } },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('rejects a non-integer round score', () => {
    const state = {
      ...playing,
      currentRound: { ...validRound, roundScores: { p1: 3.5 } },
    }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('rejects an unknown round phase', () => {
    const state = { ...playing, currentRound: { ...validRound, phase: 'scoring' } }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })

  it('accepts a location with a 360° pano and rejects a malformed one', () => {
    const pano = {
      url: 'https://upload.wikimedia.org/example.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
      author: 'Jane Doe',
      license: 'CC BY-SA 4.0',
    }
    const withPano = {
      ...playing,
      currentRound: { ...validRound, location: { ...validLocation, pano } },
    }
    expect(GameStateSchema.safeParse(withPano).success).toBe(true)

    const missingLicense: Partial<typeof pano> = { ...pano }
    delete missingLicense.license
    const malformed = {
      ...playing,
      currentRound: { ...validRound, location: { ...validLocation, pano: missingLicense } },
    }
    expect(GameStateSchema.safeParse(malformed).success).toBe(false)
  })

  it('accepts a resolved place, including one with no country', () => {
    for (const place of [
      { name: 'Ternberg', country: 'Austria' },
      { name: 'Somewhere', country: null },
    ]) {
      const state = {
        ...playing,
        currentRound: { ...validRound, location: { ...validLocation, place } },
      }
      expect(GameStateSchema.safeParse(state).success).toBe(true)
    }
  })

  it('rejects a malformed or oversized place', () => {
    for (const place of [
      { name: '', country: 'Austria' },
      { name: 'Ternberg' },
      { name: 'x'.repeat(121), country: 'Austria' },
      { name: 'Ternberg', country: 'y'.repeat(121) },
      'Ternberg',
    ]) {
      const state = {
        ...playing,
        currentRound: { ...validRound, location: { ...validLocation, place } },
      }
      expect(GameStateSchema.safeParse(state).success).toBe(false)
    }
  })

  it('rejects a deck entry missing clues', () => {
    const noClues: Partial<typeof validLocation> = { ...validLocation }
    delete noClues.clues
    const state = { ...playing, deck: [noClues] }
    expect(GameStateSchema.safeParse(state).success).toBe(false)
  })
})
