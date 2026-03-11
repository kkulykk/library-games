import {
  evaluateGuess,
  mergeKeyboardStates,
  isWin,
  getDailyWord,
  isValidGuess,
  WORD_LIST,
  type TileState,
} from './logic'

describe('evaluateGuess', () => {
  it('marks all letters correct when guess equals answer', () => {
    const result = evaluateGuess('CRANE', 'CRANE')
    expect(result.every((r) => r.state === 'correct')).toBe(true)
  })

  it('marks absent letters correctly', () => {
    const result = evaluateGuess('ZZZZZ', 'CRANE')
    expect(result.every((r) => r.state === 'absent')).toBe(true)
  })

  it('marks present letters (wrong position)', () => {
    const result = evaluateGuess('ECRAN', 'CRANE')
    // C is at index 0 in ECRAN, should be present (it's in CRANE at index 0)
    // Actually E is at 0 in ECRAN, in CRANE E is at 4 → present
    // C is at 1 in ECRAN, in CRANE C is at 0 → present
    // R is at 2 in ECRAN, in CRANE R is at 1 → present
    // A is at 3 in ECRAN, in CRANE A is at 2 → present
    // N is at 4 in ECRAN, in CRANE N is at 3 → present
    expect(result[0].state).toBe('present') // E
    expect(result[1].state).toBe('present') // C
    expect(result[2].state).toBe('present') // R
    expect(result[3].state).toBe('present') // A
    expect(result[4].state).toBe('present') // N
  })

  it('handles duplicate letters in guess correctly', () => {
    // Answer CRANE, guess EERIE → only one E should be marked
    const result = evaluateGuess('EERIE', 'CRANE')
    const eStates = result.filter((r) => r.letter === 'E').map((r) => r.state)
    const ePresent = eStates.filter((s) => s !== 'absent').length
    expect(ePresent).toBeLessThanOrEqual(1) // CRANE has one E
  })

  it('handles duplicate answer letters', () => {
    // Answer GEESE, guess EAGLE
    const result = evaluateGuess('EAGLE', 'GEESE')
    // E at index 0: GEESE[0]=G → not E, check presence: GEESE has E at 1,2,4 → present
    expect(result[0].state).toBe('present') // E → present
    // A at index 1: GEESE has no A → absent
    expect(result[1].state).toBe('absent')
    // G at index 2: GEESE[2]=E → not G, G at index 0 → present
    expect(result[2].state).toBe('present')
    // L at index 3: GEESE has no L → absent
    expect(result[3].state).toBe('absent')
    // E at index 4: GEESE[4]=E → correct
    expect(result[4].state).toBe('correct')
  })

  it('is case insensitive', () => {
    const lower = evaluateGuess('crane', 'CRANE')
    const upper = evaluateGuess('CRANE', 'crane')
    expect(lower.every((r) => r.state === 'correct')).toBe(true)
    expect(upper.every((r) => r.state === 'correct')).toBe(true)
  })

  it('returns correct letter values in uppercase', () => {
    const result = evaluateGuess('crane', 'CRANE')
    expect(result.map((r) => r.letter)).toEqual(['C', 'R', 'A', 'N', 'E'])
  })
})

describe('mergeKeyboardStates', () => {
  it('upgrades absent to present', () => {
    const existing: Record<string, TileState> = { A: 'absent' }
    const newResults = [{ letter: 'A', state: 'present' as TileState }]
    const merged = mergeKeyboardStates(existing, newResults)
    expect(merged['A']).toBe('present')
  })

  it('upgrades present to correct', () => {
    const existing: Record<string, TileState> = { A: 'present' }
    const newResults = [{ letter: 'A', state: 'correct' as TileState }]
    const merged = mergeKeyboardStates(existing, newResults)
    expect(merged['A']).toBe('correct')
  })

  it('does not downgrade correct to present', () => {
    const existing: Record<string, TileState> = { A: 'correct' }
    const newResults = [{ letter: 'A', state: 'present' as TileState }]
    const merged = mergeKeyboardStates(existing, newResults)
    expect(merged['A']).toBe('correct')
  })

  it('adds new letter state', () => {
    const existing: Record<string, TileState> = {}
    const newResults = [{ letter: 'Z', state: 'absent' as TileState }]
    const merged = mergeKeyboardStates(existing, newResults)
    expect(merged['Z']).toBe('absent')
  })
})

describe('isWin', () => {
  it('returns true when all letters are correct', () => {
    const results = Array.from({ length: 5 }, () => ({
      letter: 'A',
      state: 'correct' as TileState,
    }))
    expect(isWin(results)).toBe(true)
  })

  it('returns false when any letter is not correct', () => {
    const results = [
      { letter: 'A', state: 'correct' as TileState },
      { letter: 'B', state: 'present' as TileState },
      { letter: 'C', state: 'correct' as TileState },
      { letter: 'D', state: 'correct' as TileState },
      { letter: 'E', state: 'correct' as TileState },
    ]
    expect(isWin(results)).toBe(false)
  })
})

describe('getDailyWord', () => {
  it('returns a word from the list', () => {
    const word = getDailyWord(WORD_LIST)
    expect(WORD_LIST).toContain(word)
  })

  it('returns a 5-letter uppercase word', () => {
    const word = getDailyWord(WORD_LIST)
    expect(word.length).toBe(5)
    expect(word).toBe(word.toUpperCase())
  })

  it('is deterministic for the same input list', () => {
    const word1 = getDailyWord(WORD_LIST)
    const word2 = getDailyWord(WORD_LIST)
    expect(word1).toBe(word2)
  })
})

describe('WORD_LIST', () => {
  it('contains at least 2000 answer words', () => {
    expect(WORD_LIST.length).toBeGreaterThanOrEqual(2000)
  })

  it('all words are 5 letters and uppercase', () => {
    for (const word of WORD_LIST) {
      expect(word).toHaveLength(5)
      expect(word).toBe(word.toUpperCase())
    }
  })
})

describe('isValidGuess', () => {
  it('accepts answer words', () => {
    expect(isValidGuess('CRANE')).toBe(true)
    expect(isValidGuess('ABOUT')).toBe(true)
  })

  it('accepts valid non-answer guesses', () => {
    // Words like AAHED are valid guesses but not answers
    expect(isValidGuess('AAHED')).toBe(true)
  })

  it('rejects non-words', () => {
    expect(isValidGuess('ZZZZZ')).toBe(false)
    expect(isValidGuess('XYZAB')).toBe(false)
  })

  it('is case insensitive', () => {
    expect(isValidGuess('crane')).toBe(true)
    expect(isValidGuess('Crane')).toBe(true)
  })

  it('validates all answer words are valid guesses', () => {
    for (const word of WORD_LIST) {
      expect(isValidGuess(word)).toBe(true)
    }
  })
})
