import { land } from './battle'
import { FACILITIES, type FacilityId } from './base'
import { SLOTS, type Slot } from './gear'
import { advance, build, buildCost, enterZone, equip, takeAid, type Run } from './run'

export type Action =
  /** Overworld: build the facility's next level. */
  | { type: 'build'; facility: FacilityId }
  /** Overworld: give the gear with id `gear` to the soldier with id `soldier`. */
  | { type: 'equip'; soldier: number; gear: number }
  /** Overworld: return what the soldier has in `slot` to the stash. */
  | { type: 'unequip'; soldier: number; slot: Slot }
  /** Overworld, at a fork: commit to the zone at `index` of run.zones. */
  | { type: 'zone'; index: number }
  /** Overworld, in a zone: travel to the next stop. */
  | { type: 'advance' }
  /** Deploy phase: land the squad on the zone at `zone` of battle.zones and begin the battle. */
  | { type: 'land'; zone: number }
  /** Reward phase: take the aid at `index` of run.offers. */
  | { type: 'pick'; index: number }

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
  if (action.type === 'pick') {
    if (run.phase !== 'reward') return no('not choosing aid')
    const id = run.offers[action.index]
    if (!id) return no('no such aid')
    takeAid(run, id)
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
  if (action.type === 'advance') {
    if (!run.zone) return no('choose a zone first')
    advance(run)
    return ok
  }
  const soldier = run.soldiers.find((s) => s.id === action.soldier)
  if (!soldier) return no('no such soldier')
  if (action.type === 'unequip') {
    if (!SLOTS.includes(action.slot) || soldier.gear[action.slot] === null) return no('nothing equipped there')
    soldier.gear[action.slot] = null
    return ok
  }
  const gear = run.gear.find((g) => g.id === action.gear)
  if (!gear) return no('no such gear')
  if (soldier.gear[gear.slot] === gear.id) return no('already equipped')
  equip(run, soldier, gear)
  return ok
}
