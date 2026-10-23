import { land } from './battle'
import { FACILITIES, type FacilityId } from './base'
import { advance, build, buildCost, enterZone, keepFind, sellFind, skillOffers, takeRelic, takeSkill, type Run } from './run'

export type Action =
  /** Overworld: build the facility's next level. */
  | { type: 'build'; facility: FacilityId }
  /** Overworld, at a fork: commit to the zone at `index` of run.zones. */
  | { type: 'zone'; index: number }
  /** Overworld, in a zone: travel to the next stop. */
  | { type: 'advance' }
  /** Deploy phase: land the squad on the zone at `zone` of battle.zones and begin the battle. */
  | { type: 'land'; zone: number }
  /** Reward phase: take the relic at `index` of run.relicOffers. */
  | { type: 'relic'; index: number }
  /** Reward phase: equip the first of run.finds on the soldier who found it, selling what it replaces. */
  | { type: 'keep' }
  /** Reward phase: sell the first of run.finds. */
  | { type: 'sell' }
  /** Reward phase: the soldier with id `soldier` learns the skill at `index` of its offers. */
  | { type: 'skill'; soldier: number; index: number }

export type Result = { ok: true } | { ok: false; reason: string }

const ok: Result = { ok: true }
const no = (reason: string): Result => ({ ok: false, reason })

/** The only way a player changes state. A rejected action leaves state untouched. */
export function apply(run: Run, action: Action): Result {
  if (action.type === 'land') {
    const battle = run.battle
    if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy') return no('not landing')
    const zone = battle.zones[action.zone]
    if (!zone) return no('no such landing zone')
    land(battle, zone)
    return ok
  }
  if (action.type === 'relic' || action.type === 'keep' || action.type === 'sell' || action.type === 'skill') {
    if (run.phase !== 'reward') return no('nothing to choose')
    if (action.type === 'relic') {
      const id = run.relicOffers[action.index]
      if (!id) return no('no such relic')
      takeRelic(run, id)
    } else if (action.type === 'skill') {
      const soldier = run.soldiers.find((s) => s.id === action.soldier)
      if (!soldier || !skillOffers(soldier)[action.index]) return no('no such skill on offer')
      takeSkill(run, soldier, action.index)
    } else {
      if (run.finds.length === 0) return no('no gear found')
      if (action.type === 'keep') keepFind(run)
      else sellFind(run)
    }
    return ok
  }
  if (run.phase !== 'overworld') return no('not in the overworld')
  if (action.type === 'build') {
    if (!(action.facility in FACILITIES)) return no('no such facility')
    const cost = buildCost(run, action.facility)
    if (cost === null) return no('fully built')
    if (cost > run.supplies) return no('not enough supplies')
    build(run, action.facility)
    return ok
  }
  if (action.type === 'zone') {
    const zone = run.zones[action.index]
    if (!zone) return no('no such zone')
    enterZone(run, zone)
    return ok
  }
  if (!run.zone) return no('choose a zone first')
  advance(run)
  return ok
}
