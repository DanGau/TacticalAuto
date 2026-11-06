// The strategic bot: reads each stop's challenge, and chooses utilities, route, recruits and weapons to answer them.
import type { Action } from '../core/apply'
import { CHALLENGES, rungOf, TIERS, type ChallengeId } from '../core/challenges'
import { CLASSES, type ClassId } from '../core/classes'
import { BRIBE, EVENTS, RELIC_PRICE } from '../core/events'
import { EFFECTS, type Gear } from '../core/gear'
import { distance } from '../core/grid'
import { fuelTanks } from '../core/objects'
import { THREAT_MAX } from '../core/progress'
import { GEAR_PRICE } from '../core/rewards'
import { current, legOf, ways } from '../core/run'
import { type MapNode, type Run, type Soldier, type Stop } from '../core/run-state'
import { capstones, depthOf, locked, pathOf, type Path, SKILLS, type SkillId, TREES } from '../core/skills'
import { health, MAX_SQUAD, skillOffers, soldierStats, squadKeywords } from '../core/squad'
import { BOON_CHARGES, RELICS, type RelicId } from '../core/relics'
import type { Keyword } from '../core/keywords'
import { carries, RIG, UTILITIES, UTILITY_PRICE, UTILITY_SLOTS, type EffectId, type UtilityId } from '../core/utilities'
import { WEAPONS, type WeaponId } from '../core/weapons'
import type { Bot } from './bots'

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

/** The utility held best for `challenge`, if any is worth taking. */
export function answerFor(run: Run, challenge: ChallengeId | null): number {
  const usable = (id: UtilityId) => id !== 'tank' || fuelTanks(run.battle!).length > 0
  const scores = run.utilities.map((id) => (usable(id) ? fit(id, challenge) : 0))
  const best = scores.indexOf(Math.max(0, ...scores))
  return scores[best] > 0 ? best : -1
}

/** Against a swarm, which comes to the squad, the tank nearest the way in clear of its blast; else the farthest. */
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
  const second = reservoir && run.boons >= BOON_CHARGES && battle.challenge ? answerFor({ ...run, utilities: run.utilities.map((id, i) => (i === index ? 'tank' : id)) }, battle.challenge) : -1
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

/** How much the utilities `held` answer: stops in sight count most, then what the party's tier has in store. */
function coverage(run: Run, held: UtilityId[]): number {
  const seen = ahead(run).flatMap((stop) => (stop.challenge ? [stop.challenge] : []))
  const tier = Math.min(run.soldiers.length, MAX_SQUAD) - 1
  const rung = rungOf(run.stop)
  const coming = [...TIERS[tier][rung], ...TIERS[Math.min(tier + 1, TIERS.length - 1)][Math.min(rung + 1, 2)], 'bigOne' as const]
  const answered = (id: ChallengeId) => held.some((u) => carries(u, CHALLENGES[id].answers))
  // A challenge's first answer is its best; a combo does more beside it.
  const best = (id: ChallengeId) => (held.some((u) => UTILITIES[u].parts[0].id === CHALLENGES[id].answers[0]) ? 0.25 : 0)
  const breadth = held.reduce((sum, u) => sum + 0.2 * (UTILITIES[u].parts.length - 1), 0)
  return breadth + seen.reduce((sum, id) => sum + (answered(id) ? 2 + best(id) : 0), 0) + coming.reduce((sum, id) => sum + (answered(id) ? 1 + best(id) : 0), 0)
}

/** With a utility to spare, keeps the three that answer the most. */
function keep(run: Run): { type: 'keep'; drop: number } {
  const options = [-1, ...run.utilities.map((_, i) => i)]
  const after = (drop: number) => (drop < 0 ? run.utilities : run.utilities.map((id, i) => (i === drop ? run.spare! : id)))
  return { type: 'keep', drop: options.reduce((best, d) => (coverage(run, after(d)) > coverage(run, after(best)) ? d : best), -1) }
}

const squadHealth = (run: Run) => run.soldiers.reduce((sum, s) => sum + health(run, s), 0) / run.soldiers.reduce((sum, s) => sum + soldierStats(run, s).hp, 0)

