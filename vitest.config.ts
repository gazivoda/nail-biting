import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Plain-TS and plain-JS tests only: there is no jsdom, so nothing here may
    // touch the DOM. Server code is ESM JavaScript under server/, build scripts
    // live under scripts/.
    include: [
      'src/**/*.test.{ts,tsx}',
      'server/**/*.test.{js,ts}',
      'scripts/**/*.test.{js,mjs,ts}',
      'shared/**/*.test.{js,ts}',
    ],
    // These tests cover store logic, not persistence. With no DOM there is no
    // localStorage, so the storage module falls back to an in-memory adapter.
    // Tests that care about persistence inject their own adapter
    // (test-utils/memoryStorage.ts); the zustand persist middleware's
    // "storage unavailable" warning is just noise here.
    onConsoleLog(log) {
      if (log.includes('[zustand persist middleware]')) return false;
    },
  },
});
