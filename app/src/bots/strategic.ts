// The strategic bot: reads each stop's challenge, and chooses boons, route, hero and weapons to answer them.
import type { Action } from '../core/apply'
import { CHALLENGES, rungOf, TIERS, type ChallengeId } from '../core/challenges'
import type { ClassId } from '../core/classes'
import { MEDKIT, EVENTS, RELIC_PRICE } from '../core/events'
import { EFFECTS, type Gear } from '../core/gear'
import { ARENA_KINDS, type ArenaKind } from '../core/arena-kinds'
import { GEAR_PRICE, slotsOf } from '../core/rewards'
import { current, legOf, ways } from '../core/run'
import { type MapNode, type Run, type Soldier, type Stop } from '../core/run-state'
import { plannedPerk, plannedSkill } from '../core/plans'
import { health, makes, minorOffers, reads, skillOffers, soldierStats } from '../core/hero'
import { RELICS, type RelicId } from '../core/relics'
import { CANCELS, cancelling, type Cancel, type Flow } from '../core/quantities'
import { UTILITIES, UTILITY_PRICE, UTILITY_SLOTS, type UtilityId } from '../core/utilities'
import type { Bot } from './bots'
import { EXAMS } from '../core/exams'

/** The stops reachable in the next few columns, nearest first. */
function ahead(run: Run, depth = 3): Stop[] {
  const { columns } = legOf(run)
  let open = current(run)?.next ?? ways(run)
  let c = current(run) ? run.stop + 1 : run.stop
  const stops: Stop[] = []
  for (let i = 0; i < depth && c < columns.length; i++, c++) {
    const nodes = open.map((k) => columns[c][k]).filter(Boolean) as MapNode[]
    stops.push(...nodes.flatMap((n) => n.stop ?? []))
    open = [...new Set(nodes.flatMap((n) => n.next))]
  }
  return stops
}

/** What a stop's ground the held boons answer is worth, beside its challenge answered. */
const PAID_WORTH = 1

/** Whether some of `held` answers `ground`. */
const pays = (held: UtilityId[], ground: ArenaKind | undefined) => !!ground && held.some((u) => ARENA_KINDS[ground].answers.includes(u))

/** The boons held, by id. */
const ids = (run: Run) => run.utilities.map((h) => h.id)

/**
 * How much the boons `held` are worth: the challenges they answer, stops in sight most, then what the leg's tier has
 * in store; the grounds in sight they answer; and what each adds to the hero's combos.
 */
function coverage(run: Run, held: UtilityId[]): number {
  const seen = ahead(run).flatMap((stop) => (stop.challenge ? [stop.challenge] : []))
  const tier = Math.min(run.keys, TIERS.length - 1)
  const rung = rungOf(run.stop)
  const coming = [...TIERS[tier][rung], ...TIERS[Math.min(tier + 1, TIERS.length - 1)][Math.min(rung + 1, 2)], 'bigOne' as const]
  const answered = (id: ChallengeId) => held.some((u) => CHALLENGES[id].answers.includes(u))
  // A challenge's first answer is its best.
  const best = (id: ChallengeId) => (held.includes(CHALLENGES[id].answers[0]) ? 0.25 : 0)
  const grounds = ahead(run).filter((stop) => pays(held, stop.ground)).length * PAID_WORTH
  const bare = { ...run, utilities: [] }
  const combos = held.reduce((sum, u) => sum + 0.5 * comboWorth(bare, UTILITIES[u]), 0)
  return combos + grounds + seen.reduce((sum, id) => sum + (answered(id) ? 2 + best(id) : 0), 0) + coming.reduce((sum, id) => sum + (answered(id) ? 1 + best(id) : 0), 0)
}

/** With a new boon, keeps the set that is worth the most. */
function keep(run: Run): { type: 'keep'; drop: number } {
  const options = [-1, ...run.utilities.map((_, i) => i)]
  const after = (drop: number) => (drop < 0 ? ids(run) : ids(run).map((id, i) => (i === drop ? run.spare! : id)))
  return { type: 'keep', drop: options.reduce((best, d) => (coverage(run, after(d)) > coverage(run, after(best)) ? d : best), -1) }
}

/** The hero's health as a share of its most. */
export const heroHealth = (run: Run) => health(run, run.hero) / soldierStats(run, run.hero).hp

