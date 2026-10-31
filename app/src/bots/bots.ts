// Bots: each chooses the next action whenever the run waits for the player.
import { canUse, type Action } from '../core/apply'
import { foesInSight } from '../core/combat'
import { CONSUMABLES, KIT_SLOTS } from '../core/consumables'
import { type Battle } from '../core/battle'
import { STRIKE, type EntranceKind } from '../core/entrances'
import type { Keyword } from '../core/keywords'
import { RELICS } from '../core/relics'
import { randomInt } from '../core/rng'
import { SKILLS } from '../core/skills'
import { CLASSES } from '../core/classes'
import { EFFECTS, type Gear } from '../core/gear'
import { WEAPONS } from '../core/weapons'
import { BRIBE, EVENTS, RELIC_PRICE } from '../core/events'
import { current, legOf, ways } from '../core/run'
import { type Run } from '../core/run-state'
import { type Soldier } from '../core/run-state'
import { type Risk } from '../core/run-state'
import { danger } from '../core/missions'
import { GEAR_PRICE } from '../core/rewards'
import { squadKeywords } from '../core/squad'
import { soldierStats } from '../core/squad'
import { health } from '../core/squad'
import { skillOffers } from '../core/squad'
import { level } from '../core/squad'
import { THREAT_MAX } from '../core/progress'

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
 * What an entrance is worth to a sensible squad: a monologue where civilians or a VIP need sparing, else the surprise
 * of a charge through the wall, then the hurt the others do; Danger Close is chosen apart, for its threat.
 */
function sense(battle: Battle, kind: EntranceKind): number {
  const spare = battle.units.some((u) => u.civilian)
  return { monologue: spare ? 10 : 2, wall: 6, door: 5, skylight: 4, truck: 4, smoke: 4, rappel: 3, strike: 0, tap: 3, look: 5, blast: 1, han: 3, mine: 1 }[kind]
}

/** What each entrance that hurts the aliens is worth to a hard-hitting squad. */
const HURTS: Partial<Record<EntranceKind, number>> = { tap: 4, truck: 3, skylight: 3, door: 2 }

/** Chooses an entrance. */
type Enter = (run: Run, battle: Battle, rng: { rng: number }) => number

const best = (battle: Battle, score: (kind: EntranceKind) => number) => battle.entrances.reduce((top, e, i) => (score(e.kind) > score(battle.entrances[top].kind) ? i : top), 0)

const ENTERS = {
  random: (_run, battle, rng) => randomInt(rng, battle.entrances.length),
  /** The most sensible. */
  sensible: (_run, battle) => best(battle, (kind) => sense(battle, kind)),
  /** The least: a careless entrance. */
  careless: (_run, battle) => best(battle, (kind) => -sense(battle, kind)),
  /** The one that hurts the aliens most. */
  hard: (_run, battle) => best(battle, (kind) => HURTS[kind] ?? sense(battle, kind) / 10),
  /** The sensible one, rappelling with snipers enough to use the height. */
  fit: (_run, battle) => best(battle, (kind) => sense(battle, kind) + (kind === 'rappel' ? 2 * battle.reserve.filter((r) => r.stance === 'standoff').length : 0)),
} satisfies Record<string, Enter>

/** Purchases the run can pay for now: gear, each for the soldier it does the most for, then relics. */
const affordable = (run: Run): Action[] => [
  ...run.shop!.wares.flatMap(({ gear, sold }, index): Action[] => {
    const soldier = sold ? null : fitFor(run, gear, false)
    return GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE] <= run.supplies && soldier !== null ? [{ type: 'gear', index, soldier }] : []
  }),
  ...run.shop!.relics.flatMap((relic, index): Action[] => (!relic.sold && RELIC_PRICE <= run.supplies ? [{ type: 'buy', index }] : [])),
  ...run.shop!.consumables.flatMap((item, index): Action[] => (!item.sold && run.kit.length < KIT_SLOTS && CONSUMABLES[item.id].price <= run.supplies ? [{ type: 'consumable', index }] : [])),
]

/** Aliens in the fight that make a consumable worth using, or a boss. */
const CRISIS = 3

/**
 * A squad turn's use of the kit: a medkit once a soldier is badly hurt; anything else once a fight is big, or a boss
 * is in it: an airstrike only with room for its threat, stims only with health to spare.
 */
function useKit(run: Run): Action {
  const battle = run.battle!
  const squad = battle.units.filter((u) => u.side === 'human' && u.soldier !== null)
  const foes = foesInSight(battle)
  const hurt = squad.some((u) => u.hp <= u.stats.hp * 0.4)
  const crisis = foes.length >= CRISIS || foes.some((u) => u.boss)
  const index = run.kit.findIndex((id, i) => {
    if (!canUse(run, i)) return false
    if (id === 'medkit') return hurt
    if (!crisis) return false
    if (id === 'airstrike') return run.threat + CONSUMABLES.airstrike.threat! < THREAT_MAX
    if (id === 'stims') return squad.every((u) => u.hp > 4)
    return true
  })
  return index >= 0 ? { type: 'use', index } : { type: 'wait' }
}

