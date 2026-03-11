import answersData from '@/data/words/wordle-answers.json'
import validGuessesData from '@/data/words/wordle-valid-guesses.json'

export type TileState = 'correct' | 'present' | 'absent' | 'empty' | 'tbd'

export interface GuessResult {
  letter: string
  state: TileState
}

export const WORD_LENGTH = 5
export const MAX_GUESSES = 6

/** Evaluate a guess against the answer, returning per-letter states. */
export function evaluateGuess(guess: string, answer: string): GuessResult[] {
  const guessUpper = guess.toUpperCase()
  const answerUpper = answer.toUpperCase()
  const result: GuessResult[] = Array.from({ length: WORD_LENGTH }, (_, i) => ({
    letter: guessUpper[i],
    state: 'absent' as TileState,
  }))

  // Track which answer letters are still available for 'present' matching
  const answerLetterCount: Record<string, number> = {}
  for (const ch of answerUpper) {
    answerLetterCount[ch] = (answerLetterCount[ch] ?? 0) + 1
  }

  // First pass: mark correct letters
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessUpper[i] === answerUpper[i]) {
      result[i].state = 'correct'
      answerLetterCount[guessUpper[i]]--
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i].state === 'correct') continue
    const ch = guessUpper[i]
    if (answerLetterCount[ch] && answerLetterCount[ch] > 0) {
      result[i].state = 'present'
      answerLetterCount[ch]--
    }
  }

  return result
}

/** Merge keyboard letter states — correct > present > absent > undefined */
export function mergeKeyboardStates(
  existing: Record<string, TileState>,
  newResults: GuessResult[]
): Record<string, TileState> {
  const priority: Record<TileState, number> = {
    correct: 3,
    present: 2,
    absent: 1,
    empty: 0,
    tbd: 0,
  }
  const updated = { ...existing }
  for (const { letter, state } of newResults) {
    const current = updated[letter]
    if (!current || priority[state] > priority[current]) {
      updated[letter] = state
    }
  }
  return updated
}

/** Check if the game is won */
export function isWin(results: GuessResult[]): boolean {
  return results.every((r) => r.state === 'correct')
}

/** Pick a deterministic daily word from a word list */
export function getDailyWord(wordList: string[]): string {
  const epoch = new Date('2024-01-01').getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayIndex = Math.floor((today.getTime() - epoch) / 86_400_000)
  return wordList[dayIndex % wordList.length].toUpperCase()
}

/** Curated answer pool (~2,315 common 5-letter words). */
export const WORD_LIST: string[] = answersData

/** Full set of valid guesses (answers + additional accepted words). */
const VALID_GUESSES_SET: Set<string> = new Set([...answersData, ...validGuessesData])

/** Check whether a 5-letter guess is a recognised English word. */
export function isValidGuess(word: string): boolean {
  return VALID_GUESSES_SET.has(word.toUpperCase())
}
