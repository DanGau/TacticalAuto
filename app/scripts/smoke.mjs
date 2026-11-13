// Builds the game and loads it in a headless browser: fails on a page error, a console error, or a screen with no text.
import { build, preview } from 'vite'
import { chromium } from 'playwright'

await build({ logLevel: 'error', build: { outDir: '.smoke' } })
const server = await preview({ preview: { port: 0 }, build: { outDir: '.smoke' }, logLevel: 'error' })
const browser = await chromium.launch()
const errors = []
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(server.resolvedUrls.local[0])
  await page.waitForFunction(() => document.body.innerText.trim().length > 20, null, { timeout: 15000 }).catch(() => errors.push('the first screen shows no text'))
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) {
  console.error(`smoke: ${errors.join('\n')}`)
  process.exit(1)
}
