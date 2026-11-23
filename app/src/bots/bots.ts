// Bots: each chooses the next action whenever the run waits for the player.
import type { Action } from '../core/apply'
import { strategic } from './strategic'
import { plannedPerk } from '../core/plans'
import { CARDS, type CardId } from '../core/cards'
import { UPGRADED } from '../core/deck'
import { CARD_PRICE } from '../core/rewards'
import { boardOf, inert } from '../core/read'
import type { Flow } from '../core/quantities'
import { RELICS } from '../core/relics'
import { randomInt } from '../core/rng'
import { SKILLS } from '../core/skills'
import { EFFECTS, type Gear } from '../core/gear'
import { MEDKIT, EVENTS, RELIC_PRICE } from '../core/events'
import { current, legOf, ways } from '../core/run'
import { type Run } from '../core/run-state'
import { type Risk } from '../core/run-state'
import { danger } from '../core/missions'
import { GEAR_PRICE } from '../core/rewards'
import { health, level, makes, minorOffers, reads, skillOffers, soldierStats, wounded } from '../core/hero'

/** Chooses the next action whenever the run waits for the player. `rng` is the bot's own, separate from the run's. */
export type Bot = (run: Run, rng: { rng: number }) => Action

const RARITY_ORDER = ['common', 'rare', 'epic']

/** What a piece of gear is worth on its own: rarer is better, a plain one, such as the starting rifle, least; an empty slot nothing. */
const value = (gear: Gear | null) => (gear ? 2 * RARITY_ORDER.indexOf(gear.rarity) + (gear.effect || Object.keys(gear.stats).length > 0 ? 1 : 0) : -1)

/** Whether a piece of gear, of the hero's own weapon, raises its worth over what the hero holds; a `keen` bot also counts the quantities it trades with the hero. */
function fits(run: Run, gear: Gear, keen: boolean): boolean {
  if (gear.weapon !== run.hero.gear?.weapon) return false
  const shared = keen && gear.effect ? trades(run, EFFECTS[gear.effect]) : 0
  return value(gear) - value(run.hero.gear) + shared > 0
}

/** How many quantities `flow` reads that the hero makes, or makes that it reads. */
const trades = (run: Run, flow: Flow) => {
  const made = makes(run)
  const read = reads(run)
  return (flow.reads ?? []).filter((q) => made.includes(q)).length + (flow.makes ?? []).filter((q) => read.includes(q)).length
}

/** Puts the first find on the hero if it fits, else sells it; a `keen` bot weighs keywords too. */
const decideFind = (run: Run, keen: boolean): Action => (fits(run, run.finds[0], keen) ? { type: 'equip', find: 0 } : { type: 'sell', find: 0 })

/** Chooses among offers, given what each makes and reads. */
type Pick = (run: Run, rng: { rng: number }, flows: Flow[]) => number

const PICKS = {
  first: () => 0,
  random: (_run, rng, flows) => randomInt(rng, flows.length),
  /** The offer trading the most quantities with the hero; with none, the first that makes or reads any. */
  synergy: (run, _rng, flows) => {
    const score = (i: number) => 10 * trades(run, flows[i]) + (flows[i].makes?.length ?? 0) + (flows[i].reads?.length ?? 0)
    return flows.reduce((best, _, i) => (score(i) > score(best) ? i : best), 0)
  },
} satisfies Record<string, Pick>

const RANK = { common: 0, rare: 1, epic: 2 }

/** Of `ids`, by index, the rarest, the first among equals. */
const rarest = (ids: CardId[]) => ids.reduce((best, id, i) => (RANK[CARDS[id].rarity] > RANK[CARDS[ids[best]].rarity] ? i : best), 0)

/** Deck size from which a typical player skips an offer of commons. */
const FULL = 12

/**
 * The reward phase's next choice: a relic, then finds, then cards, an upgrade, then skills. A random bot equips a find
 * or sells it, takes a card or skips, at random; any other takes the rarest card, skipping commons once the deck is FULL.
 */
function reward(run: Run, rng: { rng: number }, pick: Pick): Action {
  if (run.relicOffers.length > 0) return { type: 'relic', index: pick(run, rng, run.relicOffers.map((id) => RELICS[id])) }
  if (run.finds.length > 0 && pick === PICKS.random) {
    return randomInt(rng, 2) === 0 ? { type: 'sell', find: 0 } : { type: 'equip', find: 0 }
  }
  if (run.finds.length > 0) return decideFind(run, pick === PICKS.synergy)
  const open = run.deck.flatMap((c, i) => (c.level < UPGRADED ? [i] : []))
  if (pick === PICKS.random && run.cardOffers.length > 0) return { type: 'card', index: randomInt(rng, run.cardOffers.length + 1) === 0 ? null : randomInt(rng, run.cardOffers.length) }
  if (pick === PICKS.random && run.upgrading) return { type: 'upgrade', index: open[randomInt(rng, open.length)] }
  if (run.cardOffers.length > 0) {
    const best = rarest(run.cardOffers)
    return { type: 'card', index: CARDS[run.cardOffers[best]].rarity === 'common' && run.deck.length >= FULL ? null : best }
  }
  if (run.upgrading) return { type: 'upgrade', index: open[rarest(open.map((i) => run.deck[i].id))] }
  const offers = skillOffers(run.hero)
  if (offers.length === 0) return { type: 'perk', index: pick === PICKS.random ? randomInt(rng, minorOffers(run.hero).length) : plannedPerk(run.hero) }
  return { type: 'skill', index: pick(run, rng, offers.map((id) => SKILLS[id])) }
}

