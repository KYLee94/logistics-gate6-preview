import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'qa-artifacts',
    'check_*.js',
    'clean_*.js',
    'debug*.js',
    'debug*.jsx',
    'fix_*.js',
    'force_*.js',
    'generate_*.js',
    'get_console*.js',
    'insert_*.js',
    'inspect_*.js',
    'patch_*.js',
    'replace-*.js',
    'scratch*.js',
    'sync_*.js',
    'temp*.js',
    'temp*.jsx',
    'test-*.js',
    'test_*.js',
    'vehicle_*.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // This app is not compiled with React Compiler. Keep the runtime Hooks
      // rules enabled, but do not rewrite established animation/state effects
      // solely to satisfy compiler-only recommendations.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // Several workspace modules intentionally co-locate React components and
      // shared runtime helpers. This only affects development hot reload.
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['test_puppeteer/**/*.js'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { sourceType: 'commonjs' },
    },
  },
])
