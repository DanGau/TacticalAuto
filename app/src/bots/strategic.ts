// The strategic bot: reads each stop's challenge, and chooses utilities, route, hero and weapons to answer them.
import type { Action } from '../core/apply'
import { CHALLENGES, rungOf, TIERS, type ChallengeId } from '../core/challenges'
import type { ClassId } from '../core/classes'
import { MEDKIT, EVENTS, RELIC_PRICE } from '../core/events'
import { EFFECTS, type Gear } from '../core/gear'
import { distance } from '../core/grid'
import { fuelTanks } from '../core/objects'
import { opens } from '../core/route'
import { ARENA_KINDS, isBarrier, type ArenaKind } from '../core/arena-kinds'
import { GEAR_PRICE } from '../core/rewards'
import { current, legOf, ways } from '../core/run'
import { type MapNode, type Run, type Soldier, type Stop } from '../core/run-state'
import { plannedPerk, plannedSkill } from '../core/plans'
import { health, makes, minorOffers, reads, skillOffers, soldierStats } from '../core/hero'
import { BOON_CHARGES, RELICS, type RelicId } from '../core/relics'
import { CANCELS, cancelling, type Cancel, type Flow } from '../core/quantities'
import { carries, RIG, UTILITIES, UTILITY_PRICE, UTILITY_SLOTS, type EffectId, type UtilityId } from '../core/utilities'
import type { Bot } from './bots'
import { EXAMS } from '../core/exams'

/** What to take into a fight no utility held answers, best first. */
const FALLBACK: EffectId[] = ['overcharge', 'ironSkin', 'mending', 'keen', 'crack', 'rangedShield', 'dampener', 'thrusters', 'meleeShield', 'smoke', 'coldSnap', 'gravity', 'farsight', 'hunted', 'blaze', 'flashbang', 'hover']

/**
 * What a utility is worth against `challenge`: each answer it carries by its place, as CHALLENGES runs them best
 * first, then each effect by its place in FALLBACK, far less. A minor part counts half.
 */
function fit(id: UtilityId, challenge: ChallengeId | null): number {
  const answers = challenge ? CHALLENGES[challenge].answers : []
  return UTILITIES[id].parts.reduce((sum, { id: e, minor }) => {
    const answer = answers.includes(e) ? 10 - answers.indexOf(e) : 0
    const fallback = FALLBACK.includes(e) ? 1 - FALLBACK.indexOf(e) / FALLBACK.length : 0
    return sum + (answer + fallback) * (minor ? 0.5 : 1)
  }, 0)
}

/** What opening a shorter route is worth, as much as a challenge's best answer. */
const ROUTE_WORTH = 10

/** The utility held best for `challenge` and the route scouted, if any is worth taking. */
export function answerFor(run: Run, challenge: ChallengeId | null): number {
  const battle = run.battle
  const usable = (id: UtilityId) => id !== 'tank' || (!!battle && fuelTanks(battle).length > 0)
  const scores = run.utilities.map((id) => (usable(id) ? fit(id, challenge) + (battle?.phase === 'deploy' && opens(battle, id) ? ROUTE_WORTH : 0) : 0))
  const best = scores.indexOf(Math.max(0, ...scores))
  return scores[best] > 0 ? best : -1
}

/** Against a swarm, which comes to the hero, the tank nearest the way in clear of its blast; else the farthest. */
export function tankFor(run: Run): number {
  const battle = run.battle!
  const tanks = fuelTanks(battle)
  const at = battle.entry!
  const rank = (t: { x: number; y: number }) => (distance(t, at) <= RIG.close + 2 ? -Infinity : battle.challenge === 'swarm' ? -distance(t, at) : distance(t, at))
  return tanks.reduce((best, t, i) => (rank(t) > rank(tanks[best]) ? i : best), 0)
}

/**
 * Goes in with the best answer held. With Boon Reservoir, an easy fight goes in bare to charge it, and a charged
 * reservoir takes the next best answer in too where the fight is a test.
 */
function deploy(run: Run): Action {
  const battle = run.battle!
  const reservoir = run.relics.includes('reservoir')
  const easy = !battle.challenge && run.mission?.kind === 'battle' && run.mission.risk === 'safe'
  if (reservoir && easy) return { type: 'enter' }
  const index = answerFor(run, battle.challenge)
  if (index < 0) return { type: 'enter' }
  if (run.utilities[index] === 'tank') return { type: 'enter', utility: index, tank: tankFor(run) }
  const second = reservoir && run.boons >= BOON_CHARGES ? answerFor({ ...run, utilities: run.utilities.map((id, i) => (i === index ? 'tank' : id)) }, battle.challenge) : -1
  return second >= 0 && !['tank', run.utilities[index]].includes(run.utilities[second]) ? { type: 'enter', utility: index, second } : { type: 'enter', utility: index }
}

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

