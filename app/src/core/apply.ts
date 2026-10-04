import { addUnit, blocked, DEPLOY_DEPTH, GRID } from './battle'
import { FACILITIES, type FacilityId } from './base'
import { build, buildCost, startMission, takeAid, type Run } from './run'

export type Action =
  /** Map phase: build the facility's next level. */
  | { type: 'build'; facility: FacilityId }
  /** Map phase: fight the mission at `index` of run.missions. */
  | { type: 'mission'; index: number }
  /** Deploy phase: place the next soldier in reserve. */
  | { type: 'deploy'; x: number; y: number }
  /** Deploy phase: begin the battle. */
  | { type: 'start' }
  /** Reward phase: take the aid at `index` of run.offers. */
  | { type: 'pick'; index: number }

export type Result = { ok: true } | { ok: false; reason: string }

const ok: Result = { ok: true }
const no = (reason: string): Result => ({ ok: false, reason })

/** The only way a player changes state. A rejected action leaves state untouched. */
export function apply(run: Run, action: Action): Result {
  if (action.type === 'build') {
    if (run.phase !== 'map') return no('not at the base')
    if (!(action.facility in FACILITIES)) return no('no such facility')
    const cost = buildCost(run, action.facility)
    if (cost === null) return no('fully built')
    if (cost > run.supplies) return no('not enough supplies')
    build(run, action.facility)
    return ok
  }
  if (action.type === 'mission') {
    if (run.phase !== 'map') return no('not choosing a mission')
    const mission = run.missions[action.index]
    if (!mission) return no('no such mission')
    startMission(run, mission)
    return ok
  }
  if (action.type === 'pick') {
    if (run.phase !== 'reward') return no('not choosing aid')
    const id = run.offers[action.index]
    if (!id) return no('no such aid')
    takeAid(run, id)
    return ok
  }
  const battle = run.battle
  if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy') return no('not deploying')
  if (action.type === 'start') {
    if (!battle.units.some((u) => u.side === 'human')) return no('deploy at least one soldier')
    battle.phase = 'battle'
    return ok
  }
  const { x, y } = action
  const next = battle.reserve[0]
  if (!next) return no('squad is deployed')
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= GRID || y >= GRID) return no('off the grid')
  if (y < GRID - DEPLOY_DEPTH) return no('outside the deployment zone')
  if (blocked(battle, x, y)) return no('tile blocked')
  battle.reserve.shift()
  addUnit(battle, 'human', x, y, next.stats, next.soldier)
  return ok
}
