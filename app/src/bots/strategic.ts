// The strategic bot: reads each battle's board and builds a lean deck, and chooses route, hero and weapons for the build.
import type { Action } from '../core/apply'
import type { ClassId } from '../core/classes'
import { MEDKIT, EVENTS, RELIC_PRICE } from '../core/events'
import { EFFECTS, type Gear } from '../core/gear'
import { ARENA_KINDS } from '../core/arena-kinds'
import { CARD_PRICE, GEAR_PRICE, REMOVE_PRICE } from '../core/rewards'
import { current, legOf, ways } from '../core/run'
import { type Run, type Soldier, type Stop } from '../core/run-state'
import { plannedPerk, plannedSkill } from '../core/plans'
import { health, makes, minorOffers, reads, skillOffers, soldierStats } from '../core/hero'
import { RELICS, type RelicId } from '../core/relics'
import { CANCELS, cancelling, type Cancel, type Flow } from '../core/quantities'
import { CARDS, signOf, type Card, type CardId } from '../core/cards'
import { HAND, playing, UPGRADED } from '../core/deck'
import { boardOf, type Board } from '../core/read'
import type { Battle, Stats } from '../core/battle'
import type { Bot } from './bots'
import { EXAMS } from '../core/exams'

/** The hero's health as a share of its most. */
export const heroHealth = (run: Run) => health(run, run.hero) / soldierStats(run, run.hero).hp

/** What a stop is worth to go to: a fight on ground its build pays on, riskier while hale; a safehouse, more the more the hero is hurt. */
function worth(run: Run, stop: Stop, rest?: number): number {
  const hale = heroHealth(run)
  if (stop.kind === 'safehouse' && rest !== undefined) return 0
  if (stop.kind === 'safehouse') return hale < 0.6 ? 8 : hale < 0.8 ? 5 : hale < 0.95 ? 1 : -1
  if (stop.kind === 'shop') return run.supplies >= CARD_PRICE.rare ? 3 : 0.5
  if (stop.kind === 'supply') return 1.5
  if (stop.kind === 'cache') return 2
  if (stop.kind === 'unknown') return 1
  // Ground the build exploits is worth seeking out.
  const ground = stop.ground ? ARENA_KINDS[stop.ground].reads.filter((q) => makes(run).includes(q)).length : 0
  const risk = { safe: 0, standard: 1, dangerous: 2 }[stop.risk]
  return ground + (hale >= 0.7 ? risk : -risk) - (stop.challenge && hale < 0.6 ? 2 : 0)
}

/** The way on worth the most, counting half of the best stop after it. */
function route(run: Run, rest?: number): Action {
  const column = legOf(run).columns[run.stop]
  const next = legOf(run).columns[run.stop + 1]
  const safehouse = rest === undefined ? undefined : ways(run).find((i) => column[i].stop!.kind === 'safehouse')
  if (safehouse !== undefined && (heroHealth(run) < rest! || ways(run).length === 1)) return { type: 'go', index: safehouse }
  const score = (i: number) => worth(run, column[i].stop!, rest) + 0.5 * Math.max(0, ...column[i].next.flatMap((k) => (next?.[k]?.stop ? [worth(run, next[k].stop!, rest)] : [])))
  return { type: 'go', index: ways(run).filter((i) => i !== safehouse).reduce((a, b) => (score(b) > score(a) ? b : a)) }
}

const RARITY = { common: 0, rare: 2, epic: 4 }

/** What a weapon is worth to the hero: its rarity, what its effect adds to the combos, and a little to keep the weapon its skills were planned on. */
function gearWorth(run: Run, gear: Gear | null): number {
  if (!gear) return -1
  const bare = { ...run, hero: { ...run.hero, gear: null } }
  return RARITY[gear.rarity] + (gear.effect ? comboWorth(bare, EFFECTS[gear.effect]) : 0) + (gear.weapon === run.hero.gear?.weapon ? 1 : 0)
}

/** Whether `gear` improves on what the hero holds. */
const improves = (run: Run, gear: Gear): boolean => gearWorth(run, gear) > gearWorth(run, run.hero.gear)