/** The barriers a route may cross, and what answering one in case is worth beside a challenge in the leg's tier. */
const BARRIERS = (Object.keys(ARENA_KINDS) as ArenaKind[]).filter(isBarrier)
const BARRIER_WORTH = 0.5

/** How much the utilities `held` answer: stops in sight count most, then what the leg's tier has in store, then the barriers a route may cross. */
function coverage(run: Run, held: UtilityId[]): number {
  const seen = ahead(run).flatMap((stop) => (stop.challenge ? [stop.challenge] : []))
  const tier = Math.min(run.keys, TIERS.length - 1)
  const rung = rungOf(run.stop)
  const coming = [...TIERS[tier][rung], ...TIERS[Math.min(tier + 1, TIERS.length - 1)][Math.min(rung + 1, 2)], 'bigOne' as const]
  const answered = (id: ChallengeId) => held.some((u) => carries(u, CHALLENGES[id].answers))
  // A challenge's first answer is its best; a combo does more beside it.
  const best = (id: ChallengeId) => (held.some((u) => UTILITIES[u].parts[0].id === CHALLENGES[id].answers[0]) ? 0.25 : 0)
  const breadth = held.reduce((sum, u) => sum + 0.2 * (UTILITIES[u].parts.length - 1), 0)
  // Barriers are scouted only at the deploy screen: each is worth answering in case.
  const crossing = BARRIERS.filter((kind) => held.some((u) => carries(u, ARENA_KINDS[kind].opens!))).length * BARRIER_WORTH
  return breadth + crossing + seen.reduce((sum, id) => sum + (answered(id) ? 2 + best(id) : 0), 0) + coming.reduce((sum, id) => sum + (answered(id) ? 1 + best(id) : 0), 0)
}

/** With a utility to spare, keeps the three that answer the most. */
function keep(run: Run): { type: 'keep'; drop: number } {
  const options = [-1, ...run.utilities.map((_, i) => i)]
  const after = (drop: number) => (drop < 0 ? run.utilities : run.utilities.map((id, i) => (i === drop ? run.spare! : id)))
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
  if (!stop.challenge) return 0
  const answered = run.utilities.some((id) => carries(id, CHALLENGES[stop.challenge!].answers))
  const risk = { safe: 0, standard: 1, dangerous: 2 }[stop.risk]
  return (answered ? 3 : -3 - 2 * (hale < 0.6 ? 1 : 0)) + (hale >= 0.7 && answered ? risk : -risk)
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

/** The challenges in sight or in the leg's tier that no utility held answers. */
const unanswered = (run: Run): ChallengeId[] => {
  const seen = ahead(run).flatMap((stop) => (stop.challenge ? [stop.challenge] : []))
  return [...new Set([...seen, ...TIERS[Math.min(run.keys, TIERS.length - 1)][rungOf(run.stop)]])].filter((id) => !run.utilities.some((u) => carries(u, CHALLENGES[id].answers)))
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
  const crosses = (id: UtilityId) => !run.utilities.some((u) => carries(u, ['hover'])) && carries(id, ['hover'])
  const answer = utilities.findIndex(({ id, sold }) => !sold && UTILITY_PRICE <= run.supplies && (gaps.some((c) => carries(id, CHALLENGES[c].answers)) || crosses(id)) && (run.utilities.length < UTILITY_SLOTS || keep({ ...run, spare: id }).drop !== -1))
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

/** Of the starting offers, the pair that answers the most. */
function starting(run: Run): Action {
  const pairs = run.boonOffers.flatMap((_, i) => run.boonOffers.flatMap((_, j) => (i < j ? [[i, j]] : [])))
  const score = (pair: number[]) => coverage(run, pair.map((i) => run.boonOffers[i]))
  return { type: 'boons', picks: pairs.reduce((best, pair) => (score(pair) > score(best) ? pair : best)) }
}

/** The strategic bot; given `rest`, it rests at a safehouse on the way exactly when the hero's health is under it. */
export const resting = (rest?: number): Bot => (run) => {
  if (run.boonOffers.length > 0) return starting(run)
  if (run.spare) return keep(run)
  if (run.phase === 'reward') return reward(run)
  if (run.phase === 'select') return choose(run)
  if (run.phase === 'battle') return deploy(run)
  if (run.phase === 'shop') return shop(run)
  if (run.phase === 'event') {
    const options = EVENTS[run.event!].options.flatMap((option, i) => (!option.can || option.can(run) ? [i] : []))
    return { type: 'choose', index: options.at(-1)! }
  }
  return current(run) ? { type: 'advance' } : route(run, rest)
}

export const strategic = resting()
