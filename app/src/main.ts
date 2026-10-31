// The browser entry: wires the run, view and UI, the battle loop, and window.debug.
import { apply, type Action, type Result } from './core/apply'
import type { GameEvent } from './core/combat-event'
import { createRun } from './core/run'
import { type Run } from './core/run-state'
import { step } from './core/step'
import { PACE } from './core/pace'
import { brief } from './ui/briefing'
import { introduce, newcomers } from './ui/intro'
import { createUi } from './ui/ui'
import { createView } from './view/view'
import { HEIGHT, WIDTH } from './view/camera'

// A failure shows on screen, where a player on a phone, with no console, can report it.
const report = (message: string) => document.getElementById('panel')!.insertAdjacentHTML('afterbegin', `<p class="up">${message}</p>`)
addEventListener('error', (e) => report(`Error: ${e.message}`))
addEventListener('unhandledrejection', (e) => report(`Error: ${String(e.reason)}`))

// The panels are laid out for a WIDTH by HEIGHT window and zoom with it; on a narrow, upright one, such as a phone's,
// they fit its width instead, laid out for a 600 pixel wide one.
const UPRIGHT_WIDTH = 600
const fit = () =>
  document.documentElement.style.setProperty('--ui', String(Math.max(Math.min(innerWidth / WIDTH, innerHeight / HEIGHT), Math.min(innerWidth / UPRIGHT_WIDTH, 1))))
addEventListener('resize', fit)
fit()
/** Fills the screen, on its side where the browser allows: the game is laid out wide. */
const enter = () =>
  document.documentElement
    .requestFullscreen()
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => {})
const toggle = document.getElementById('fullscreen')!
toggle.addEventListener('pointerdown', (e) => e.stopPropagation())
toggle.addEventListener('click', () => {
  // A browser opened inside another app, as a link from a chat often is, has no full screen.
  if (!document.fullscreenEnabled) report("this browser can't go full screen. Open the page in Chrome or Safari itself, then tap ⛶")
  else if (document.fullscreenElement) void document.exitFullscreen()
  else void enter()
})
// Browsers allow full screen only on a click, so the first one anywhere enters it.
addEventListener('pointerdown', () => void enter(), { once: true })

export interface Debug {
  snapshot(): Run
  apply(action: Action): Result
  /** Advances n beats, shows the result without animation, and returns the state. */
  step(n: number): Run
  /** Runs `code` with `state` bound to the live run, shows the result, and returns the state. */
  edit(code: string): Run
}

declare global {
  interface Window {
    debug: Debug
  }
}

const params = new URLSearchParams(location.search)
const state = createRun(params.has('seed') ? Number(params.get('seed')) : Date.now() | 0)

document.getElementById('panel')!.innerHTML = '<p>Loading…</p>'
const view = await createView()
document.body.prepend(view.canvas)

/** The battle last briefed, so each is briefed once, as its landing opens. */
let briefed: Run['battle'] = null

async function show(events: GameEvent[], animate: boolean): Promise<void> {
  await view.show(state, events, animate)
  ui.update(state)
  if (state.battle?.phase === 'deploy' && state.battle !== briefed && !params.has('manual')) {
    briefed = state.battle
    void brief(view, state.battle)
  }
}

/** What the view is showing outside the battle loop, which the loop waits for: the landing plays before the first beat. */
let showing = Promise.resolve()

function act(action: Action): Result {
  const result = apply(state, action)
  // The panels change at once, so the landing panel is gone before the pods fall.
  ui.update(state)
  showing = show([], action.type === 'land' && !params.has('manual'))
  return result
}

const ui = createUi(view, act)

window.debug = {
  snapshot: () => structuredClone(state),
  apply: act,
  step(n) {
    let events: GameEvent[] = []
    for (let i = 0; i < n; i++) events = step(state)
    void show(events, false)
    return structuredClone(state)
  },
  edit(code) {
    new Function('state', code)(state)
    void show([], false)
    return structuredClone(state)
  },
}

await show([], false)

// With ?manual, the battle advances only through debug.step, so the model sees every beat it asks for.
if (!params.has('manual')) {
  for (;;) {
    await showing
    if (state.phase === 'battle' && state.battle?.phase === 'battle') {
      const side = state.battle.turn
      const events = step(state)
      // A beat that passes the turn opens the new side's turn: the old side's attacks finish, then a breath.
      if (state.battle?.turn !== side) {
        await view.settle()
        ui.update(state)
        await new Promise((done) => setTimeout(done, PACE.turn))
      }
      await show(events, true)
      // The battle waits while the player meets each new kind of alien.
      for (const kind of newcomers(state.battle, events)) await introduce(kind)
    } else await new Promise(requestAnimationFrame)
  }
}