/** The squad's health as a share of its most. */
const squadHealth = (run: Run) => run.soldiers.reduce((sum, s) => sum + health(run, s), 0) / run.soldiers.reduce((sum, s) => sum + soldierStats(run, s).hp, 0)
const HURT = 0.6

/** Takes the safest stops until the squad's mean level reaches 3, then the most dangerous. */
const growing = (run: Run): Risk => (run.soldiers.reduce((sum, s) => sum + level(s), 0) / run.soldiers.length >= 3 ? 'dangerous' : 'safe')

/**
 * One way to play: how much danger to take at each choice of way, how to choose offers, how to go in, whether to spend at
 * shops, and how to meet events: boldly, taking the first option the squad can, or cautiously, taking the last.
 */
interface Strategy {
  risk: Risk | ((run: Run) => Risk)
  pick: keyof typeof PICKS
  enter: keyof typeof ENTERS
  build: boolean
  events: 'bold' | 'cautious'
}

/** The options of the event under way the squad can take, by index. */
const takeable = (run: Run) => EVENTS[run.event!].options.flatMap((option, i) => (!option.can || option.can(run) ? [i] : []))

/** A spending bot's next purchase in a shop: a relic, then gear, then a consumable, then a bribe once threat builds. */
function shop(run: Run): Action {
  const buys = affordable(run)
  const buy = buys.find((a) => a.type === 'buy') ?? buys[0]
  if (buy) return buy
  if (!run.shop!.bribed && run.supplies >= BRIBE.price && run.threat >= THREAT_MAX / 2) return { type: 'bribe' }
  return { type: 'leave' }
}

/** A bot that plays `strategy`, deciding finds as decideFind says. */
const play =
  ({ risk, pick, enter, build, events }: Strategy): Bot =>
  (run, rng) => {
    if (run.phase === 'battle' && run.battle!.phase === 'battle') return useKit(run)
    if (run.phase === 'reward') return reward(run, rng, PICKS[pick])
    // A bold bot takes a recruit with a trait, any other the plain one.
    if (run.phase === 'recruit') return { type: 'recruit', index: run.recruits.findIndex((r) => (events === 'bold') === (r.trait !== null)) }
    // Danger Close on the hard fights, a key, the final mission or an Overrun battle, while the threat leaves room for it.
    const hard = run.mission && (run.mission.kind === 'key' || run.mission.kind === 'final' || run.mission.risk === 'dangerous')
    const strike = run.battle?.entrances.findIndex((e) => e.kind === 'strike') ?? -1
    if (run.phase === 'battle' && run.battle!.goal !== 'raid' && hard && strike >= 0 && run.threat + STRIKE.threat < THREAT_MAX) return { type: 'enter', entrance: strike }
    // A raid goes for caches by the same appetite.
    if (run.phase === 'battle' && run.battle!.goal === 'raid') {
      const most = run.battle!.caches.length
      return { type: 'grab', caches: Math.max(1, Math.round(most * { safe: 0, standard: 0.5, dangerous: 1 }[typeof risk === 'function' ? risk(run) : risk])) }
    }
    if (run.phase === 'battle') return { type: 'enter', entrance: ENTERS[enter](run, run.battle!, rng) }
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
  if (run.phase === 'battle' && run.battle!.phase === 'battle') {
    const usable = run.kit.flatMap((_, i) => (canUse(run, i) ? [i] : []))
    return usable.length > 0 && randomInt(rng, 4) === 0 ? { type: 'use', index: usable[randomInt(rng, usable.length)] } : { type: 'wait' }
  }
  if (run.phase === 'reward') return reward(run, rng, PICKS.random)
  if (run.phase === 'recruit') return { type: 'recruit', index: randomInt(rng, run.recruits.length) }
  if (run.phase === 'battle' && run.battle!.goal === 'raid') return { type: 'grab', caches: 1 + randomInt(rng, run.battle!.caches.length) }
  if (run.phase === 'battle') return { type: 'enter', entrance: ENTERS.random(run, run.battle!, rng) }
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
  careless: play({ risk: 'standard', pick: 'first', enter: 'careless', build: false, events: 'cautious' }),
  standard: play({ risk: 'standard', pick: 'first', enter: 'sensible', build: true, events: 'cautious' }),
  bold: play({ risk: 'standard', pick: 'first', enter: 'sensible', build: true, events: 'bold' }),
  safe: play({ risk: 'safe', pick: 'first', enter: 'sensible', build: true, events: 'cautious' }),
  dangerous: play({ risk: 'dangerous', pick: 'first', enter: 'sensible', build: true, events: 'cautious' }),
  growing: play({ risk: growing, pick: 'first', enter: 'sensible', build: true, events: 'cautious' }),
  breacher: play({ risk: 'standard', pick: 'first', enter: 'hard', build: true, events: 'cautious' }),
  synergy: play({ risk: 'standard', pick: 'synergy', enter: 'fit', build: true, events: 'cautious' }),
  expert: play({ risk: growing, pick: 'synergy', enter: 'hard', build: true, events: 'cautious' }),
}
