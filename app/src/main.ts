import { apply, type Action, type Result } from './core/apply'
import { createState, type State } from './core/state'
import { step, type GameEvent } from './core/step'
import { createUi } from './ui/ui'
import { createView } from './view/view'

export interface Debug {
  snapshot(): State
  apply(action: Action): Result
  /** Advances n beats, shows the result without animation, and returns the state. */
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

async function show(events: GameEvent[], animate: boolean): Promise<void> {
  await view.show(state, events, animate)
  ui.update(state)
}

function act(action: Action): Result {
  const result = apply(state, action)
  void show([], false)
  return result
}

const ui = createUi(view.canvas, act)

window.debug = {
  snapshot: () => structuredClone(state),
  apply: act,
  step(n) {
    let events: GameEvent[] = []
    for (let i = 0; i < n; i++) events = step(state)
    void show(events, false)
    return structuredClone(state)
  },
}

await show([], false)

// With ?manual, the battle advances only through debug.step, so the model sees every beat it asks for.
if (!params.has('manual')) {
  for (;;) {
    if (state.phase === 'battle') await show(step(state), true)
    else await new Promise(requestAnimationFrame)
  }
}
