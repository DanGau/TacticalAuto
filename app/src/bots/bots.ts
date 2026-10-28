import type { Action } from '../core/apply'
import { onTheWay, zoneInfo, type Battle } from '../core/battle'
import type { Keyword } from '../core/keywords'
import { RELICS } from '../core/relics'
import { randomInt } from '../core/rng'
import { SKILLS } from '../core/skills'
import { BRIBE, EVENTS, RELIC_PRICE } from '../core/events'
import { current, danger, GEAR_PRICE, legOf, level, skillOffers, squadKeywords, THREAT_MAX, ways, type Risk, type Run } from '../core/run'

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

/** Purchases the run can pay for now: gear, then relics. */
const affordable = (run: Run): Action[] => [
  ...run.shop!.wares.flatMap((ware, index): Action[] => (GEAR_PRICE[ware.gear.rarity as keyof typeof GEAR_PRICE] <= run.supplies ? [{ type: 'gear', index }] : [])),
  ...run.shop!.relics.flatMap((_, index): Action[] => (RELIC_PRICE <= run.supplies ? [{ type: 'buy', index }] : [])),
]

/** Takes the safest stops until the squad's mean level reaches 3, then the most dangerous. */
const growing = (run: Run): Risk => (run.soldiers.reduce((sum, s) => sum + level(s), 0) / run.soldiers.length >= 3 ? 'dangerous' : 'safe')

/**
 * One way to play: how much danger to take at each choice of way, how to choose offers, where to land, whether to spend at
 * shops, and how to meet events: boldly, taking the first option the squad can, or cautiously, taking the last.
 */
interface Strategy {
  risk: Risk | ((run: Run) => Risk)
  pick: keyof typeof PICKS
  land: keyof typeof LANDS
  build: boolean
  events: 'bold' | 'cautious'
}

/** The options of the event under way the squad can take, by index. */
const takeable = (run: Run) => EVENTS[run.event!].options.flatMap((option, i) => (!option.can || option.can(run) ? [i] : []))

/** A spending bot's next purchase in a shop: a relic, then gear, then a bribe once threat builds. */
function shop(run: Run): Action {
  const buys = affordable(run)
  const buy = buys.find((a) => a.type === 'buy') ?? buys[0]
  if (buy) return buy
  if (!run.shop!.bribed && run.supplies >= BRIBE.price && run.threat >= THREAT_MAX / 2) return { type: 'bribe' }
  return { type: 'leave' }
}

/** A bot that plays `strategy`, deciding finds as decideFind says. */
const play =
  ({ risk, pick, land, build, events }: Strategy): Bot =>
  (run, rng) => {
    if (run.phase === 'reward') return reward(run, rng, PICKS[pick])
    // Any bot with a landing plan breaks out the way with the fewest aliens.
    if (run.phase === 'battle' && run.battle!.start) return { type: 'land', zone: best(run.battle!, (i) => -onTheWay(run.battle!, run.battle!.zones[i]).length) }
    if (run.phase === 'battle') return { type: 'land', zone: LANDS[land](run, run.battle!, rng) }
    if (run.phase === 'shop') return build ? shop(run) : { type: 'leave' }
    if (run.phase === 'event') return { type: 'choose', index: events === 'bold' ? takeable(run)[0] : takeable(run).at(-1)! }
    const wanted = typeof risk === 'function' ? risk(run) : risk
    if (current(run)) return { type: 'advance' }
    // The ways on by danger, least first: a safe bot takes the first, a standard one the middle, a dangerous one the last.
    const column = legOf(run).columns[run.stop]
    const ranked = ways(run).sort((a, b) => danger(column[a].stop!) - danger(column[b].stop!))
    return { type: 'go', index: ranked[Math.round((ranked.length - 1) * { safe: 0, standard: 0.5, dangerous: 1 }[wanted])] }
  }

/** Chooses every option at random; in a shop, builds or leaves at a coin flip. Decides finds as decideFind says. */
const randomBot: Bot = (run, rng) => {
  if (run.phase === 'reward') return reward(run, rng, PICKS.random)
  if (run.phase === 'battle') return { type: 'land', zone: LANDS.random(run, run.battle!, rng) }
  if (run.phase === 'event') return { type: 'choose', index: takeable(run)[randomInt(rng, takeable(run).length)] }
  if (run.phase === 'shop') {
    const options = affordable(run)
    return options.length > 0 && randomInt(rng, 2) === 0 ? options[randomInt(rng, options.length)] : { type: 'leave' }
  }
  if (current(run)) return { type: 'advance' }
  const open = ways(run)
  return { type: 'go', index: open[randomInt(rng, open.length)] }
}

/**
 * Strategies spanning the worst play to the best, so a batch shows the floor, the ceiling, and whether one choice
 * dominates. `standard` is the baseline the default sim runs.
 */
export const bots: Record<string, Bot> = {
  random: randomBot,
  careless: play({ risk: 'standard', pick: 'first', land: 'exposed', build: false, events: 'cautious' }),
  standard: play({ risk: 'standard', pick: 'first', land: 'cover', build: true, events: 'cautious' }),
  bold: play({ risk: 'standard', pick: 'first', land: 'cover', build: true, events: 'bold' }),
  safe: play({ risk: 'safe', pick: 'first', land: 'cover', build: true, events: 'cautious' }),
  dangerous: play({ risk: 'dangerous', pick: 'first', land: 'cover', build: true, events: 'cautious' }),
  growing: play({ risk: growing, pick: 'first', land: 'cover', build: true, events: 'cautious' }),
  breacher: play({ risk: 'standard', pick: 'first', land: 'hot', build: true, events: 'cautious' }),
  synergy: play({ risk: 'standard', pick: 'synergy', land: 'boon', build: true, events: 'cautious' }),
  expert: play({ risk: growing, pick: 'synergy', land: 'hot', build: true, events: 'cautious' }),
}
