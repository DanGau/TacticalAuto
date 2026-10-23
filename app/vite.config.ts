import { defineConfig } from 'vite'

export default defineConfig({
  // Relative paths, so the build runs from GitHub Pages' /TacticalAuto/ subpath.
  base: './',
  server: { port: 5190, strictPort: true },
})
