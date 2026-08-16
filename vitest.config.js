import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // CONTRACT B1: a once-per-run teardown asserts the real ~/.kamishibai was
    // never written to. Per-file assertions run in separate workers and cannot
    // see a leak that happens in another file.
    globalSetup: ['./tests/global-setup.js'],
  },
})
