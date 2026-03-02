import {
  getMaskedWord,
  getLetterState,
  countWrongGuesses,
  isWin,
  isLoss,
  getRandomWord,
  MAX_WRONG_GUESSES,
  WORD_LIST,
} from './logic'

describe('getMaskedWord', () => {
  it('returns all underscores when no letters guessed', () => {
    expect(getMaskedWord('APPLE', new Set())).toEqual(['_', '_', '_', '_', '_'])
  })

  it('reveals only guessed letters', () => {
    expect(getMaskedWord('APPLE', new Set(['A', 'P']))).toEqual(['A', 'P', 'P', '_', '_'])
  })

  it('reveals all letters when all are guessed', () => {
    expect(getMaskedWord('CAT', new Set(['C', 'A', 'T']))).toEqual(['C', 'A', 'T'])
  })

  it('handles repeated letters correctly (BALLOON)', () => {
    expect(getMaskedWord('BALLOON', new Set(['L']))).toEqual(['_', '_', 'L', 'L', '_', '_', '_'])
  })

  it('handles word with all same letters', () => {
    expect(getMaskedWord('AAAAAA', new Set(['A']))).toEqual(['A', 'A', 'A', 'A', 'A', 'A'])
  })

  it('returns correct mask for single letter word', () => {
    expect(getMaskedWord('X', new Set())).toEqual(['_'])
    expect(getMaskedWord('X', new Set(['X']))).toEqual(['X'])
  })
})

describe('getLetterState', () => {
  it('returns unguessed for letter not yet guessed', () => {
    expect(getLetterState('APPLE', new Set(), 'A')).toBe('unguessed')
  })

  it('returns correct for guessed letter in word', () => {
    expect(getLetterState('APPLE', new Set(['A']), 'A')).toBe('correct')
  })

  it('returns wrong for guessed letter not in word', () => {
    expect(getLetterState('APPLE', new Set(['Z']), 'Z')).toBe('wrong')
  })

  it('returns correct for letter appearing multiple times', () => {
    expect(getLetterState('BALLOON', new Set(['L']), 'L')).toBe('correct')
  })

  it('handles letter guessed among other guesses', () => {
    const guessed = new Set(['A', 'B', 'C'])
    expect(getLetterState('APPLE', guessed, 'A')).toBe('correct')
    expect(getLetterState('APPLE', guessed, 'B')).toBe('wrong')
    expect(getLetterState('APPLE', guessed, 'C')).toBe('wrong')
  })
})

describe('countWrongGuesses', () => {
  it('returns 0 when no letters guessed', () => {
    expect(countWrongGuesses('APPLE', new Set())).toBe(0)
  })

  it('returns 0 when all guesses are correct', () => {
    expect(countWrongGuesses('CAT', new Set(['C', 'A', 'T']))).toBe(0)
  })

  it('counts only letters not in word', () => {
    expect(countWrongGuesses('APPLE', new Set(['A', 'Z', 'X']))).toBe(2)
  })

  it('counts each wrong letter once even for repeated letters in word', () => {
    expect(countWrongGuesses('BALLOON', new Set(['B', 'L', 'Z']))).toBe(1)
  })

  it('counts all wrong when no letters match', () => {
    expect(countWrongGuesses('APPLE', new Set(['Z', 'X', 'Q']))).toBe(3)
  })
})

describe('isWin', () => {
  it('returns false when no letters guessed', () => {
    expect(isWin('APPLE', new Set())).toBe(false)
  })

  it('returns false when only partial letters guessed', () => {
    expect(isWin('APPLE', new Set(['A', 'P']))).toBe(false)
  })

  it('returns true when all unique letters guessed', () => {
    expect(isWin('APPLE', new Set(['A', 'P', 'L', 'E']))).toBe(true)
  })

  it('returns true for word with repeated letters when unique letters guessed', () => {
    expect(isWin('BALLOON', new Set(['B', 'A', 'L', 'O', 'N']))).toBe(true)
  })

  it('returns true even if extra wrong letters guessed', () => {
    expect(isWin('CAT', new Set(['C', 'A', 'T', 'Z', 'X']))).toBe(true)
  })

  it('returns false when one letter missing', () => {
    expect(isWin('APPLE', new Set(['A', 'P', 'L']))).toBe(false)
  })
})

describe('isLoss', () => {
  it('returns false for 0 wrong guesses', () => {
    expect(isLoss(0)).toBe(false)
  })

  it('returns false for wrong guesses below max', () => {
    for (let i = 1; i < MAX_WRONG_GUESSES; i++) {
      expect(isLoss(i)).toBe(false)
    }
  })

  it('returns true at exactly MAX_WRONG_GUESSES', () => {
    expect(isLoss(MAX_WRONG_GUESSES)).toBe(true)
  })

  it('returns true for more than MAX_WRONG_GUESSES', () => {
    expect(isLoss(MAX_WRONG_GUESSES + 1)).toBe(true)
    expect(isLoss(MAX_WRONG_GUESSES + 5)).toBe(true)
  })

  it('MAX_WRONG_GUESSES is 6', () => {
    expect(MAX_WRONG_GUESSES).toBe(6)
  })
})

describe('getRandomWord', () => {
  it('returns a word from the list', () => {
    const word = getRandomWord(WORD_LIST)
    expect(WORD_LIST).toContain(word)
  })

  it('returns an uppercase word', () => {
    const word = getRandomWord(WORD_LIST)
    expect(word).toBe(word.toUpperCase())
  })

  it('returns different words over multiple calls (variety check)', () => {
    const words = new Set(Array.from({ length: 20 }, () => getRandomWord(WORD_LIST)))
    expect(words.size).toBeGreaterThan(1)
  })

  it('works with a custom word list', () => {
    const customList = ['HELLO', 'WORLD', 'TESTS']
    const word = getRandomWord(customList)
    expect(customList).toContain(word)
  })

  it('returns the only element from a single-item list', () => {
    expect(getRandomWord(['ONLY'])).toBe('ONLY')
  })
})