/** What a stop is worth to go to: an answered fight, or a rest when hurt, beats a fight it has no answer for. */
function worth(run: Run, stop: Stop): number {
  const hale = squadHealth(run)
  if (stop.kind === 'medic') return hale < 0.75 ? 6 : 1
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
function route(run: Run): Action {
  const column = legOf(run).columns[run.stop]
  const next = legOf(run).columns[run.stop + 1]
  const score = (i: number) => worth(run, column[i].stop!) + 0.5 * Math.max(0, ...column[i].next.flatMap((k) => (next?.[k]?.stop ? [worth(run, next[k].stop!)] : [])))
  return { type: 'go', index: ways(run).reduce((a, b) => (score(b) > score(a) ? b : a)) }
}

/** The challenges in sight or in the party's tier that no utility held answers. */
const unanswered = (run: Run): ChallengeId[] => {
  const seen = ahead(run).flatMap((stop) => (stop.challenge ? [stop.challenge] : []))
  return [...new Set([...seen, ...TIERS[Math.min(run.soldiers.length, MAX_SQUAD) - 1][rungOf(run.stop)]])].filter((id) => !run.utilities.some((u) => carries(u, CHALLENGES[id].answers)))
}

/** Which weapons make up for a challenge with no utility to answer it. */
const COVERS: Record<ChallengeId, WeaponId[]> = {
  slog: ['sniper', 'lmg'],
  firingLine: ['sniper', 'lmg'],
  ironWall: ['sniper', 'shotgun', 'hammer'],
  swarm: ['shotgun', 'hammer', 'sword'],
  scattered: ['sword', 'fists', 'smg'],
  bigOne: ['sniper', 'shotgun', 'hammer'],
  killBox: ['shotgun', 'hammer', 'shield'],
}

const RARITY = { common: 0, rare: 2, epic: 4 }

/** What a weapon is worth now: its rarity, and what it covers that no utility does. */
function gearWorth(run: Run, gear: Gear | null, soldier: Soldier): number {
  if (!gear) return -1
  const own = [...soldier.skills.flatMap((id) => SKILLS[id].tags ?? []), ...run.relics.flatMap((id) => RELICS[id].tags ?? [])]
  const shared = gear.effect ? (EFFECTS[gear.effect].tags ?? []).filter((tag) => own.includes(tag)).length : 0
  // A weapon against its class's way fights badly.
  const clash = WEAPONS[gear.weapon]?.stance && soldier.cls && WEAPONS[gear.weapon].stance !== CLASSES[soldier.cls].stance ? 1.5 : 0
  return -clash + RARITY[gear.rarity] + shared + unanswered(run).filter((id) => COVERS[id].includes(gear.weapon)).length
}

/** The soldier `gear` does the most for, if it improves on what that soldier holds by more than a sale is worth. */
function holderFor(run: Run, gear: Gear): number | null {
  const gain = (s: Soldier) => gearWorth(run, gear, s) - gearWorth(run, s.gear, s)
  const best = run.soldiers.reduce((a, b) => (gain(b) > gain(a) ? b : a))
  return gain(best) > 0 ? best.id : null
}

/** A shop: a relic, then an answer it lacks, then gear, then a bribe once threat builds. */
function shop(run: Run): Action {
  const { utilities, relics, wares, bribed } = run.shop!
  const relic = relics.findIndex((r) => !r.sold && RELIC_PRICE <= run.supplies)
  if (relic >= 0) return { type: 'buy', index: relic }
  const gaps = unanswered(run)
  const answer = utilities.findIndex(({ id, sold }) => !sold && UTILITY_PRICE <= run.supplies && gaps.some((c) => carries(id, CHALLENGES[c].answers)) && (run.utilities.length < UTILITY_SLOTS || keep({ ...run, spare: id }).drop !== -1))
  if (answer >= 0) return { type: 'utility', index: answer }
  for (const [index, { gear, sold }] of wares.entries()) {
    const holder = sold || GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE] > run.supplies ? null : holderFor(run, gear)
    if (holder !== null) return { type: 'gear', index, soldier: holder }
  }
  if (!bribed && BRIBE.price <= run.supplies && run.threat >= THREAT_MAX / 2) return { type: 'bribe' }
  return { type: 'leave' }
}

/** The path each class climbs to its capstone: of the paths, what wins most on the same seeds. */
export const PLANS: Record<ClassId, string> = {
  assault: 'Rampage',
  heavy: 'Bastion',
  sniper: 'Ghost',
  engineer: 'Drone Hive',
  support: 'Aegis',
  pyro: 'Ember Hide',
  cryo: 'Glacier',
  phantom: 'Shade',
}

/** Whether a skill pays for this hero: Shield Slam only with a Star Shield, Fault Line only up close, Living Projectile only for the strong. */
const pays = (soldier: Soldier, id: SkillId) =>
  id === 'shieldSlam' ? soldier.gear?.weapon === 'shield' : id === 'faultLine' ? !!soldier.gear && !!WEAPONS[soldier.gear.weapon].melee : id === 'projectile' ? (soldier.gear?.weapon === 'hammer' || soldier.gear?.weapon === 'fists') : true

