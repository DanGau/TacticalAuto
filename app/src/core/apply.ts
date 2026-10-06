import { land } from './battle'
import { FACILITIES, type FacilityId } from './base'
import { SLOTS, type Slot } from './gear'
import { build, buildCost, equip, startMission, takeAid, type Run } from './run'

export type Action =
  /** Map phase: build the facility's next level. */
  | { type: 'build'; facility: FacilityId }
  /** Map phase: give the gear with id `gear` to the soldier with id `soldier`. */
  | { type: 'equip'; soldier: number; gear: number }
  /** Map phase: return what the soldier has in `slot` to the stash. */
  | { type: 'unequip'; soldier: number; slot: Slot }
  /** Map phase: fight the mission at `index` of run.missions. */
  | { type: 'mission'; index: number }
  /** Deploy phase: land the squad on the zone at `zone` of battle.zones and begin the battle. */
  | { type: 'land'; zone: number }
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
  if (action.type === 'equip' || action.type === 'unequip') {
    if (run.phase !== 'map') return no('not at the base')
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
  if (run.phase !== 'battle' || !battle || battle.phase !== 'deploy') return no('not landing')
  const zone = battle.zones[action.zone]
  if (!zone) return no('no such landing zone')
  land(battle, zone)
  return ok
}
