export interface Spectrum {
  left: string
  right: string
}

export interface Puzzle {
  spectrum: Spectrum
  clue: string
  target: number // 0-100
}

/**
 * Bank of spectrum puzzles. Each puzzle pairs a spectrum (two opposite ideas)
 * with a clue word and the position on the spectrum (0-100) where that clue
 * sits in the eyes of the puzzle's author. Players read the clue and try to
 * tune the dial to the same position.
 */
export const PUZZLES: Puzzle[] = [
  // Cold ↔ Hot
  { spectrum: { left: 'Cold', right: 'Hot' }, clue: 'Ice cube', target: 4 },
  { spectrum: { left: 'Cold', right: 'Hot' }, clue: 'Morning coffee', target: 72 },
  { spectrum: { left: 'Cold', right: 'Hot' }, clue: 'Lava', target: 100 },
  { spectrum: { left: 'Cold', right: 'Hot' }, clue: 'Sauna', target: 85 },
  { spectrum: { left: 'Cold', right: 'Hot' }, clue: 'Room temperature', target: 50 },

  // Boring ↔ Exciting
  { spectrum: { left: 'Boring', right: 'Exciting' }, clue: 'Watching paint dry', target: 2 },
  { spectrum: { left: 'Boring', right: 'Exciting' }, clue: 'Skydiving', target: 98 },
  { spectrum: { left: 'Boring', right: 'Exciting' }, clue: 'Filing taxes', target: 5 },
  { spectrum: { left: 'Boring', right: 'Exciting' }, clue: 'Roller coaster', target: 92 },
  { spectrum: { left: 'Boring', right: 'Exciting' }, clue: 'Grocery shopping', target: 20 },

  // Cheap ↔ Expensive
  { spectrum: { left: 'Cheap', right: 'Expensive' }, clue: 'Ramen noodles', target: 4 },
  { spectrum: { left: 'Cheap', right: 'Expensive' }, clue: 'Yacht', target: 98 },
  { spectrum: { left: 'Cheap', right: 'Expensive' }, clue: 'Rolex watch', target: 92 },
  { spectrum: { left: 'Cheap', right: 'Expensive' }, clue: 'Fast food burger', target: 12 },
  { spectrum: { left: 'Cheap', right: 'Expensive' }, clue: 'Designer handbag', target: 80 },

  // Common ↔ Rare
  { spectrum: { left: 'Common', right: 'Rare' }, clue: 'Grains of sand', target: 1 },
  { spectrum: { left: 'Common', right: 'Rare' }, clue: 'Four-leaf clover', target: 85 },
  { spectrum: { left: 'Common', right: 'Rare' }, clue: 'Blue lobster', target: 95 },
  { spectrum: { left: 'Common', right: 'Rare' }, clue: 'Pigeon', target: 5 },
  { spectrum: { left: 'Common', right: 'Rare' }, clue: 'Solar eclipse', target: 78 },

  // Safe ↔ Dangerous
  { spectrum: { left: 'Safe', right: 'Dangerous' }, clue: 'Teddy bear', target: 2 },
  { spectrum: { left: 'Safe', right: 'Dangerous' }, clue: 'Juggling chainsaws', target: 97 },
  { spectrum: { left: 'Safe', right: 'Dangerous' }, clue: 'Pet tiger', target: 88 },
  { spectrum: { left: 'Safe', right: 'Dangerous' }, clue: 'Pillow fort', target: 5 },
  { spectrum: { left: 'Safe', right: 'Dangerous' }, clue: 'Jaywalking', target: 45 },

  // Quiet ↔ Loud
  { spectrum: { left: 'Quiet', right: 'Loud' }, clue: 'Library whisper', target: 5 },
  { spectrum: { left: 'Quiet', right: 'Loud' }, clue: 'Rock concert', target: 95 },
  { spectrum: { left: 'Quiet', right: 'Loud' }, clue: 'Thunder clap', target: 90 },
  { spectrum: { left: 'Quiet', right: 'Loud' }, clue: 'Snow falling', target: 2 },
  { spectrum: { left: 'Quiet', right: 'Loud' }, clue: 'Lawn mower', target: 70 },

  // Weak ↔ Strong
  { spectrum: { left: 'Weak', right: 'Strong' }, clue: 'Wet paper', target: 2 },
  { spectrum: { left: 'Weak', right: 'Strong' }, clue: 'Superhero', target: 98 },
  { spectrum: { left: 'Weak', right: 'Strong' }, clue: 'Ox', target: 90 },
  { spectrum: { left: 'Weak', right: 'Strong' }, clue: 'Kleenex', target: 4 },

  // Slow ↔ Fast
  { spectrum: { left: 'Slow', right: 'Fast' }, clue: 'Sloth', target: 2 },
  { spectrum: { left: 'Slow', right: 'Fast' }, clue: 'Rocket', target: 100 },
  { spectrum: { left: 'Slow', right: 'Fast' }, clue: 'Cheetah', target: 95 },
  { spectrum: { left: 'Slow', right: 'Fast' }, clue: 'Snail', target: 1 },
  { spectrum: { left: 'Slow', right: 'Fast' }, clue: 'City bus', target: 45 },

  // Small ↔ Big
  { spectrum: { left: 'Small', right: 'Big' }, clue: 'Atom', target: 0 },
  { spectrum: { left: 'Small', right: 'Big' }, clue: 'Blue whale', target: 92 },
  { spectrum: { left: 'Small', right: 'Big' }, clue: 'Galaxy', target: 100 },
  { spectrum: { left: 'Small', right: 'Big' }, clue: 'Ant', target: 3 },
  { spectrum: { left: 'Small', right: 'Big' }, clue: 'House', target: 60 },

  // Fake ↔ Real
  { spectrum: { left: 'Fake', right: 'Real' }, clue: 'Unicorn', target: 2 },
  { spectrum: { left: 'Fake', right: 'Real' }, clue: 'Taxes', target: 100 },
  { spectrum: { left: 'Fake', right: 'Real' }, clue: 'Santa Claus', target: 5 },
  { spectrum: { left: 'Fake', right: 'Real' }, clue: 'Reality TV', target: 25 },

  // Useless ↔ Useful
  { spectrum: { left: 'Useless', right: 'Useful' }, clue: 'Chocolate teapot', target: 2 },
  { spectrum: { left: 'Useless', right: 'Useful' }, clue: 'Swiss army knife', target: 95 },
  { spectrum: { left: 'Useless', right: 'Useful' }, clue: 'Duct tape', target: 92 },
  { spectrum: { left: 'Useless', right: 'Useful' }, clue: 'Decorative pillow', target: 25 },
  { spectrum: { left: 'Useless', right: 'Useful' }, clue: 'Smartphone', target: 90 },

  // Healthy ↔ Unhealthy
  { spectrum: { left: 'Healthy', right: 'Unhealthy' }, clue: 'Kale salad', target: 3 },
  { spectrum: { left: 'Healthy', right: 'Unhealthy' }, clue: 'Deep-fried butter', target: 98 },
  { spectrum: { left: 'Healthy', right: 'Unhealthy' }, clue: 'Cigarette', target: 95 },
  { spectrum: { left: 'Healthy', right: 'Unhealthy' }, clue: 'Jogging', target: 2 },
  { spectrum: { left: 'Healthy', right: 'Unhealthy' }, clue: 'Glazed donut', target: 80 },

  // Cute ↔ Scary
  { spectrum: { left: 'Cute', right: 'Scary' }, clue: 'Puppy', target: 2 },
  { spectrum: { left: 'Cute', right: 'Scary' }, clue: 'Clown in a basement', target: 96 },
  { spectrum: { left: 'Cute', right: 'Scary' }, clue: 'Kitten', target: 3 },
  { spectrum: { left: 'Cute', right: 'Scary' }, clue: 'Ghost at midnight', target: 90 },
  { spectrum: { left: 'Cute', right: 'Scary' }, clue: 'Tarantula', target: 85 },

  // Modern ↔ Ancient
  { spectrum: { left: 'Modern', right: 'Ancient' }, clue: 'Smartphone', target: 2 },
  { spectrum: { left: 'Modern', right: 'Ancient' }, clue: 'Pyramids of Giza', target: 98 },
  { spectrum: { left: 'Modern', right: 'Ancient' }, clue: 'TikTok', target: 0 },
  { spectrum: { left: 'Modern', right: 'Ancient' }, clue: 'Shakespeare', target: 70 },
  { spectrum: { left: 'Modern', right: 'Ancient' }, clue: 'Cassette tape', target: 35 },

  // Bland ↔ Spicy
  { spectrum: { left: 'Bland', right: 'Spicy' }, clue: 'Plain rice', target: 3 },
  { spectrum: { left: 'Bland', right: 'Spicy' }, clue: 'Ghost pepper', target: 100 },
  { spectrum: { left: 'Bland', right: 'Spicy' }, clue: 'Buffalo wings', target: 75 },
  { spectrum: { left: 'Bland', right: 'Spicy' }, clue: 'Vanilla ice cream', target: 2 },
  { spectrum: { left: 'Bland', right: 'Spicy' }, clue: 'Black pepper', target: 35 },

  // Sad ↔ Happy
  { spectrum: { left: 'Sad', right: 'Happy' }, clue: 'Funeral', target: 3 },
  { spectrum: { left: 'Sad', right: 'Happy' }, clue: 'Wedding day', target: 95 },
  { spectrum: { left: 'Sad', right: 'Happy' }, clue: 'Winning the lottery', target: 100 },
  { spectrum: { left: 'Sad', right: 'Happy' }, clue: 'Rainy Monday', target: 20 },
  { spectrum: { left: 'Sad', right: 'Happy' }, clue: 'Puppy cuddle', target: 92 },

  // Lazy ↔ Hardworking
  { spectrum: { left: 'Lazy', right: 'Hardworking' }, clue: 'Couch potato', target: 3 },
  { spectrum: { left: 'Lazy', right: 'Hardworking' }, clue: 'Olympic athlete', target: 96 },
  { spectrum: { left: 'Lazy', right: 'Hardworking' }, clue: 'Worker ant', target: 90 },
  { spectrum: { left: 'Lazy', right: 'Hardworking' }, clue: 'Weekend nap', target: 8 },
]

