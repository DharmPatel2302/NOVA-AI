import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // React 17+ does not require React to be in scope for JSX
      // Suppress unused React import warnings across all components
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^React$',   // ignore unused React import
        argsIgnorePattern: '^_',        // ignore unused args prefixed with _
        caughtErrorsIgnorePattern: '^_' // ignore unused catch vars prefixed with _
      }],
      // Relax react-refresh rule — allow non-component exports
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Allow setState in effects (common React pattern)
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
