import type { Action } from '../core/apply'
import { AID, FACILITIES, type FacilityId } from '../core/base'
import { zoneInfo } from '../core/battle'
import { randomInt } from '../core/rng'
import { buildCost, holder, level, type Risk, type Run } from '../core/run'

/** Chooses the next action whenever the run waits for the player. `rng` is the bot's own, separate from the run's. */
export type Bot = (run: Run, rng: { rng: number }) => Action

const RARITY_ORDER = ['common', 'rare', 'epic']

/**
 * Equips one piece of gear from the stash: the rarest, to the highest-ranked soldier whose slot for it is empty
 * or holds something less rare. Null when no such move is left.
 */
function equipBest(run: Run): Action | null {
  const value = (id: number | null) => RARITY_ORDER.indexOf(run.gear.find((g) => g.id === id)?.rarity ?? '')
  const stash = run.gear.filter((gear) => !holder(run, gear)).sort((a, b) => value(b.id) - value(a.id))
  const soldiers = [...run.soldiers].sort((a, b) => level(b) - level(a))
  for (const gear of stash) {
    const soldier = soldiers.find((s) => value(s.gear[gear.slot]) < value(gear.id))
    if (soldier) return { type: 'equip', soldier: soldier.id, gear: gear.id }
  }
  return null
}

/** Facilities the run can pay for now. */
const affordable = (run: Run) => (Object.keys(FACILITIES) as FacilityId[]).filter((id) => (buildCost(run, id) ?? Infinity) <= run.supplies)

/** Chooses every option at random; in the overworld, builds or moves on at a coin flip. Equips as equipBest says. */
const randomBot: Bot = (run, rng) => {
  if (run.phase === 'reward' && run.relicOffers.length > 0) return { type: 'relic', index: randomInt(rng, run.relicOffers.length) }
  if (run.phase === 'reward') return { type: 'pick', index: randomInt(rng, run.offers.length) }
  if (run.phase === 'battle') return { type: 'land', zone: randomInt(rng, run.battle!.zones.length) }
  const learner = run.soldiers.find((s) => s.offers.length > 0)
  if (learner) return { type: 'skill', soldier: learner.id, index: randomInt(rng, learner.offers.length) }
  const options = affordable(run)
  const gear = equipBest(run)
  if (gear) return gear
  if (options.length > 0 && randomInt(rng, 2) === 0) return { type: 'build', facility: options[randomInt(rng, options.length)] }
  return run.zone ? { type: 'advance' } : { type: 'zone', index: randomInt(rng, run.zones.length) }
}

/** What a planning bot builds first. */
const BUILD_ORDER: FacilityId[] = ['firingRange', 'workshop', 'optics', 'drills', 'academy', 'course']

/**
 * A bot that equips as equipBest says, builds the first facility in BUILD_ORDER it can afford, at every fork takes
 * the zone of the risk `risk` names, lands in the most cover, and takes the rarest aid.
 */
const planner =
  (risk: (run: Run) => Risk): Bot =>
  (run) => {
    const best = <T>(options: T[], value: (option: T) => number) =>
      options.reduce((top, option, index) => (value(option) > value(options[top]) ? index : top), 0)
    if (run.phase === 'reward' && run.relicOffers.length > 0) return { type: 'relic', index: 0 }
    if (run.phase === 'reward') return { type: 'pick', index: best(run.offers, (id) => RARITY_ORDER.indexOf(AID[id].rarity)) }
    if (run.phase === 'battle') return { type: 'land', zone: best(run.battle!.zones, (zone) => zoneInfo(run.battle!, zone).cover) }
    const learner = run.soldiers.find((s) => s.offers.length > 0)
    if (learner) return { type: 'skill', soldier: learner.id, index: 0 }
    const gear = equipBest(run)
    if (gear) return gear
    const facility = BUILD_ORDER.find((id) => affordable(run).includes(id))
    if (facility) return { type: 'build', facility }
    return run.zone ? { type: 'advance' } : { type: 'zone', index: run.zones.findIndex((zone) => zone.risk === risk(run)) }
  }

/** Takes quiet zones until the squad's mean level reaches 3, then overrun ones. */
const growing = (run: Run): Risk => (run.soldiers.reduce((sum, s) => sum + level(s), 0) / run.soldiers.length >= 3 ? 'dangerous' : 'safe')

export const bots: Record<string, Bot> = {
  random: randomBot,
  safe: planner(() => 'safe'),
  standard: planner(() => 'standard'),
  dangerous: planner(() => 'dangerous'),
  growing: planner(growing),
}
