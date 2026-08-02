import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import eslintConfigPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

const eslintConfig = defineConfig([
  globalIgnores([
    'next-env.d.ts',
    '.next/**',
    'out/**',
    'node_modules/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
  ]),
  {
    extends: [...nextCoreWebVitals, eslintConfigPrettier],
  },
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // `error`, not `warn`: `pnpm lint` runs plain `eslint .` with no `--max-warnings`, so a
      // warning is invisible to CI. The codebase has zero violations — this locks that in.
      '@typescript-eslint/no-explicit-any': 'error',
      // On, and kept on. Where an effect legitimately sets state — reading an external store
      // after mount, or resetting local UI state when the round/room it belongs to changes —
      // suppress it at that line with a reason. A blanket `off` here buys nothing but costs
      // every future effect its render-loop check.
      'react-hooks/set-state-in-effect': 'error',
    },
  },
])

export default eslintConfig