/** A shop: a medkit when badly hurt, a relic, a card that lifts the deck, the deck's weakest card removed, a medkit when hurt, then gear, then a medkit at all hurt. */
function shop(run: Run): Action {
  const { cards, relics, wares, medkit, removed } = run.shop!
  const heal = (below: number) => !medkit && MEDKIT.price <= run.supplies && heroHealth(run) < below
  if (heal(0.5)) return { type: 'medkit' }
  const relic = relics.findIndex((r) => !r.sold && RELIC_PRICE <= run.supplies && relicWorth(run, r.id) >= 0)
  if (relic >= 0) return { type: 'buy', index: relic }
  const card = cards.findIndex(({ id, sold }) => !sold && CARD_PRICE[CARDS[id].rarity] <= run.supplies && lifts(run, id))
  if (card >= 0) return { type: 'buyCard', index: card }
  const weakest = weakestCard(run)
  if (!removed && REMOVE_PRICE <= run.supplies && weakest !== null) return { type: 'remove', index: weakest }
  if (heal(0.75)) return { type: 'medkit' }
  for (const [index, { gear, sold }] of wares.entries()) {
    if (!sold && GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE] <= run.supplies && improves(run, gear)) return { type: 'gear', index }
  }
  if (heal(1)) return { type: 'medkit' }
  return { type: 'leave' }
}


/**
 * What `flow` adds to the hero's combos: much for each quantity it reads that the hero makes, less for each it makes
 * that the hero reads, a little lost for each it reads that nothing makes. A cancellation it starts costs much unless
 * the hero holds the bridge; a bridge pays much once the hero makes both halves. Answering the leg's Guardian adds one.
 */
export function comboWorth(run: Run, flow: Flow & { bridge?: Cancel }): number {
  const made = makes(run)
  const read = reads(run)
  const wants = flow.reads ?? []
  const gives = flow.makes ?? []
  const fed = wants.filter((q) => made.includes(q)).length
  const feeding = gives.filter((q) => read.includes(q)).length
  const starved = flow.bridge ? 0 : wants.length - fed
  const held = new Set(run.relics.flatMap((id) => RELICS[id].bridge ?? []))
  const before = cancelling(made)
  const fresh = cancelling([...made, ...gives]).filter((id) => !before.includes(id) && !held.has(id) && flow.bridge !== id).length
  const bridge = flow.bridge ? (CANCELS[flow.bridge].pair.every((q) => made.includes(q)) ? 6 : -2) : 0
  const exam = [...wants, ...gives].some((q) => EXAMS[run.bosses[run.keys]].answers.includes(q)) ? 1 : 0
  return 3 * fed + 2 * feeding - starved - 4 * fresh + bridge + exam
}

/** What a relic is worth to the hero: see comboWorth. */
const relicWorth = (run: Run, id: RelicId) => comboWorth(run, RELICS[id])

/** Takes the relic worth the most, the first among equals; the card offered worth the most if it lifts the deck, else skips; upgrades the card worth the most; and the skill and perk the hero plans on. */
function reward(run: Run): Action {
  if (run.relicOffers.length > 0) {
    const score = (id: RelicId, i: number) => relicWorth(run, id) + (i === 0 ? 1 : 0)
    return { type: 'relic', index: run.relicOffers.reduce((best, id, i) => (score(id, i) > score(run.relicOffers[best], best) ? i : best), 0) }
  }
  if (run.finds.length > 0) return improves(run, run.finds[0]) ? { type: 'equip', find: 0 } : { type: 'sell', find: 0 }
  if (run.cardOffers.length > 0) {
    const best = run.cardOffers.reduce((b, id, i) => (cardWorth(run, id) > cardWorth(run, run.cardOffers[b]) ? i : b), 0)
    return { type: 'card', index: lifts(run, run.cardOffers[best]) ? best : null }
  }
  if (run.upgrading) {
    const open = run.deck.flatMap((c, i) => (c.level < UPGRADED ? [i] : []))
    return { type: 'upgrade', index: open.reduce((b, i) => (cardWorth(run, run.deck[i].id) > cardWorth(run, run.deck[b].id) ? i : b)) }
  }
  if (skillOffers(run.hero).length > 0) return { type: 'skill', index: plannedSkill(run.hero) }
  if (minorOffers(run.hero).length > 0) return { type: 'perk', index: plannedPerk(run.hero) }
  throw new Error('nothing to choose')
}

/** Classes by how many runs a hero of each wins, on the same seeds. */
const CLASS_ORDER: ClassId[] = ['sniper', 'cryo', 'assault', 'engineer', 'phantom', 'support', 'heavy', 'pyro']

function choose(run: Run): Action {
  const rank = (s: Soldier) => CLASS_ORDER.indexOf(s.cls!)
  return { type: 'hero', index: run.candidates.reduce((best, s, i) => (rank(s) < rank(run.candidates[best]) ? i : best), 0) }
}

const RARITY_WORTH = { basic: 0.5, common: 1, rare: 2, epic: 3 }

/** What card `id` is worth in the deck, wherever it is drawn: its rarity and what it adds to the combos. */
export const cardWorth = (run: Run, id: CardId) => RARITY_WORTH[CARDS[id].rarity] + 0.5 * comboWorth(run, CARDS[id])

/** The deck's cards' mean worth. */
const deckWorth = (run: Run) => run.deck.reduce((sum, c) => sum + cardWorth(run, c.id), 0) / Math.max(1, run.deck.length)

