// The model's eyes and hands: drives the game in a headless browser that stays alive between calls.
// Usage: npm run -s eye -- <command> [args]. Prints one JSON object.
import { execFileSync, execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'
import type { Debug } from '../src/main'
import { MAX_BEATS } from '../src/core/battle'
import { HEIGHT, WIDTH } from '../src/view/camera'
import viteConfig from '../vite.config'

declare const debug: Debug

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = resolve(APP, '.eye')
// One registry for every worktree, so they share one server and one browser.
const PIDS = resolve(tmpdir(), 'tactical-auto-eye.json')
const IDLE_MS = 30 * 60 * 1000
const VITE_PORT = viteConfig.server!.port!
const CDP_PORT = 9333
// Without these a window behind others stops drawing frames, and the battle the model is watching stalls.
const KEEP_ANIMATING = ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
const URL = `http://localhost:${VITE_PORT}/`

const portOpen = (port: number) =>
  new Promise<boolean>((done) => {
    const socket = connect(port, 'localhost')
    socket.once('connect', () => (socket.destroy(), done(true)))
    socket.once('error', () => done(false))
  })

/** A process eye started, the checkout it serves, and when eye last used it. */
type Owned = { pid: number; app: string; used: number }

const readPids = (): Record<string, Owned> => (existsSync(PIDS) ? JSON.parse(readFileSync(PIDS, 'utf8')) : {})

/** Kills `owned` and its children, unless its pid has since gone to a process that is not from its checkout. */
function kill({ pid, app }: Owned): void {
  try {
    const line = execFileSync('powershell', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`], { encoding: 'utf8' })
    if (line.includes(app)) execFileSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' })
  } catch {
    // Already gone.
  }
}

async function portClosed(port: number): Promise<void> {
  while (await portOpen(port)) await new Promise((r) => setTimeout(r, 100))
}

/**
 * Keeps one `name` on the machine, for every checkout: one left idle IDLE_MS or serving another checkout is killed
 * first, unless a human's window is open on that other checkout. Starts `command` detached unless `port` answers.
 */
async function ensure(name: string, port: number, command: string, args: string[]): Promise<void> {
  const pids = readPids()
  const held = pids[name]
  // A window its human closed no longer answers.
  if (pids.window && !(await portOpen(CDP_PORT))) delete pids.window
  if (pids.window && pids.window.app !== APP) throw new Error(`a human is playing from ${pids.window.app}; wait for them, or run eye there`)
  if (held && (held.app !== APP || (!pids.window && Date.now() - held.used > IDLE_MS))) {
    kill(held)
    delete pids[name]
    await portClosed(port)
  }
  if (await portOpen(port)) {
    if (pids[name]) pids[name].used = Date.now()
    writeFileSync(PIDS, JSON.stringify(pids))
    return
  }
  const child = spawn(command, args, { cwd: APP, detached: true, stdio: 'ignore' })
  child.unref()
  writeFileSync(PIDS, JSON.stringify({ ...pids, [name]: { pid: child.pid!, app: APP, used: Date.now() } }))
  for (let i = 0; i < 100; i++) {
    if (await portOpen(port)) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`${name} did not open port ${port}`)
}

/** Kills the named processes eye started and returns the names it knew. */
function stop(names: string[]): string[] {
  const pids = readPids()
  const known = names.filter((name) => name in pids)
  for (const name of known) {
    kill(pids[name])
    delete pids[name]
  }
  writeFileSync(PIDS, JSON.stringify(pids))
  return known
}

/** Starts a browser eye can attach to: headless for the model alone, or a window for a human. */
function ensureBrowser(name: 'browser' | 'window', args: string[]): Promise<void> {
  return ensure(name, CDP_PORT, chromium.executablePath(), [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${resolve(DIR, 'profile')}`,
    ...args,
  ])
}

type Command = (page: Page, ...args: string[]) => Promise<unknown>

const commands: Record<string, Command> = {
  /** open [seed]: loads a new run, at its choice of recruit. */
  async open(page, seed = '0') {
    await page.goto(`${URL}?manual&seed=${seed}`)
    await page.waitForFunction(() => 'debug' in window)
    return page.evaluate(() => debug.snapshot())
  },
  snapshot: (page) => page.evaluate(() => debug.snapshot()),
  /** apply <action json> */
  apply: (page, action) => page.evaluate((a) => debug.apply(a), JSON.parse(action)),
  /** edit <js over `state`>: changes the live run, to set up a scene. */
  edit: (page, code) => page.evaluate((c) => debug.edit(c), code),
  /** step [n] */
  step: (page, n = '1') => page.evaluate((n) => debug.step(n), Number(n)),
  /** step-until <expression over `state`> [max beats] */
  'step-until': (page, expression, max = String(MAX_BEATS)) =>
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
  /** tap <selector>: clicks the first element matching, as a player's tap. */
  async tap(page, selector) {
    await page.locator(selector).first().click({ force: true })
  },
  /** viewport <w> <h>: resizes the page for the rest of a playbook, to see phone widths. */
  viewport: (page, w, h) => page.setViewportSize({ width: Number(w), height: Number(h) }),
  /** hover <x> <y>: moves the mouse to a screen point. */
  async hover(page, x, y) {
    await page.mouse.move(Number(x), Number(y))
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
  if (!command) throw new Error(`unknown command "${name}"; choose from ${Object.keys(commands).join(', ')}, launch, stop`)
  return command(page, ...args.map(String))
}

async function main(name: string, args: string[]): Promise<unknown> {
  mkdirSync(DIR, { recursive: true })
  if (name === 'stop') return stop(['vite', 'browser', 'window'])
  await ensure('vite', VITE_PORT, process.execPath, [resolve(APP, 'node_modules/vite/bin/vite.js')])
  if (name === 'launch') {
    // launch [seed]: opens a window for a human to play in real time; later commands attach to it.
    stop(['browser', 'window'])
    await portClosed(CDP_PORT)
    await ensureBrowser('window', [`--app=${URL}${args[0] ? `?seed=${args[0]}` : ''}`, `--window-size=${WIDTH},${HEIGHT + 80}`, ...KEEP_ANIMATING])
    return 'window open'
  }
  await ensureBrowser('browser', ['--headless=new', 'about:blank'])
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`)
  try {
    const page = browser.contexts()[0].pages()[0]
    // A human's window keeps its own size.
    if (!('window' in readPids())) await page.setViewportSize({ width: WIDTH, height: HEIGHT })
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
