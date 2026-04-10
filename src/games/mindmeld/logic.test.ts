import {
  PUZZLES,
  ROUNDS_PER_GAME,
  BULLSEYE_POINTS,
  CLOSE_POINTS,
  MEDIUM_POINTS,
  MISS_POINTS,
  MAX_POINTS_PER_ROUND,
  scoreGuess,
  distanceFromTarget,
  shufflePuzzles,
  pickRoundPuzzles,
  maxPossibleScore,
  getRating,
} from './logic'

describe('PUZZLES bank', () => {
  it('has a healthy number of puzzles', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(50)
  })

  it('every puzzle has a target in the 0-100 range', () => {
    for (const puzzle of PUZZLES) {
      expect(puzzle.target).toBeGreaterThanOrEqual(0)
      expect(puzzle.target).toBeLessThanOrEqual(100)
    }
  })

  it('every puzzle has non-empty clue and spectrum labels', () => {
    for (const puzzle of PUZZLES) {
      expect(puzzle.clue.trim().length).toBeGreaterThan(0)
      expect(puzzle.spectrum.left.trim().length).toBeGreaterThan(0)
      expect(puzzle.spectrum.right.trim().length).toBeGreaterThan(0)
      expect(puzzle.spectrum.left).not.toBe(puzzle.spectrum.right)
    }
  })

  it('covers enough distinct spectra to fill a full round', () => {
    const spectra = new Set(PUZZLES.map((p) => `${p.spectrum.left}|${p.spectrum.right}`))
    expect(spectra.size).toBeGreaterThanOrEqual(ROUNDS_PER_GAME)
  })
})

describe('scoreGuess', () => {
  it('awards bullseye points for an exact guess', () => {
    expect(scoreGuess(50, 50)).toBe(BULLSEYE_POINTS)
  })

  it('awards bullseye points within 3 either way', () => {
    expect(scoreGuess(47, 50)).toBe(BULLSEYE_POINTS)
    expect(scoreGuess(53, 50)).toBe(BULLSEYE_POINTS)
  })

  it('awards close points between 4 and 7 away', () => {
    expect(scoreGuess(44, 50)).toBe(CLOSE_POINTS)
    expect(scoreGuess(57, 50)).toBe(CLOSE_POINTS)
  })

  it('awards medium points between 8 and 12 away', () => {
    expect(scoreGuess(38, 50)).toBe(MEDIUM_POINTS)
    expect(scoreGuess(62, 50)).toBe(MEDIUM_POINTS)
  })

  it('awards zero points outside 12 away', () => {
    expect(scoreGuess(30, 50)).toBe(MISS_POINTS)
    expect(scoreGuess(100, 0)).toBe(MISS_POINTS)
  })

  it('is symmetric in guess/target arguments', () => {
    expect(scoreGuess(10, 20)).toBe(scoreGuess(20, 10))
  })
})

describe('distanceFromTarget', () => {
  it('returns absolute distance', () => {
    expect(distanceFromTarget(30, 50)).toBe(20)
    expect(distanceFromTarget(70, 50)).toBe(20)
  })

  it('returns zero when equal', () => {
    expect(distanceFromTarget(42, 42)).toBe(0)
  })
})

describe('shufflePuzzles', () => {
  it('returns a new array containing all input puzzles', () => {
    const input = PUZZLES.slice(0, 8)
    const result = shufflePuzzles(input, () => 0)
    expect(result).toHaveLength(input.length)
    expect(result).not.toBe(input)
    for (const puzzle of input) {
      expect(result).toContain(puzzle)
    }
  })

  it('is deterministic for a fixed random source', () => {
    const seed = mulberry32(12345)
    const a = shufflePuzzles(PUZZLES.slice(0, 10), seed)
    const seed2 = mulberry32(12345)
    const b = shufflePuzzles(PUZZLES.slice(0, 10), seed2)
    expect(a.map((p) => p.clue)).toEqual(b.map((p) => p.clue))
  })
})

describe('pickRoundPuzzles', () => {
  it('returns the requested number of puzzles', () => {
    const picked = pickRoundPuzzles(PUZZLES, ROUNDS_PER_GAME, mulberry32(7))
    expect(picked).toHaveLength(ROUNDS_PER_GAME)
  })

  it('picks puzzles with unique spectra when possible', () => {
    const picked = pickRoundPuzzles(PUZZLES, ROUNDS_PER_GAME, mulberry32(7))
    const spectra = new Set(picked.map((p) => `${p.spectrum.left}|${p.spectrum.right}`))
    expect(spectra.size).toBe(ROUNDS_PER_GAME)
  })

  it('picks puzzles that belong to the input bank', () => {
    const picked = pickRoundPuzzles(PUZZLES, 5, mulberry32(1))
    for (const puzzle of picked) {
      expect(PUZZLES).toContain(puzzle)
    }
  })
})

describe('maxPossibleScore', () => {
  it('multiplies rounds by max points per round', () => {
    expect(maxPossibleScore(10)).toBe(10 * MAX_POINTS_PER_ROUND)
    expect(maxPossibleScore(0)).toBe(0)
  })
})

describe('getRating', () => {
  it('returns top rating for perfect scores', () => {
    expect(getRating(maxPossibleScore(10), 10)).toBe('Mind reader')
  })

  it('returns low rating for zero score', () => {
    expect(getRating(0, 10)).toBe('Static noise')
  })

  it('scales through intermediate bands', () => {
    const total = maxPossibleScore(10)
    expect(getRating(Math.floor(total * 0.8), 10)).toBe('Telepathic')
    expect(getRating(Math.floor(total * 0.55), 10)).toBe('Tuned in')
    expect(getRating(Math.floor(total * 0.3), 10)).toBe('Fuzzy signal')
  })
})

// ── Deterministic PRNG for tests ──────────────────────────────────────────────
// https://en.wikipedia.org/wiki/Mulberry32 — small seeded RNG good for shuffles.
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
