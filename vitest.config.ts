import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // These tests cover store logic, not persistence. With no DOM there is no
    // localStorage, so zustand's persist middleware degrades gracefully and says
    // so on every write. That degradation is correct; the log is just noise.
    onConsoleLog(log) {
      if (log.includes('[zustand persist middleware]')) return false;
    },
  },
});
