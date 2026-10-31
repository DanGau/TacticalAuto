// Missions: their force, alien packs, goal, and where they are fought.
import { type Alien, type Stats, BASE_STATS } from './battle'
import { alienStats, ALIENS, muster } from './aliens'
import { type Goal, GOALS } from './goals'
import { depth, late, THREAT_MAX } from './progress'
import { type Run } from './run-state'
import { type Mission } from './run-state'
import { type Stop } from './run-state'
import { type Muster } from './run-state'
import { type Risk } from './run-state'
import { soldierStats } from './squad'
import { TUNING } from './tuning'
import { random, randomInt } from './rng'
import { type RegionId, REGION_IDS, REGIONS } from './regions'
import { ZONE_TERRAINS, type TerrainKind } from './terrain'
import { CONTINENTS } from './world'
import { drawTwist } from './twists'

/** What each risk means for a battle: how many aliens it has, what it pays, and the chance it drops gear on the goals that do. */
export const RISKS: Record<Risk, { name: string; aliens: number; supplies: number; gear: number; rareGear: boolean; text: string }> = {
  safe: { name: 'Quiet', aliens: -1, supplies: 1, gear: 0, rareGear: false, text: 'Fewer aliens, and no gear' },
  standard: { name: 'Contested', aliens: 0, supplies: 2, gear: 0.5, rareGear: false, text: 'A fair fight, and an even chance of gear' },
  dangerous: { name: 'Overrun', aliens: 1, supplies: TUNING.dangerSupplies, gear: 1, rareGear: true, text: 'More aliens, and a piece of rare or better gear' },
}

/** What an assassination's commander has over a trooper, its guards, and the depth from which it has one more. */
export const COMMANDER = { hp: 6, armor: 2, guards: 2, moreFrom: 3 }

/** The force the hunt adds to a mission: at full threat, TUNING.hunt of its own. */
export const huntForce = (run: Run, mission: Mission) => Math.round((mission.force * TUNING.hunt * run.threat) / THREAT_MAX)

/** The mission the squad would fight at a stop of the given kind now. Its force follows the leg, and so the size of the squad. */
export function missionAt(run: Run, kind: Mission['kind'], risk: Risk, goal: Goal = 'exterminate'): Mission {
  // A recovery's aliens come at a third of their strength, but keep coming.
  const extra = { battle: 0, key: 1, final: 0, ambush: run.keys, recovery: -Math.ceil((2 * TUNING.legForce[run.keys]) / 3) }[kind]
  return { kind, goal, risk, force: Math.max(1, TUNING.legForce[run.keys] + (late(run) ? 1 : 0) + extra + RISKS[risk].aliens + GOALS[goal].force) }
}

/**
 * The aliens of a mission, in pods: packs mustered at random for its force. A kind's health never changes;
 * deeper along the road aliens are better equipped: a point of armor each step, a point of damage every second. A key or final mission adds a boss, a trooper built up by the keys
 * already won: each adds health, armor and an escorting trooper; from the second satellite on it hits harder and
 * spawns swarmlings, and from the third it shoots farther.
 */
