import type { Action } from '../core/apply'
import { FACILITIES, type FacilityId } from '../core/base'
import { zoneInfo, type Battle } from '../core/battle'
import type { Keyword } from '../core/keywords'
import { RELICS } from '../core/relics'
import { randomInt } from '../core/rng'
import { SKILLS } from '../core/skills'
import { buildCost, level, skillOffers, squadKeywords, type Risk, type Run } from '../core/run'

/** Chooses the next action whenever the run waits for the player. `rng` is the bot's own, separate from the run's. */
export type Bot = (run: Run, rng: { rng: number }) => Action

const RARITY_ORDER = ['common', 'rare', 'epic']

/** Keeps a find at least as rare as what its finder has in the slot; sells it otherwise. */
function decideFind(run: Run): Action {
  const { soldier, gear } = run.finds[0]
  const old = run.soldiers.find((s) => s.id === soldier)!.gear[gear.slot]
  return RARITY_ORDER.indexOf(gear.rarity) >= RARITY_ORDER.indexOf(old?.rarity ?? '') ? { type: 'keep' } : { type: 'sell' }
}

/** Chooses among `count` offers, given each offer's keywords. */
type Pick = (run: Run, rng: { rng: number }, tags: Keyword[][]) => number

const PICKS = {
  first: () => 0,
  random: (_run, rng, tags) => randomInt(rng, tags.length),
  /** The offer sharing the most keywords with the squad's; with none held yet, the first that has any. */
  synergy: (run, _rng, tags) => {
    const held = squadKeywords(run)
    const score = (i: number) => 10 * tags[i].filter((tag) => held.includes(tag)).length + tags[i].length
    return tags.reduce((best, _, i) => (score(i) > score(best) ? i : best), 0)
  },
} satisfies Record<string, Pick>

/** The reward phase's next choice: a relic, then finds, then skills. */
function reward(run: Run, rng: { rng: number }, pick: Pick): Action {
  if (run.relicOffers.length > 0) return { type: 'relic', index: pick(run, rng, run.relicOffers.map((id) => RELICS[id].tags ?? [])) }
  if (run.finds.length > 0) return decideFind(run)
  const learner = run.soldiers.find((s) => skillOffers(s).length > 0)!
  return { type: 'skill', soldier: learner.id, index: pick(run, rng, skillOffers(learner).map((id) => SKILLS[id].tags ?? [])) }
}

/** Chooses a landing zone. */
type Land = (run: Run, battle: Battle, rng: { rng: number }) => number

const cover = (battle: Battle, i: number) => zoneInfo(battle, battle.zones[i]).cover
const best = (battle: Battle, score: (i: number) => number) => battle.zones.reduce((top, _, i) => (score(i) > score(top) ? i : top), 0)

const LANDS = {
  random: (_run, battle, rng) => randomInt(rng, battle.zones.length),
  /** The most cover. */
  cover: (_run, battle) => best(battle, (i) => cover(battle, i)),
  /** The least cover: a careless landing. */
  exposed: (_run, battle) => best(battle, (i) => -cover(battle, i)),
  /** The hot drop when offered, else the most cover. */
  hot: (_run, battle) => battle.hot ?? best(battle, (i) => cover(battle, i)),
  /** A boon the squad's build pays off on, then cover. */
  boon: (run, battle) => {
    const held = squadKeywords(run)
    return best(battle, (i) => (held.includes(battle.boons[i]) ? 100 : 0) + cover(battle, i))
  },
} satisfies Record<string, Land>

/** Facilities the run can pay for now. */
const affordable = (run: Run) => (Object.keys(FACILITIES) as FacilityId[]).filter((id) => (buildCost(run, id) ?? Infinity) <= run.supplies)

/** What a building bot builds first. */
const BUILD_ORDER: FacilityId[] = ['firingRange', 'workshop', 'optics', 'drills', 'academy', 'course']

/** Takes quiet zones until the squad's mean level reaches 3, then overrun ones. */
const growing = (run: Run): Risk => (run.soldiers.reduce((sum, s) => sum + level(s), 0) / run.soldiers.length >= 3 ? 'dangerous' : 'safe')

/** One way to play: which risk to take at each fork, how to choose offers, where to land, and whether to build. */
interface Strategy {
  risk: Risk | ((run: Run) => Risk)
  pick: keyof typeof PICKS
  land: keyof typeof LANDS
  build: boolean
}

/** A bot that plays `strategy`, deciding finds as decideFind says. */
const play =
  ({ risk, pick, land, build }: Strategy): Bot =>
  (run, rng) => {
    if (run.phase === 'reward') return reward(run, rng, PICKS[pick])
    if (run.phase === 'battle') return { type: 'land', zone: LANDS[land](run, run.battle!, rng) }
    const facility = build ? BUILD_ORDER.find((id) => affordable(run).includes(id)) : undefined
    if (facility) return { type: 'build', facility }
    const wanted = typeof risk === 'function' ? risk(run) : risk
    return run.zone ? { type: 'advance' } : { type: 'zone', index: run.zones.findIndex((zone) => zone.risk === wanted) }
  }

/** Chooses every option at random; in the overworld, builds or moves on at a coin flip. Decides finds as decideFind says. */
const randomBot: Bot = (run, rng) => {
  if (run.phase === 'reward') return reward(run, rng, PICKS.random)
  if (run.phase === 'battle') return { type: 'land', zone: LANDS.random(run, run.battle!, rng) }
  const options = affordable(run)
  if (options.length > 0 && randomInt(rng, 2) === 0) return { type: 'build', facility: options[randomInt(rng, options.length)] }
  return run.zone ? { type: 'advance' } : { type: 'zone', index: randomInt(rng, run.zones.length) }
}

/**
 * Strategies spanning the worst play to the best, so a batch shows the floor, the ceiling, and whether one choice
 * dominates. `standard` is the baseline the default sim runs.
 */
export const bots: Record<string, Bot> = {
  random: randomBot,
  careless: play({ risk: 'standard', pick: 'first', land: 'exposed', build: false }),
  standard: play({ risk: 'standard', pick: 'first', land: 'cover', build: true }),
  safe: play({ risk: 'safe', pick: 'first', land: 'cover', build: true }),
  dangerous: play({ risk: 'dangerous', pick: 'first', land: 'cover', build: true }),
  growing: play({ risk: growing, pick: 'first', land: 'cover', build: true }),
  breacher: play({ risk: 'standard', pick: 'first', land: 'hot', build: true }),
  synergy: play({ risk: 'standard', pick: 'synergy', land: 'boon', build: true }),
  expert: play({ risk: growing, pick: 'synergy', land: 'hot', build: true }),
}