/** What a stop is worth to go to: an answered fight beats a fight it has no answer for; a safehouse, more the more the hero is hurt. */
function worth(run: Run, stop: Stop, rest?: number): number {
  const hale = heroHealth(run)
  if (stop.kind === 'safehouse' && rest !== undefined) return 0
  if (stop.kind === 'safehouse') return hale < 0.6 ? 8 : hale < 0.8 ? 5 : hale < 0.95 ? 1 : -1
  if (stop.kind === 'shop') return run.supplies >= UTILITY_PRICE ? 3 : 0.5
  if (stop.kind === 'supply') return 1.5
  if (stop.kind === 'cache') return 2
  if (stop.kind === 'unknown') return 1
  // Ground the build or a boon held exploits is worth seeking out.
  const ground = stop.ground ? (pays(ids(run), stop.ground) ? 1 : 0) + ARENA_KINDS[stop.ground].reads.filter((q) => makes(run).includes(q)).length : 0
  if (!stop.challenge) return ground
  const answered = ids(run).some((id) => CHALLENGES[stop.challenge!].answers.includes(id))
  const risk = { safe: 0, standard: 1, dangerous: 2 }[stop.risk]
  return ground + (answered ? 3 : -3 - 2 * (hale < 0.6 ? 1 : 0)) + (hale >= 0.7 && answered ? risk : -risk)
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

/** The challenges in sight or in the leg's tier that no boon held answers. */
const unanswered = (run: Run): ChallengeId[] => {
  const seen = ahead(run).flatMap((stop) => (stop.challenge ? [stop.challenge] : []))
  return [...new Set([...seen, ...TIERS[Math.min(run.keys, TIERS.length - 1)][rungOf(run.stop)]])].filter((id) => !ids(run).some((u) => CHALLENGES[id].answers.includes(u)))
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

/** A shop: a medkit when badly hurt, a relic, then an answer it lacks, a medkit when hurt, then gear, then a medkit at all hurt. */
function shop(run: Run): Action {
  const { utilities, relics, wares, medkit } = run.shop!
  const heal = (below: number) => !medkit && MEDKIT.price <= run.supplies && heroHealth(run) < below
  if (heal(0.5)) return { type: 'medkit' }
  const relic = relics.findIndex((r) => !r.sold && RELIC_PRICE <= run.supplies && relicWorth(run, r.id) >= 0)
  if (relic >= 0) return { type: 'buy', index: relic }
  const gaps = unanswered(run)
  const crosses = (id: UtilityId) => ahead(run).some((stop) => !pays(ids(run), stop.ground) && pays([id], stop.ground))
  const held = (id: UtilityId) => ids(run).includes(id)
  const answer = utilities.findIndex(({ id, sold }) => !sold && UTILITY_PRICE <= run.supplies && (held(id) || ((gaps.some((c) => CHALLENGES[c].answers.includes(id)) || crosses(id)) && (run.utilities.length < slotsOf(run) || keep({ ...run, spare: id }).drop !== -1))))
  if (answer >= 0) return { type: 'utility', index: answer }
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

/** Takes the relic worth the most, the first among equals; and the skill and perk the hero plans on. */
function reward(run: Run): Action {
  if (run.relicOffers.length > 0) {
    const score = (id: RelicId, i: number) => relicWorth(run, id) + (i === 0 ? 1 : 0)
    return { type: 'relic', index: run.relicOffers.reduce((best, id, i) => (score(id, i) > score(run.relicOffers[best], best) ? i : best), 0) }
  }
  if (run.finds.length > 0) return improves(run, run.finds[0]) ? { type: 'equip', find: 0 } : { type: 'sell', find: 0 }
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

/** Of the starting offers, the UTILITY_SLOTS worth the most together. */
function starting(run: Run): Action {
  const sets = (from: number, size: number): number[][] => (size === 0 ? [[]] : run.boonOffers.flatMap((_, i) => (i < from ? [] : sets(i + 1, size - 1).map((rest) => [i, ...rest]))))
  const score = (set: number[]) => coverage(run, set.map((i) => run.boonOffers[i]))
  return { type: 'boons', picks: sets(0, UTILITY_SLOTS).reduce((best, set) => (score(set) > score(best) ? set : best)) }
}

/** The boon held that best answers the battle at the deploy screen: its challenge, by how early the boon stands in its answers, then its ground, then what it adds to the combos. */
function activating(run: Run): number | null {
  const battle = run.battle!
  const score = (id: UtilityId) => {
    const answers = battle.challenge ? CHALLENGES[battle.challenge].answers : []
    const rank = answers.indexOf(id)
    return (rank >= 0 ? 4 - 0.5 * rank : 0) + (ARENA_KINDS[battle.arenaKind].answers.includes(id) ? 1.5 : 0) + 0.1 * comboWorth({ ...run, utilities: [] }, UTILITIES[id])
  }
  const held = ids(run)
  return held.length === 0 ? null : held.reduce((best, id, i) => (score(id) > score(held[best]) ? i : best), 0)
}

/** The strategic bot; given `rest`, it rests at a safehouse on the way exactly when the hero's health is under it. */
export const resting = (rest?: number): Bot => (run) => {
  if (run.boonOffers.length > 0) return starting(run)
  if (run.spare) return keep(run)
  if (run.phase === 'reward') return reward(run)
  if (run.phase === 'select') return choose(run)
  if (run.phase === 'battle') return { type: 'enter', boon: activating(run) }
  if (run.phase === 'shop') return shop(run)
  if (run.phase === 'event') {
    const options = EVENTS[run.event!].options.flatMap((option, i) => (!option.can || option.can(run) ? [i] : []))
    return { type: 'choose', index: options.at(-1)! }
  }
  return current(run) ? { type: 'advance' } : route(run, rest)
}

export const strategic = resting()
