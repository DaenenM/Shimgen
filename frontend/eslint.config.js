import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'coverage']),

  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],

    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },

    rules: {
      // Components and constants are PascalCase / SCREAMING_CASE, and flagging
      // an unused one is almost always a false positive on an import kept for
      // a JSX tag the linter cannot see used.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      // console.log left in a component ships to users; warn and error are
      // deliberate and stay.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Enforces the import grouping used throughout: node/external, then
      // internal aliases, then relative — each block alphabetised.
      'sort-imports': ['warn', { ignoreDeclarationSort: true }],
    },
  },

  {
    // Test files run in node-ish globals and legitimately use console.
    files: ['**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-console': 'off' },
  },
])
