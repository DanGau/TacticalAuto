import type { Action } from '../core/apply'
import { FACILITIES, type FacilityId } from '../core/base'
import { zoneInfo } from '../core/battle'
import { randomInt } from '../core/rng'
import { buildCost, level, skillOffers, type Risk, type Run } from '../core/run'

/** Chooses the next action whenever the run waits for the player. `rng` is the bot's own, separate from the run's. */
export type Bot = (run: Run, rng: { rng: number }) => Action

const RARITY_ORDER = ['common', 'rare', 'epic']

/** Keeps a find at least as rare as what its finder has in the slot; sells it otherwise. */
function decideFind(run: Run): Action {
  const { soldier, gear } = run.finds[0]
  const old = run.soldiers.find((s) => s.id === soldier)!.gear[gear.slot]
  return RARITY_ORDER.indexOf(gear.rarity) >= RARITY_ORDER.indexOf(old?.rarity ?? '') ? { type: 'keep' } : { type: 'sell' }
}

/** The reward phase's next choice: a relic, then finds, then skills; `pick` chooses among offers. */
function reward(run: Run, pick: (count: number) => number): Action {
  if (run.relicOffers.length > 0) return { type: 'relic', index: pick(run.relicOffers.length) }
  if (run.finds.length > 0) return decideFind(run)
  const learner = run.soldiers.find((s) => skillOffers(s).length > 0)!
  return { type: 'skill', soldier: learner.id, index: pick(skillOffers(learner).length) }
}

/** Facilities the run can pay for now. */
const affordable = (run: Run) => (Object.keys(FACILITIES) as FacilityId[]).filter((id) => (buildCost(run, id) ?? Infinity) <= run.supplies)

/** Chooses every option at random; in the overworld, builds or moves on at a coin flip. Decides finds as decideFind says. */
const randomBot: Bot = (run, rng) => {
  if (run.phase === 'reward') return reward(run, (n) => randomInt(rng, n))
  if (run.phase === 'battle') return { type: 'land', zone: randomInt(rng, run.battle!.zones.length) }
  const options = affordable(run)
  if (options.length > 0 && randomInt(rng, 2) === 0) return { type: 'build', facility: options[randomInt(rng, options.length)] }
  return run.zone ? { type: 'advance' } : { type: 'zone', index: randomInt(rng, run.zones.length) }
}

/** What a planning bot builds first. */
const BUILD_ORDER: FacilityId[] = ['firingRange', 'workshop', 'optics', 'drills', 'academy', 'course']

/**
 * A bot that takes the first relic and skill offered, decides finds as decideFind says, builds the first facility in
 * BUILD_ORDER it can afford, at every fork takes the zone of the risk `risk` names, and lands in the most cover.
 */
const planner =
  (risk: (run: Run) => Risk): Bot =>
  (run) => {
    if (run.phase === 'reward') return reward(run, () => 0)
    if (run.phase === 'battle') {
      const zones = run.battle!.zones
      return { type: 'land', zone: zones.reduce((top, zone, index) => (zoneInfo(run.battle!, zone).cover > zoneInfo(run.battle!, zones[top]).cover ? index : top), 0) }
    }
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
