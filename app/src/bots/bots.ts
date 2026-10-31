import type { Action } from '../core/apply'
import { STRIKE, zoneInfo, type Battle, type Stance } from '../core/battle'
import type { Keyword } from '../core/keywords'
import { RELICS } from '../core/relics'
import { randomInt } from '../core/rng'
import { SKILLS } from '../core/skills'
import { CLASSES } from '../core/classes'
import { EFFECTS, type Gear } from '../core/gear'
import { WEAPONS } from '../core/weapons'
import { BRIBE, EVENTS, RELIC_PRICE } from '../core/events'
import { current, danger, GEAR_PRICE, health, legOf, level, skillOffers, soldierStats, squadKeywords, THREAT_MAX, ways, type Risk, type Run, type Soldier } from '../core/run'

/** Chooses the next action whenever the run waits for the player. `rng` is the bot's own, separate from the run's. */
export type Bot = (run: Run, rng: { rng: number }) => Action

const RARITY_ORDER = ['common', 'rare', 'epic']

/** What a piece of gear is worth on its own: rarer is better, a plain one, such as the starting rifle, least; an empty slot nothing. */
const value = (gear: Gear | null) => (gear ? 2 * RARITY_ORDER.indexOf(gear.rarity) + (gear.effect || Object.keys(gear.stats).length > 0 ? 1 : 0) : -1)

/**
 * The soldier a piece of gear does the most for, or null if it does nothing for anyone: the most it raises the slot's
 * worth, less where a weapon would make its wielder fight against its class's way; a `keen` bot also counts the
 * keywords it shares with the soldier's skills.
 */
function fitFor(run: Run, gear: Gear, keen: boolean): number | null {
  const gain = (s: Soldier) => {
    const stance = gear.weapon && WEAPONS[gear.weapon].stance
    const clash = stance && s.cls && stance !== CLASSES[s.cls].stance ? 1.5 : 0
    const own = s.skills.flatMap((id) => SKILLS[id].tags ?? [])
    const shared = keen && gear.effect ? (EFFECTS[gear.effect].tags ?? []).filter((tag) => own.includes(tag)).length : 0
    return value(gear) - value(s.gear[gear.slot]) - clash + shared
  }
  const best = run.soldiers.reduce((a, b) => (gain(b) > gain(a) ? b : a))
  return gain(best) > 0 ? best.id : null
}