export function packsOf(run: Run, mission: Mission, mustered?: Muster[]): { name: string; aliens: Alien[] }[] {
  const tier = depth(run)
  const armor = tier
  const weapon = Math.floor(tier / 2)
  const alien = (kind: Alien['kind']): Alien => ({ kind, stats: alienStats(kind, armor, weapon), stance: ALIENS[kind].stance, boss: false, spawns: ALIENS[kind].spawns ?? false, target: false, resists: ALIENS[kind].resists })
  const boss = mission.kind === 'key' || mission.kind === 'final'
  const escort = boss ? run.keys : 0
  // The hunt sends more packs the higher the threat.
  const hunting = muster(run, huntForce(run, mission), tier)
  const packs = [...(mustered ?? muster(run, Math.max(0, mission.force - (boss ? 2 + escort : 0)), tier)), ...hunting].map((pack) => ({ name: pack.name, aliens: pack.kinds.map(alien) }))
  // An assassination's commander: a trooper tougher than its kind, with its guards.
  if (mission.goal === 'assassinate') {
    const commander = alien('trooper')
    commander.stats = { ...commander.stats, hp: commander.stats.hp + COMMANDER.hp, armor: commander.stats.armor + COMMANDER.armor, damage: commander.stats.damage + 1 }
    const guards = Array.from({ length: COMMANDER.guards + (tier >= COMMANDER.moreFrom ? 1 : 0) }, () => alien('trooper'))
    packs.unshift({ name: 'Commander', aliens: [{ ...commander, target: true, stance: 'anchor' }, ...guards] })
  }
  // A terror site's harvesters, more of them deeper along the road.
  if (mission.goal === 'rescue') packs.unshift({ name: 'Harvesters', aliens: Array.from({ length: tier >= HARVESTERS_MORE_FROM ? 2 : 1 }, () => alien('harvester')) })
  // An ambush's Hunter: a mini-boss about half again as strong as the squad's strongest soldier, that runs it down.
  if (mission.goal === 'ambush') {
    const best = run.soldiers.map((s) => soldierStats(run, s)).reduce((a, b) => (b.hp * b.damage > a.hp * a.damage ? b : a))
    const trooper = alien('trooper')
    const stats: Stats = { ...best, hp: Math.round(best.hp * HUNTER.hp), damage: Math.ceil(best.damage * HUNTER.damage), armor: Math.max(best.armor, trooper.stats.armor) + 1, move: best.move + 1 }
    packs.unshift({ name: 'The Hunter', aliens: [{ ...trooper, stats, boss: true, stance: 'rush' }] })
  }
  if (boss) {
    const k = run.keys
    const stats: Stats = { ...BASE_STATS, hp: BASE_STATS.hp + 5 * k, armor: 2 + k, damage: BASE_STATS.damage + (k >= 1 ? 1 : 0), range: BASE_STATS.range + (k >= 2 ? 1 : 0) }
    const escorts = Array.from({ length: escort }, () => alien('trooper'))
    packs.unshift({ name: mission.kind === 'final' ? 'The source' : 'Guardian', aliens: [{ kind: 'trooper', stats, stance: 'balanced', boss: true, spawns: k >= 1, target: false, resists: [run.bosses[k]] }, ...escorts] })
  }
  return packs
}

/** The depth from which a rescue has a second harvester. */
export const HARVESTERS_MORE_FROM = 2

/** What an ambush's Hunter multiplies the strongest soldier's health and damage by. */
export const HUNTER = { hp: 1.3, damage: 1.2 }

/** A goal drawn by GOALS' weights, among those the leg of `when` has. */
export function drawGoal(run: Run, when: Run): Goal {
  const goals = (Object.keys(GOALS) as Goal[]).filter((goal) => GOALS[goal].from <= when.keys)
  let roll = random(run) * goals.reduce((sum, goal) => sum + GOALS[goal].weight, 0)
  return goals.find((goal) => (roll -= GOALS[goal].weight) < 0) ?? 'exterminate'
}

/** Where on the continent under way a battle of `kind` is fought: a region it is built like there, and a city of it. */
export function placed(run: Run, kind: TerrainKind): { region: RegionId; city: string } {
  const continent = run.route[run.keys]?.continent
  const native: RegionId[] = continent ? CONTINENTS[continent].regions : REGION_IDS
  const fit = native.filter((id) => (REGIONS[id].kinds as TerrainKind[]).includes(kind))
  const options = fit.length > 0 ? fit : native
  const region = options[randomInt(run, options.length)]
  const cities = REGIONS[region].cities
  return { region, city: cities[randomInt(run, cities.length)] }
}

/** A battle of `risk` with a goal and place drawn at random, its aliens mustered for the squad as it will be at `when`. */
export function drawBattle(run: Run, risk: Risk, when: Run = run): Stop {
  const goal = drawGoal(run, when)
  const force = missionAt(when, 'battle', risk, goal).force
  // Each battle's force varies a little either way, so two battles of one risk are not the same fight.
  const packs = muster(run, Math.max(1, force + randomInt(run, 3) - 1), depth(when)).map(({ name, kinds }) => ({ name, kinds }))
  const terrain = ZONE_TERRAINS[randomInt(run, ZONE_TERRAINS.length)]
  return { kind: 'battle', risk, goal, terrain, twist: drawTwist(run, when.keys), packs, ...placed(run, terrain) }
}

/** How hard a stop is: a battle counts one, a quiet one none and an overrun one two. */
export const danger = (stop: Stop) => (stop.kind === 'battle' ? 1 + RISKS[stop.risk].aliens : 0)
