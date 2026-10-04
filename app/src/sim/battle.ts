import type { Bot } from '../bots/bots'
import { apply, type Action } from '../core/apply'
import { createState, type Side, type State } from '../core/state'
import { step } from '../core/step'

export interface BattleResult {
  seed: number
  winner: Side | null
  beats: number
  /** With the seed, enough to replay the battle. */
  actions: Action[]
}

function finish(state: State): State {
  while (state.phase === 'battle') step(state)
  return state
}

/** The final state of the battle these inputs produce. */
export function replay(seed: number, actions: Action[]): State {
  const state = createState(seed)
  for (const action of actions) apply(state, action)
  return finish(state)
}

export function runBattle(seed: number, bot: Bot): BattleResult {
  const state = createState(seed)
  const rng = { rng: seed }
  const actions: Action[] = []
  while (state.phase === 'deploy') {
    const action = bot(state, rng)
    const result = apply(state, action)
    if (!result.ok) throw new Error(`bot action rejected: ${result.reason}`)
    actions.push(action)
  }
  finish(state)
  return { seed, winner: state.winner, beats: state.beat, actions }
}