/** Puts the first find on the soldier it does the most for, or sells it; a `keen` bot weighs keywords too. */
function decideFind(run: Run, keen: boolean): Action {
  const soldier = fitFor(run, run.finds[0], keen)
  return soldier === null ? { type: 'sell', find: 0 } : { type: 'equip', find: 0, soldier }
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

/** The reward phase's next choice: a relic, then finds, then skills. A random bot puts a find on anyone, or sells it. */
function reward(run: Run, rng: { rng: number }, pick: Pick): Action {
  if (run.relicOffers.length > 0) return { type: 'relic', index: pick(run, rng, run.relicOffers.map((id) => RELICS[id].tags ?? [])) }
  if (run.finds.length > 0 && pick === PICKS.random) {
    const who = randomInt(rng, run.soldiers.length + 1)
    return who === run.soldiers.length ? { type: 'sell', find: 0 } : { type: 'equip', find: 0, soldier: run.soldiers[who].id }
  }
  if (run.finds.length > 0) return decideFind(run, pick === PICKS.synergy)
  const learner = run.soldiers.find((s) => skillOffers(s).length > 0)!
  return { type: 'skill', soldier: learner.id, index: pick(run, rng, skillOffers(learner).map((id) => SKILLS[id].tags ?? [])) }
}

/**
 * Whether a zone's ground suits a soldier of `stance`: a sniper wants high ground over the aliens or room to shoot from
 * afar, an assault to start close, anyone else plenty of cover.
 */
function suits(stance: Stance, info: ReturnType<typeof zoneInfo>): boolean {
  if (stance === 'standoff') return info.high > 0 || (info.contact >= 8 && info.contact < Infinity)
  if (stance === 'rush') return info.contact <= 6
  return info.cover >= 10
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
  hot: (_run, battle) => (battle.plans.includes('hot') ? battle.plans.indexOf('hot') : best(battle, (i) => cover(battle, i))),
  /** The zone whose ground suits the most of the squad. */
  fit: (_run, battle) => best(battle, (i) => battle.reserve.filter((r) => suits(r.stance, zoneInfo(battle, battle.zones[i]))).length * 100 + cover(battle, i)),
} satisfies Record<string, Land>

/** Purchases the run can pay for now: gear, each for the soldier it does the most for, then relics. */
const affordable = (run: Run): Action[] => [
  ...run.shop!.wares.flatMap((ware, index): Action[] => {
    const soldier = fitFor(run, ware, false)
    return GEAR_PRICE[ware.rarity as keyof typeof GEAR_PRICE] <= run.supplies && soldier !== null ? [{ type: 'gear', index, soldier }] : []
  }),
  ...run.shop!.relics.flatMap((_, index): Action[] => (RELIC_PRICE <= run.supplies ? [{ type: 'buy', index }] : [])),
]

/** The squad's health as a share of its most. */
const squadHealth = (run: Run) => run.soldiers.reduce((sum, s) => sum + health(run, s), 0) / run.soldiers.reduce((sum, s) => sum + soldierStats(run, s).hp, 0)
const HURT = 0.6

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
    // A bold bot takes a recruit with a trait, any other the plain one.
    if (run.phase === 'recruit') return { type: 'recruit', index: run.recruits.findIndex((r) => (events === 'bold') === (r.trait !== null)) }
    // The barrage's zone on the hard fights, a key, the final mission or an Overrun battle, while the threat leaves room for it.
    const hard = run.mission && (run.mission.kind === 'key' || run.mission.kind === 'final' || run.mission.risk === 'dangerous')
    const barrage = run.battle?.barrage
    if (run.phase === 'battle' && run.battle!.goal !== 'raid' && hard && barrage != null && run.threat + STRIKE.threat < THREAT_MAX) return { type: 'land', zone: barrage }
    // A raid goes for caches by the same appetite.
    if (run.phase === 'battle' && run.battle!.goal === 'raid') {
      const most = run.battle!.caches.length
      return { type: 'grab', caches: Math.max(1, Math.round(most * { safe: 0, standard: 0.5, dangerous: 1 }[typeof risk === 'function' ? risk(run) : risk])) }
    }
    if (run.phase === 'battle') return { type: 'land', zone: LANDS[land](run, run.battle!, rng) }
    if (run.phase === 'shop') return build ? shop(run) : { type: 'leave' }
    // At a medic, the first thing it offers: rest when hurt, a bonus at full health.
    if (run.phase === 'event') return { type: 'choose', index: events === 'bold' || run.event === 'medic' ? takeable(run)[0] : takeable(run).at(-1)! }
    const wanted = squadHealth(run) < HURT ? 'safe' : typeof risk === 'function' ? risk(run) : risk
    if (current(run)) return { type: 'advance' }
    // The ways on by danger, least first: a safe bot takes the first, a standard one the middle, a dangerous one the last.
    const column = legOf(run).columns[run.stop]
    // A squad below HURT of its health makes for a medic when one is on the way.
    const medic = ways(run).find((i) => column[i].stop!.kind === 'medic')
    if (medic !== undefined && squadHealth(run) < HURT) return { type: 'go', index: medic }
    const ranked = ways(run).sort((a, b) => danger(column[a].stop!) - danger(column[b].stop!))
    return { type: 'go', index: ranked[Math.round((ranked.length - 1) * { safe: 0, standard: 0.5, dangerous: 1 }[wanted])] }
  }

/** Chooses every option at random; in a shop, builds or leaves at a coin flip. Decides finds as decideFind says. */
const randomBot: Bot = (run, rng) => {
  if (run.phase === 'reward') return reward(run, rng, PICKS.random)
  if (run.phase === 'recruit') return { type: 'recruit', index: randomInt(rng, run.recruits.length) }
  if (run.phase === 'battle' && run.battle!.goal === 'raid') return { type: 'grab', caches: 1 + randomInt(rng, run.battle!.caches.length) }
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
  synergy: play({ risk: 'standard', pick: 'synergy', land: 'fit', build: true, events: 'cautious' }),
  expert: play({ risk: growing, pick: 'synergy', land: 'hot', build: true, events: 'cautious' }),
}