/** Number of rounds in a full game. */
export const ROUNDS_PER_GAME = 10

/** Distance thresholds for scoring (absolute difference on the 0-100 scale). */
export const BULLSEYE_RADIUS = 3
export const CLOSE_RADIUS = 7
export const MEDIUM_RADIUS = 12

/** Points awarded per scoring band. */
export const BULLSEYE_POINTS = 4
export const CLOSE_POINTS = 3
export const MEDIUM_POINTS = 2
export const MISS_POINTS = 0

/** Maximum score a single round can award. */
export const MAX_POINTS_PER_ROUND = BULLSEYE_POINTS

/**
 * Score a guess against a target position on the spectrum.
 * Returns 0-4 points based on absolute distance.
 */
export function scoreGuess(guess: number, target: number): number {
  const distance = Math.abs(guess - target)
  if (distance <= BULLSEYE_RADIUS) return BULLSEYE_POINTS
  if (distance <= CLOSE_RADIUS) return CLOSE_POINTS
  if (distance <= MEDIUM_RADIUS) return MEDIUM_POINTS
  return MISS_POINTS
}

/** Absolute distance between a guess and the target. */
export function distanceFromTarget(guess: number, target: number): number {
  return Math.abs(guess - target)
}

/** Fisher-Yates shuffle. Pass a custom `random` for deterministic tests. */
export function shufflePuzzles(puzzles: Puzzle[], random: () => number = Math.random): Puzzle[] {
  const arr = [...puzzles]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Pick `count` puzzles for a new game, ensuring no two puzzles share the same
 * spectrum so each round feels different.
 */
export function pickRoundPuzzles(
  puzzles: Puzzle[],
  count: number,
  random: () => number = Math.random
): Puzzle[] {
  const shuffled = shufflePuzzles(puzzles, random)
  const picked: Puzzle[] = []
  const usedSpectra = new Set<string>()
  for (const puzzle of shuffled) {
    const key = `${puzzle.spectrum.left}|${puzzle.spectrum.right}`
    if (usedSpectra.has(key)) continue
    usedSpectra.add(key)
    picked.push(puzzle)
    if (picked.length >= count) break
  }
  // If we somehow run out of unique spectra, top up with any remaining puzzles.
  if (picked.length < count) {
    for (const puzzle of shuffled) {
      if (picked.length >= count) break
      if (!picked.includes(puzzle)) picked.push(puzzle)
    }
  }
  return picked
}

/** Maximum possible score for a game of N rounds. */
export function maxPossibleScore(rounds: number): number {
  return rounds * MAX_POINTS_PER_ROUND
}

/** Classify a final score into a themed rating string. */
export function getRating(score: number, rounds: number): string {
  const ratio = score / maxPossibleScore(rounds)
  if (ratio >= 0.9) return 'Mind reader'
  if (ratio >= 0.75) return 'Telepathic'
  if (ratio >= 0.5) return 'Tuned in'
  if (ratio >= 0.25) return 'Fuzzy signal'
  return 'Static noise'
}
