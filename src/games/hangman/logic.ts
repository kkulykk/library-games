import easyWords from '@/data/words/hangman-easy.json'
import mediumWords from '@/data/words/hangman-medium.json'
import hardWords from '@/data/words/hangman-hard.json'

export type LetterState = 'correct' | 'wrong' | 'unguessed'
export type Difficulty = 'easy' | 'medium' | 'hard'

export const MAX_WRONG_GUESSES = 6

export const WORD_LISTS: Record<Difficulty, string[]> = {
  easy: easyWords,
  medium: mediumWords,
  hard: hardWords,
}

/** Flat list combining all difficulties (backwards-compatible). */
export const WORD_LIST: string[] = [...easyWords, ...mediumWords, ...hardWords]

export function getRandomWord(wordList: string[]): string {
  return wordList[Math.floor(Math.random() * wordList.length)]
}

export function getRandomWordByDifficulty(difficulty: Difficulty): string {
  return getRandomWord(WORD_LISTS[difficulty])
}

export function getMaskedWord(word: string, guessedLetters: Set<string>): string[] {
  return word.split('').map((letter) => (guessedLetters.has(letter) ? letter : '_'))
}

export function getLetterState(
  word: string,
  guessedLetters: Set<string>,
  letter: string
): LetterState {
  if (!guessedLetters.has(letter)) return 'unguessed'
  return word.includes(letter) ? 'correct' : 'wrong'
}

export function countWrongGuesses(word: string, guessedLetters: Set<string>): number {
  let count = 0
  for (const letter of guessedLetters) {
    if (!word.includes(letter)) count++
  }
  return count
}

export function isWin(word: string, guessedLetters: Set<string>): boolean {
  return word.split('').every((letter) => guessedLetters.has(letter))
}

export function isLoss(wrongGuesses: number): boolean {
  return wrongGuesses >= MAX_WRONG_GUESSES
}