/** Whether adding card `id` lifts the deck: worth more than the deck's mean by LEAN, so a lean deck stays lean. */
const lifts = (run: Run, id: CardId) => cardWorth(run, id) > deckWorth(run) + LEAN
const LEAN = 0.5

/** The deck's weakest card, by index, if it is worth less than the mean by LEAN and the deck holds more than a hand and 2. */
function weakestCard(run: Run): number | null {
  if (run.deck.length <= HAND + 2) return null
  const worst = run.deck.reduce((w, c, i) => (cardWorth(run, c.id) < cardWorth(run, run.deck[w].id) ? i : w), 0)
  return cardWorth(run, run.deck[worst].id) < deckWorth(run) - LEAN ? worst : null
}

/** How much the board pulls on what a card plays to, for a hero of `stats`: what its line in the hand says it does here. */
export function pull(card: Card, board: Board, battle: Battle, stats: Stats): number {
  const b = board
  const n = CARDS[card.id].adds.by[card.level - 1]
  const turns = (move: number) => Math.ceil(b.far / Math.max(1, move))
  switch (signOf(card.id)) {
    case 'damage': return 1 + b.hp / 60 + (b.boss ? 1 : 0)
    case 'pierce': return b.armor / 6
    case 'hp': case 'temp': return 0.6 + b.aliens / 10
    case 'armor': return 0.5 + b.melee / 5
    case 'guard': return 0.5 + b.aliens / 6
    case 'regen': return 0.6 + (b.boss ? 0.8 : 0)
    case 'ranged': return b.ranged / 2.5
    case 'melee': return b.melee / 3
    case 'move': return 0.3 * (turns(stats.move) - turns(stats.move + n)) + (battle.deadline !== null ? 1.5 : 0)
    case 'jump': return b.high / 30
    case 'span': return (b.water + b.voids) / 20
    case 'hover': return (b.mire + b.water + b.voids) / 20
    case 'range': return b.ranged / 3 + b.far / 30
    case 'crit': return 0.8 + b.high / 40
    case 'push': case 'moved': case 'impact': return 0.4 + b.ledges / 15 + b.ice / 25
    case 'landing': return b.near / 2
    case 'burn': return 0.6 + b.mire / 15 + b.aliens / 15
    case 'chill': return 0.6 + (b.water + b.ice) / 15
    case 'mark': case 'boss': case 'overkill': return b.boss ? 2 : 0.5 + b.toughest / 30
    case 'rescue': return battle.goal === 'rescue' ? 3 : -5
    case 'hold': return battle.goal === 'hold' ? 3 : -5
    case 'extract': return battle.extract ? 1.5 : -5
    default: return 0.4 + b.aliens / 8
  }
}

/** What playing `card` is worth in this battle: what the board pulls on, by its level, beside its rarity and combos. */
export function playWorth(run: Run, battle: Battle, board: Board, card: Card): number {
  const stats = battle.reserve[0].stats
  return pull(card, board, battle, stats) * (1 + 0.35 * (card.level - 1)) + 0.5 * (RARITY_WORTH[CARDS[card.id].rarity] - 1) + 0.25 * comboWorth(run, CARDS[card.id])
}

/** The card of the hand worth the most here; fused when the others are worth less in the deck than its mean and a hand is left. */
function deploying(run: Run): Action {
  if (run.hand.length === 0) return { type: 'enter', card: null, fuse: false }
  const battle = run.battle!
  const board = boardOf(battle)
  const card = run.hand.reduce((best, _, i) => (playWorth(run, battle, board, playing(run, i, false)) > playWorth(run, battle, board, playing(run, best, false)) ? i : best), 0)
  const others = run.hand.filter((_, i) => i !== card).map((d) => run.deck[d])
  const left = run.deck.filter((c) => !c.out).length - others.length
  const fuse = others.length > 0 && left >= HAND && others.every((c) => c.level < UPGRADED && cardWorth(run, c.id) < deckWorth(run))
  return { type: 'enter', card, fuse }
}

/** The strategic bot; given `rest`, it rests at a safehouse on the way exactly when the hero's health is under it. */
export const resting = (rest?: number): Bot => (run) => {
  if (run.phase === 'reward') return reward(run)
  if (run.phase === 'select') return choose(run)
  if (run.phase === 'battle') return deploying(run)
  if (run.phase === 'shop') return shop(run)
  if (run.phase === 'event') {
    const options = EVENTS[run.event!].options.flatMap((option, i) => (!option.can || option.can(run) ? [i] : []))
    return { type: 'choose', index: options.at(-1)! }
  }
  return current(run) ? { type: 'advance' } : route(run, rest)
}

export const strategic = resting()
