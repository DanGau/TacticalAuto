// The model's eyes and hands: drives the game in a headless browser that stays alive between calls.
// Usage: npm run -s eye -- <command> [args]. Prints one JSON object.
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'
import type { Debug } from '../src/main'
import { MAX_TICKS } from '../src/core/state'
import { HEIGHT, WIDTH } from '../src/view/view'
import viteConfig from '../vite.config'

declare const debug: Debug

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = resolve(APP, '.eye')
const PIDS = resolve(DIR, 'pids.json')
const VITE_PORT = viteConfig.server!.port!
const CDP_PORT = 9333
const URL = `http://localhost:${VITE_PORT}/`

const portOpen = (port: number) =>
  new Promise<boolean>((done) => {
    const socket = connect(port, 'localhost')
    socket.once('connect', () => (socket.destroy(), done(true)))
    socket.once('error', () => done(false))
  })

/** Starts `command` detached unless `port` already answers, then waits for the port. */
async function ensure(name: string, port: number, command: string, args: string[]): Promise<void> {
  if (await portOpen(port)) return
  const child = spawn(command, args, { cwd: APP, detached: true, stdio: 'ignore' })
  child.unref()
  const pids = existsSync(PIDS) ? JSON.parse(readFileSync(PIDS, 'utf8')) : {}
  writeFileSync(PIDS, JSON.stringify({ ...pids, [name]: child.pid }))
  for (let i = 0; i < 100; i++) {
    if (await portOpen(port)) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`${name} did not open port ${port}`)
}

function stop(): string[] {
  if (!existsSync(PIDS)) return []
  const pids: Record<string, number> = JSON.parse(readFileSync(PIDS, 'utf8'))
  for (const pid of Object.values(pids)) {
    try {
      process.kill(pid)
    } catch {
      // Already gone.
    }
  }
  rmSync(PIDS)
  return Object.keys(pids)
}

type Command = (page: Page, ...args: string[]) => Promise<unknown>

const commands: Record<string, Command> = {
  /** open [seed]: loads a new battle. */
  async open(page, seed = '0') {
    await page.goto(`${URL}?manual&seed=${seed}`)
    await page.waitForFunction(() => 'debug' in window)
    return page.evaluate(() => debug.snapshot())
  },
  snapshot: (page) => page.evaluate(() => debug.snapshot()),
  /** apply <action json> */
  apply: (page, action) => page.evaluate((a) => debug.apply(a), JSON.parse(action)),
  /** step [n] */
  step: (page, n = '1') => page.evaluate((n) => debug.step(n), Number(n)),
  /** step-until <expression over `state`> [max ticks] */
  'step-until': (page, expression, max = String(MAX_TICKS)) =>
    page.evaluate(
      ([expression, max]) => {
        const done = new Function('state', `return ${expression}`)
        let state = debug.snapshot()
        for (let i = 0; i < Number(max) && !done(state); i++) state = debug.step(1)
        return state
      },
      [expression, max],
    ),
  /** click <x> <y>: clicks a screen point, to test the UI itself. */
  async click(page, x, y) {
    await page.mouse.click(Number(x), Number(y))
    return page.evaluate(() => debug.snapshot())
  },
  /** screenshot <name>: saves a PNG and returns its path. */
  async screenshot(page, name) {
    const commit = execSync('git rev-parse --short HEAD', { cwd: APP, encoding: 'utf8' }).trim()
    const path = resolve(APP, 'screenshots', commit, `${name}.png`)
    await page.screenshot({ path })
    return path
  },
  /** play <file>: runs a playbook, a JSON array of [command, ...args]. */
  async play(page, file) {
    const results = []
    for (const [name, ...args] of JSON.parse(readFileSync(file, 'utf8')) as string[][]) {
      results.push(await run(page, name, args))
    }
    return results
  },
}

function run(page: Page, name: string, args: string[]): Promise<unknown> {
  const command = commands[name]
  if (!command) throw new Error(`unknown command "${name}"; choose from ${Object.keys(commands).join(', ')}, stop`)
  return command(page, ...args.map(String))
}

async function main(name: string, args: string[]): Promise<unknown> {
  if (name === 'stop') return stop()
  mkdirSync(DIR, { recursive: true })
  await ensure('vite', VITE_PORT, process.execPath, [resolve(APP, 'node_modules/vite/bin/vite.js')])
  await ensure('browser', CDP_PORT, chromium.executablePath(), [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${resolve(DIR, 'profile')}`,
    'about:blank',
  ])
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`)
  try {
    const page = browser.contexts()[0].pages()[0]
    await page.setViewportSize({ width: WIDTH, height: HEIGHT })
    return await run(page, name, args)
  } finally {
    await browser.close()
  }
}

const [name, ...args] = process.argv.slice(2)
try {
  console.log(JSON.stringify({ ok: true, result: await main(name, args) }))
  // The detached children keep handles open.
  process.exit(0)
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: String(error) }))
  process.exit(1)
}
