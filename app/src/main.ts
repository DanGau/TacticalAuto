import { apply, type Action, type Result } from './core/apply'
import { createState, TICK_MS, type State } from './core/state'
import { step, type GameEvent } from './core/step'
import { createUi } from './ui/ui'
import { createView } from './view/view'

export interface Debug {
  snapshot(): State
  apply(action: Action): Result
  /** Advances n ticks, renders, and returns the state. */
  step(n: number): State
}

declare global {
  interface Window {
    debug: Debug
  }
}

const params = new URLSearchParams(location.search)
const state = createState(params.has('seed') ? Number(params.get('seed')) : Date.now() | 0)

const view = await createView()
document.body.prepend(view.canvas)

function act(action: Action): Result {
  const result = apply(state, action)
  show([])
  return result
}

const ui = createUi(view.canvas, act)

function show(events: GameEvent[]): void {
  view.render(state, events)
  ui.update(state)
}

function advance(n: number): void {
  let events: GameEvent[] = []
  for (let i = 0; i < n; i++) events = step(state)
  show(events)
}

window.debug = {
  snapshot: () => structuredClone(state),
  apply: act,
  step(n) {
    advance(n)
    return structuredClone(state)
  },
}

show([])

// With ?manual, time advances only through debug.step, so the model sees every tick it asks for.
if (!params.has('manual')) {
  let last = performance.now()
  let owed = 0
  const frame = (now: number) => {
    owed += now - last
    last = now
    const ticks = Math.floor(owed / TICK_MS)
    owed -= ticks * TICK_MS
    if (ticks > 0 && state.phase === 'battle') advance(ticks)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
