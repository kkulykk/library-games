# Coding Conventions

**Analysis Date:** 2026-06-12

## Naming Patterns

**Files:**

- Uppercase for game component files: `WordleGame.tsx`, `MinesweeperGame.tsx`
- Lowercase for logic and utility files: `logic.ts`, `utils.ts`, `hooks.ts`
- Lowercase with hyphens for directories: `src/games/cards-against-humanity/`

**Functions:**

- camelCase for all function names: `evaluateGuess()`, `mergeKeyboardStates()`, `isValidGuess()`
- Utility functions use verb prefixes: `get*()`, `is*()`, `create*()`, `check*()`
- Event handlers prefix with `on*()` or `handle*()`: `onClick`, `handleSubmit`

**Variables:**

- camelCase for all variables and constants: `WORD_LENGTH`, `MAX_GUESSES`, `currentGuess`, `keyStates`
- UPPERCASE for compile-time constants: `WORD_LENGTH = 5`, `TILE_COLORS`, `KEYBOARD_ROWS`
- Prefix boolean variables with `is*` or `has*`: `isWin`, `gameOver`, `hasWon`

**Types:**

- PascalCase for interfaces and type aliases: `GuessResult`, `TileState`, `GameState`, `Difficulty`
- Interface names use noun form, not `I` prefix: `GameMeta`, `Player` (not `IGameMeta`)
- Union types for state: `type TileState = 'correct' | 'present' | 'absent' | 'empty' | 'tbd'`

**React Components:**

- PascalCase for component names: `WordleGame`, `GameLayout`, `Tile`, `Key`
- Inline components within game files are lowercase helpers: `function Tile()`, `function Key()`
- Props interfaces suffixed with `Props`: `GameLayoutProps`

## Code Style

**Formatting:**

- Prettier 3 with config in `.prettierrc`
- Single quotes: `'use client'` not `"use client"`
- No semicolons: statements end without `;`
- Print width: 100 characters
- Trailing commas: ES5 style

**Linting:**

- ESLint 9 flat config in `eslint.config.mjs` (not `.eslintrc.json`)
- Rules configured in the flat config plugins section
- Unused vars flagged unless prefixed with `_`: `(_arg) => ...`
- `any` types generate warnings, not errors
- Run `pnpm lint:fix` to auto-format

**TypeScript:**

- Strict mode enabled in `tsconfig.json`
- Target: ES2017
- Module resolution: bundler
- JSX: react-jsx (no React import needed in files)

## Import Organization

**Order:**

1. Standard library imports (none in this project)
2. Third-party packages: `import { useState } from 'react'`, `import { cn } from 'clsx'`
3. Game logic imports: `import { evaluateGuess, type TileState } from './logic'`
4. Utilities and components: `import { cn } from '@/lib/utils'`
5. Data imports: `import { games } from '@/data/games'`, `import answersData from '@/data/words/wordle-answers.json'`

**Path Aliases:**

- `@/` maps to `src/` in `tsconfig.json`
- Use alias for all imports outside the same directory: `import { cn } from '@/lib/utils'`
- Import types separately: `import { type TileState, type GuessResult } from './logic'`

**Example from `WordleGame.tsx`:**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  evaluateGuess,
  mergeKeyboardStates,
  isWin,
  getDailyWord,
  isValidGuess,
  WORD_LIST,
  WORD_LENGTH,
  MAX_GUESSES,
  type TileState,
  type GuessResult,
} from './logic'
import { cn } from '@/lib/utils'
```

## Error Handling

**Patterns:**

- Return `null` or `undefined` for missing values: `normalizeInviteCode()` returns `string | null`
- Conditional checks for validity: `if (currentGuess.length !== WORD_LENGTH)` with user feedback
- Error messages shown to user via toast/message state: `showMessage('Not enough letters')`
- No throw statements in game logic (pure functions)

**In React Components:**

- State for error tracking: `const [errors, setErrors] = useState<Set<string>>(new Set())`
- Error boundaries wrap game components: `<ErrorBoundary>{children}</ErrorBoundary>`

## Logging

**Framework:** No structured logging; uses `console` if needed (minimal in this project)

**Patterns:**

- Game logic should be silent (no logs)
- React components log only for debugging, not production
- No logging to external services in static export build

## Comments

**When to Comment:**

- Function documentation: JSDoc-style comments for exported functions
- Complex algorithms: explain the intent (e.g., "First pass: mark correct letters" in Wordle evaluation)
- Tricky state logic: comment the edge case being handled
- Avoid redundant comments that restate the code

**JSDoc/TSDoc:**

- Use `/** */` block comments for exported functions and types
- Format: single line for simple functions, multi-line for complex logic
- Include parameter descriptions only for non-obvious parameters
- Example from `logic.ts`:

```typescript
/** Evaluate a guess against the answer, returning per-letter states. */
export function evaluateGuess(guess: string, answer: string): GuessResult[] { ... }

/** Pick a deterministic daily word from a word list (UTC-based so all timezones match) */
export function getDailyWord(wordList: string[]): string { ... }
```

## Function Design

**Size:**

- Keep game logic functions small and focused: typically < 50 lines
- Complex functions broken into helpers (e.g., `placeMines()` calls `calculateAdjacentMines()`)
- React components may be larger (100–300 lines) if state complexity requires it

**Parameters:**

- Pass immutable data structures; avoid mutating arguments
- Destructure props in function signature: `function Key({ label, state, onClick }: Props)`
- Use rest parameters minimally; prefer explicit parameters for clarity

**Return Values:**

- Game logic returns new state, never mutates input: `return { ...existing, [letter]: state }`
- React event handlers return `void`
- Utility functions return single values or objects, not tuples

## Module Design

**Exports:**

- Named exports for functions and types (no default exports except React components)
- Game components use default export: `export function WordleGame() { ... }`
- Types exported with `export type` keyword: `export type TileState = '...'`

**Barrel Files:**

- None used; imports are direct: `import { cn } from '@/lib/utils'` not `import { cn } from '@/lib'`
- Game registry in `src/data/games.ts` exports `games` array with `GameMeta` interface

**Example Structure from `src/games/wordle/`:**

```
logic.ts          # Pure functions, types, constants
logic.test.ts     # Jest tests
WordleGame.tsx    # 'use client' React component
```

---

_Convention analysis: 2026-06-12_