/** Purchases the run can pay for now: gear that fits the hero, relics, cards, then a medkit while the hero is hurt. */
const affordable = (run: Run): Action[] => [
  ...run.shop!.wares.flatMap(({ gear, sold }, index): Action[] => {
    return !sold && GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE] <= run.supplies && fits(run, gear, false) ? [{ type: 'gear', index }] : []
  }),
  ...run.shop!.relics.flatMap((relic, index): Action[] => (!relic.sold && RELIC_PRICE <= run.supplies ? [{ type: 'buy', index }] : [])),
  ...run.shop!.cards.flatMap((item, index): Action[] => (!item.sold && CARD_PRICE[CARDS[item.id].rarity] <= run.supplies ? [{ type: 'buyCard', index }] : [])),
  ...(!run.shop!.medkit && wounded(run) && MEDKIT.price <= run.supplies ? [{ type: 'medkit' } as const] : []),
]

/** The hero's health as a share of its most. */
const heroHealth = (run: Run) => health(run, run.hero) / soldierStats(run, run.hero).hp
const HURT = 0.6

/** The card of the hand that looks strongest: one with something to play to here, the rarest, then the most upgraded, the first among equals; none with an empty hand. */
function strongest(run: Run): number | null {
  if (run.hand.length === 0) return null
  const board = boardOf(run.battle!)
  const look = (i: number) => (inert(run.battle!, board, run.deck[run.hand[i]]) ? -100 : 0) + 10 * RANK[CARDS[run.deck[run.hand[i]].id].rarity] + run.deck[run.hand[i]].level
  return run.hand.reduce((best, _, i) => (look(i) > look(best) ? i : best), 0)
}

/** Takes the safest stops until the hero reaches level 3, then the most dangerous. */
const growing = (run: Run): Risk => (level(run.hero) >= 3 ? 'dangerous' : 'safe')

/**
 * One way to play: how much danger to take at each choice of way, how to choose offers, how to go in, whether to spend at
 * shops, and how to meet events: boldly, taking the first option the hero can, or cautiously, taking the last.
 */
interface Strategy {
  risk: Risk | ((run: Run) => Risk)
  pick: keyof typeof PICKS
  build: boolean
  events: 'bold' | 'cautious'
}

/** The options of the event under way the hero can take, by index. */
const takeable = (run: Run) => EVENTS[run.event!].options.flatMap((option, i) => (!option.can || option.can(run) ? [i] : []))

/** A spending bot's next purchase in a shop: a medkit when below HURT, else a relic, then gear, then a card, then a medkit. */
function shop(run: Run): Action {
  const buys = affordable(run)
  const medkit = heroHealth(run) < HURT ? buys.find((a) => a.type === 'medkit') : undefined
  return medkit ?? buys.find((a) => a.type === 'buy') ?? buys[0] ?? { type: 'leave' }
}

/** A bot that plays `strategy`, deciding finds as decideFind says. */
const play =
  ({ risk, pick, build, events }: Strategy): Bot =>
  (run, rng) => {
    if (run.phase === 'reward') return reward(run, rng, PICKS[pick])
    if (run.phase === 'select') return { type: 'hero', index: 0 }
    if (run.phase === 'battle') return { type: 'enter', card: strongest(run), fuse: false }
    if (run.phase === 'shop') return build ? shop(run) : { type: 'leave' }
    if (run.phase === 'event') return { type: 'choose', index: events === 'bold' ? takeable(run)[0] : takeable(run).at(-1)! }
    const wanted = heroHealth(run) < HURT ? 'safe' : typeof risk === 'function' ? risk(run) : risk
    if (current(run)) return { type: 'advance' }
    // The ways on by danger, least first: a safe bot takes the first, a standard one the middle, a dangerous one the last.
    const column = legOf(run).columns[run.stop]
    // A hero below HURT of its health makes for a safehouse when one is on the way.
    const safehouse = ways(run).find((i) => column[i].stop!.kind === 'safehouse')
    if (safehouse !== undefined && heroHealth(run) < HURT) return { type: 'go', index: safehouse }
    const ranked = ways(run).sort((a, b) => danger(column[a].stop!) - danger(column[b].stop!))
    return { type: 'go', index: ranked[Math.round((ranked.length - 1) * { safe: 0, standard: 0.5, dangerous: 1 }[wanted])] }
  }

/** Chooses every option at random; in a shop, builds or leaves at a coin flip. Decides finds as decideFind says. */
const randomBot: Bot = (run, rng) => {
  if (run.phase === 'reward') return reward(run, rng, PICKS.random)
  if (run.phase === 'select') return { type: 'hero', index: randomInt(rng, run.candidates.length) }
  if (run.phase === 'battle') return run.hand.length > 0 ? { type: 'enter', card: randomInt(rng, run.hand.length), fuse: run.hand.length > 1 && randomInt(rng, 4) === 0 } : { type: 'enter', card: null, fuse: false }
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
  careless: play({ risk: 'standard', pick: 'first', build: false, events: 'cautious' }),
  standard: play({ risk: 'standard', pick: 'first', build: true, events: 'cautious' }),
  bold: play({ risk: 'standard', pick: 'first', build: true, events: 'bold' }),
  safe: play({ risk: 'safe', pick: 'first', build: true, events: 'cautious' }),
  dangerous: play({ risk: 'dangerous', pick: 'first', build: true, events: 'cautious' }),
  growing: play({ risk: growing, pick: 'first', build: true, events: 'cautious' }),
  synergy: play({ risk: 'standard', pick: 'synergy', build: true, events: 'cautious' }),
  expert: play({ risk: growing, pick: 'synergy', build: true, events: 'cautious' }),
  strategic,
}
