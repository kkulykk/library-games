export type GameStatus = 'live' | 'coming-soon'
export type GameCategory = 'single-player' | 'online-multiplayer'

export interface GameMeta {
  slug: string
  title: string
  description: string
  tags: string[]
  status: GameStatus
  category: GameCategory
  emoji: string
}

export const games: GameMeta[] = [
  {
    slug: 'wordle',
    title: 'Wordle',
    description:
      'Guess the 5-letter word in 6 tries. Green means right spot, yellow means wrong spot.',
    tags: ['puzzle', 'word'],
    status: 'live',
    category: 'single-player',
    emoji: '🟩',
  },
  {
    slug: 'minesweeper',
    title: 'Minesweeper',
    description: 'Clear the minefield without triggering any mines. Classic puzzle action.',
    tags: ['puzzle', 'classic'],
    status: 'live',
    category: 'single-player',
    emoji: '💣',
  },
  {
    slug: '2048',
    title: '2048',
    description: 'Slide tiles to combine them and reach the 2048 tile.',
    tags: ['puzzle', 'numbers'],
    status: 'live',
    category: 'single-player',
    emoji: '🔢',
  },
  {
    slug: 'sudoku',
    title: 'Sudoku',
    description: 'Fill the 9×9 grid so every row, column, and box has digits 1–9.',
    tags: ['puzzle', 'numbers'],
    status: 'live',
    category: 'single-player',
    emoji: '🔲',
  },
  {
    slug: 'memory',
    title: 'Memory Pairs',
    description: 'Flip cards to find matching pairs. Train your memory!',
    tags: ['puzzle', 'memory'],
    status: 'live',
    category: 'single-player',
    emoji: '🃏',
  },
  {
    slug: 'snake',
    title: 'Snake',
    description: 'Guide the snake to eat food and grow longer without hitting walls.',
    tags: ['arcade', 'classic'],
    status: 'live',
    category: 'single-player',
    emoji: '🐍',
  },
  {
    slug: 'tetris',
    title: 'Tetris',
    description: 'Arrange falling tetrominoes to clear lines and score points.',
    tags: ['arcade', 'classic'],
    status: 'live',
    category: 'single-player',
    emoji: '🧱',
  },
  {
    slug: 'breakout',
    title: 'Breakout',
    description: 'Bounce the ball with your paddle to break all the bricks.',
    tags: ['arcade', 'classic'],
    status: 'live',
    category: 'single-player',
    emoji: '🏓',
  },
  {
    slug: 'skribbl',
    title: 'Skribbl',
    description: 'Draw and guess with friends online. Pictionary-style fun for everyone.',
    tags: ['multiplayer', 'drawing'],
    status: 'coming-soon',
    category: 'online-multiplayer',
    emoji: '🎨',
  },
  {
    slug: 'uno',
    title: 'Uno',
    description: 'Play the classic card game with friends. Be the first to empty your hand!',
    tags: ['multiplayer', 'cards'],
    status: 'coming-soon',
    category: 'online-multiplayer',
    emoji: '🎴',
  },
  {
    slug: 'chess',
    title: 'Chess',
    description: 'The timeless strategy game. Play local or challenge friends online.',
    tags: ['multiplayer', 'strategy'],
    status: 'coming-soon',
    category: 'online-multiplayer',
    emoji: '♟️',
  },
]
