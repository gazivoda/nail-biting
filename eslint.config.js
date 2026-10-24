import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import localI18n from './scripts/i18n/no-hardcoded-text.mjs'

// Persistent browser storage is reached through src/storage/ and nowhere else
// (docs/agents/ARCHITECTURE.md, "Storage module"). The files below touched
// localStorage before that module existed; their keys are part of the
// shipped app, so they stay as they are. Do NOT add to this list: use
// `kv` / `events` / `localBlobs` from src/storage instead.
export const STORAGE_ALLOWLIST = [
  'src/contexts/AuthContext.tsx',          // sb_has_session flag, Electron nh_token
  'src/components/onboarding/OnboardingTour.tsx', // onboarding_v1_done
  'src/hooks/usePWAGuide.ts',              // pwa_guide_snoozed_until
  'src/hooks/usePWAInstall.ts',            // pwa_install_dismissed
];

const STORAGE_GLOBALS = ['localStorage', 'sessionStorage', 'indexedDB'];
const STORAGE_MESSAGE =
  'Do not touch browser storage directly. Use src/storage (kv, events, settings, localBlobs); see docs/agents/ARCHITECTURE.md.';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // New code must not call localStorage / sessionStorage / indexedDB itself.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/storage/**', ...STORAGE_ALLOWLIST],
    rules: {
      'no-restricted-globals': ['error', ...STORAGE_GLOBALS.map(name => ({ name, message: STORAGE_MESSAGE }))],
      'no-restricted-properties': ['error',
        ...['window', 'globalThis', 'self'].flatMap(object =>
          STORAGE_GLOBALS.map(property => ({ object, property, message: STORAGE_MESSAGE }))),
      ],
    },
  },
  {
    // WS12a: no English in the code of the app. scripts/i18n/scope.mjs lists every
    // exemption (marketing pages, legal text, blog data...) with its reason; a file
    // that is not listed there is checked. Strings go through t() from src/i18n.
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'local-i18n': localI18n },
    rules: {
      'local-i18n/no-hardcoded-text': 'error',
      'local-i18n/no-english-literals': 'error',
    },
  },
])