/** The skill a hero plans on, of those that pay: the capstone, else the deepest, of its planned path while that capstone is still to be had, else of any path whose capstone is. */
export function plannedSkill(soldier: Soldier): number {
  const cls = soldier.cls!
  const all = skillOffers(soldier)
  const offers = all.filter((id) => pays(soldier, id) || all.every((other) => !pays(soldier, other)))
  const live = (path?: Path) => !!path && !soldier.lost.includes(path.capstone) && !locked(cls, soldier.skills).includes(path.capstone)
  const plan = TREES[cls].paths.find((p) => p.name === PLANS[cls])!
  const aim = live(plan) ? [plan] : TREES[cls].paths.filter(live)
  // A capstone outside the aim would lock the aim's.
  const score = (id: SkillId) => (capstones(cls).includes(id) ? (aim.includes(pathOf(cls, id)!) ? 200 : -1) : (aim.includes(pathOf(cls, id)!) ? 100 : 0) + depthOf(cls, id))
  return all.indexOf(offers.reduce((best, id) => (score(id) > score(best) ? id : best)))
}

/** What a relic is worth beside what the squad holds: a bridge or engine pays only with its pieces, and is dead without them. */
function relicWorth(run: Run, id: RelicId): number {
  const held = squadKeywords(run)
  const has = (...tags: Keyword[]) => tags.every((tag) => held.includes(tag))
  const needs: Partial<Record<RelicId, boolean>> = {
    catalyst: has('crit') && (has('burn') || has('frost')),
    fracture: has('frost'),
    embers: has('mark', 'burn'),
    impetus: has('force'),
    accelerant: has('burn'),
  }
  const fit = needs[id]
  return fit === undefined ? 0 : fit ? 2 : -2
}

/** Takes a duo offered, else the first relic, on the same seeds better than choosing by shared keywords; and the skill its hero plans on. */
function reward(run: Run): Action {
  if (run.duoOffer) return { type: 'duo' }
  if (run.relicOffers.length > 0) {
    const score = (id: RelicId, i: number) => relicWorth(run, id) + (i === 0 ? 1 : 0)
    return { type: 'relic', index: run.relicOffers.reduce((best, id, i) => (score(id, i) > score(run.relicOffers[best], best) ? i : best), 0) }
  }
  if (run.finds.length > 0) {
    const holder = holderFor(run, run.finds[0])
    return holder === null ? { type: 'sell', find: 0 } : { type: 'equip', find: 0, soldier: holder }
  }
  const learner = run.soldiers.find((s) => skillOffers(s).length > 0)!
  return { type: 'skill', soldier: learner.id, index: plannedSkill(learner) }
}

/** Classes by how many runs a lone hero of each wins, on the same seeds. */
const RECRUIT_ORDER: ClassId[] = ['sniper', 'cryo', 'assault', 'engineer', 'phantom', 'support', 'heavy', 'pyro']

function recruit(run: Run): Action {
  const rank = (s: Soldier) => RECRUIT_ORDER.indexOf(s.cls!)
  return { type: 'recruit', index: run.recruits.reduce((best, s, i) => (rank(s) < rank(run.recruits[best]) ? i : best), 0) }
}

/** Of the starting offers, the pair that answers the most. */
function starting(run: Run): Action {
  const pairs = run.boonOffers.flatMap((_, i) => run.boonOffers.flatMap((_, j) => (i < j ? [[i, j]] : [])))
  const score = (pair: number[]) => coverage(run, pair.map((i) => run.boonOffers[i]))
  return { type: 'boons', picks: pairs.reduce((best, pair) => (score(pair) > score(best) ? pair : best)) }
}

export const strategic: Bot = (run) => {
  if (run.boonOffers.length > 0) return starting(run)
  if (run.spare) return keep(run)
  if (run.phase === 'reward') return reward(run)
  if (run.phase === 'recruit') return recruit(run)
  if (run.phase === 'battle') return deploy(run)
  if (run.phase === 'shop') return shop(run)
  if (run.phase === 'event') {
    const options = EVENTS[run.event!].options.flatMap((option, i) => (!option.can || option.can(run) ? [i] : []))
    return { type: 'choose', index: run.event === 'medic' ? options[0] : options.at(-1)! }
  }
  return current(run) ? { type: 'advance' } : route(run)
}
