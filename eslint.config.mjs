import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import eslintConfigPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

const eslintConfig = defineConfig([
  globalIgnores(['next-env.d.ts', '.next/**', 'out/**', 'node_modules/**']),
  {
    extends: [...nextCoreWebVitals, eslintConfigPrettier],
  },
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])

export default eslintConfig
