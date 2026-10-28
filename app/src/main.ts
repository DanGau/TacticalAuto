import { apply, type Action, type Result } from './core/apply'
import type { GameEvent } from './core/combat'
import { createRun, type Run } from './core/run'
import { step } from './core/step'
import { brief } from './ui/briefing'
import { introduce, newcomers } from './ui/intro'
import { createUi } from './ui/ui'
import { createView } from './view/view'

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

/** While the squad is unseen, steps beats of moves until the turn comes back round, so the squad and the aliens move as one. */
function flow(): GameEvent[] {
  const battle = state.battle!
  const side = battle.turn
  const events: GameEvent[] = step(state)
  while (!events.some((e) => e.type !== 'move') && battle.phase === 'battle' && battle.concealed && battle.turn !== side) events.push(...step(state))
  return events
}

// With ?manual, the battle advances only through debug.step, so the model sees every beat it asks for.
if (!params.has('manual')) {
  for (;;) {
    await showing
    if (state.phase === 'battle' && state.battle?.phase === 'battle') {
      const events = state.battle.concealed ? flow() : step(state)
      await show(events, true)
      // The battle waits while the player meets each new kind of alien.
      for (const kind of newcomers(state.battle, events)) await introduce(kind)
    } else await new Promise(requestAnimationFrame)
  }
}
