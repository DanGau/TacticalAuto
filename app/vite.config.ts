/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative paths, so the build runs from GitHub Pages' /TacticalAuto/ subpath.
  base: './',
  server: { port: 5190, strictPort: true },
  // Map tests lay whole 96-tile towns; they run slow on a busy machine.
  test: { testTimeout: 30000 },
})
