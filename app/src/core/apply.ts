import { addUnit, blocked, DEPLOY_DEPTH, GRID, SQUAD, type State } from './state'

export type Action = { type: 'deploy'; x: number; y: number } | { type: 'start' }

export type Result = { ok: true } | { ok: false; reason: string }

const no = (reason: string): Result => ({ ok: false, reason })

/** The only way a player changes state. A rejected action leaves state untouched. */
export function apply(state: State, action: Action): Result {
  if (state.phase !== 'deploy') return no('battle already started')
  const humans = state.units.filter((u) => u.side === 'human').length
  if (action.type === 'start') {
    if (humans === 0) return no('deploy at least one unit')
    state.phase = 'battle'
    return { ok: true }
  }
  const { x, y } = action
  if (humans >= SQUAD) return no('squad is full')
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= GRID || y >= GRID) return no('off the grid')
  if (y < GRID - DEPLOY_DEPTH) return no('outside the deployment zone')
  if (blocked(state, x, y)) return no('tile blocked')
  addUnit(state, 'human', x, y)
  return { ok: true }
}
