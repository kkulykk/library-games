// @ts-check
const nextJest = require('next/jest.js')

const createJestConfig = nextJest({
  dir: './',
})

/** @type {import('jest').Config} */
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // P2-3: the gate previously measured only pure game logic. Extend it to the
  // security-relevant trust-boundary code (schemas, lib helpers, the shared room
  // hook) so those are counted too. `useGameRoom` is exercised largely via
  // Playwright rather than jest, so `src/hooks` carries a realistic per-path
  // floor (per-glob thresholds apply per file and subtract those files from the
  // strict `global` gate). Excluded from measurement: test-only infra
  // (lib/e2e), the Supabase client bootstrap (supabase.ts — env-gated, only
  // meaningfully exercised against a real/fake backend in e2e), and the
  // browser-API UI helpers (avatar.ts / clipboard.ts — covered by Playwright).
  collectCoverageFrom: [
    'src/games/**/logic.ts',
    'src/games/**/schema.ts',
    'src/lib/**/*.ts',
    'src/hooks/**/*.ts',
    '!src/lib/e2e/**',
    '!src/lib/supabase.ts',
    '!src/lib/avatar.ts',
    '!src/lib/clipboard.ts',
  ],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    'src/games/**/logic.ts': {
      lines: 80,
    },
    'src/hooks/**/*.ts': {
      lines: 65,
      functions: 70,
      branches: 60,
      statements: 65,
    },
    'src/lib/**/*.ts': {
      lines: 80,
      functions: 80,
      branches: 55,
      statements: 80,
    },
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
}

module.exports = createJestConfig(config)
