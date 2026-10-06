import type { Action } from '../core/apply'
import { AID, FACILITIES, type FacilityId } from '../core/base'
import { zoneInfo } from '../core/battle'
import { randomInt } from '../core/rng'
import { buildCost, holder, rank, type Run } from '../core/run'

/** Chooses the next action whenever the run waits for the player. `rng` is the bot's own, separate from the run's. */
export type Bot = (run: Run, rng: { rng: number }) => Action

/** Facilities the run can pay for now. */
const affordable = (run: Run) => (Object.keys(FACILITIES) as FacilityId[]).filter((id) => (buildCost(run, id) ?? Infinity) <= run.supplies)

const RARITY_ORDER = ['common', 'rare', 'epic']

/**
 * Equips one piece of gear from the stash: the rarest, to the highest-ranked soldier whose slot for it is empty
 * or holds something less rare. Null when no such move is left.
 */
function equipBest(run: Run): Action | null {
  const value = (id: number | null) => RARITY_ORDER.indexOf(run.gear.find((g) => g.id === id)?.rarity ?? '')
  const stash = run.gear.filter((gear) => !holder(run, gear)).sort((a, b) => value(b.id) - value(a.id))
  const soldiers = [...run.soldiers].sort((a, b) => rank(b) - rank(a))
  for (const gear of stash) {
    const soldier = soldiers.find((s) => value(s.gear[gear.slot]) < value(gear.id))
    if (soldier) return { type: 'equip', soldier: soldier.id, gear: gear.id }
  }
  return null
}

/** Chooses every option at random; at the base, builds or leaves for a mission on a coin flip. Equips as equipBest says. */
const randomBot: Bot = (run, rng) => {
  if (run.phase === 'map') {
    const equip = equipBest(run)
    if (equip) return equip
    const options = affordable(run)
    if (options.length > 0 && randomInt(rng, 2) === 0) return { type: 'build', facility: options[randomInt(rng, options.length)] }
    return { type: 'mission', index: randomInt(rng, run.missions.length) }
  }
  if (run.phase === 'reward') return { type: 'pick', index: randomInt(rng, run.offers.length) }
  return { type: 'land', zone: randomInt(rng, run.battle!.zones.length) }
}

/** What the heuristic bot builds first. */
const BUILD_ORDER: FacilityId[] = ['barracks', 'firingRange', 'workshop', 'optics', 'drills', 'academy', 'course']

/** Equips as equipBest says, builds the first facility in BUILD_ORDER it can afford, answers the strike in the most threatened region, lands in the most cover, and takes the rarest aid. */
const heuristicBot: Bot = (run) => {
  const best = <T>(options: T[], value: (option: T) => number) =>
    options.reduce((top, option, index) => (value(option) > value(options[top]) ? index : top), 0)
  if (run.phase === 'map') {
    const equip = equipBest(run)
    if (equip) return equip
    const facility = BUILD_ORDER.find((id) => affordable(run).includes(id))
    if (facility) return { type: 'build', facility }
    return { type: 'mission', index: best(run.missions, (m) => run.threat[m.region] ?? 0) }
  }
  if (run.phase === 'reward') return { type: 'pick', index: best(run.offers, (id) => RARITY_ORDER.indexOf(AID[id].rarity)) }
  const battle = run.battle!
  return { type: 'land', zone: best(battle.zones, (zone) => zoneInfo(battle, zone).cover) }
}

export const bots: Record<string, Bot> = { random: randomBot, heuristic: heuristicBot }
