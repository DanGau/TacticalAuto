// Missions: their force, aliens, goal, and where they are fought.
import { type Alien, BASE_STATS } from './battle'
import { type AlienKind, alienStats, ALIENS, muster } from './aliens'
import { type Goal, GOALS } from './goals'
import { depth, late, THREAT_MAX } from './progress'
import { type Run } from './run-state'
import { type Mission } from './run-state'
import { type Stop } from './run-state'
import { type Risk } from './run-state'
import { soldierStats } from './squad'
import { TUNING } from './tuning'
import { random, randomInt } from './rng'
import { type RegionId, REGION_IDS, REGIONS } from './regions'
import { ZONE_TERRAINS, type TerrainKind } from './terrain'
import { CONTINENTS } from './world'
import { drawTwist } from './twists'
import { bigOneStats, drawChallenge, forceOf, rungOf, sentries, STIFFEN, type ChallengeId } from './challenges'

/** What each risk means for a battle: how many aliens it has, what it pays, and the chance it drops gear on the goals that do, and of a utility. */
export const RISKS: Record<Risk, { name: string; aliens: number; supplies: number; gear: number; rareGear: boolean; utility: number; text: string }> = {
  safe: { name: 'Quiet', aliens: -1, supplies: 1, gear: 0, rareGear: false, utility: 0, text: 'Fewer aliens, and no gear' },
  standard: { name: 'Contested', aliens: 0, supplies: 2, gear: 0.5, rareGear: false, utility: 0.025, text: 'A fair fight, and an even chance of gear' },
  dangerous: { name: 'Overrun', aliens: 1, supplies: TUNING.dangerSupplies, gear: 1, rareGear: true, utility: 0.06, text: 'More aliens, and a piece of rare or better gear' },
}

/** What an assassination's commander has over a trooper, its guards (a trooper, then aegises), and the depth from which it has one more. */
export const COMMANDER = { hp: 6, armor: 2, guards: 2, moreFrom: 3 }

/** The force the hunt adds to a mission: at full threat, TUNING.hunt of its own. */
export const huntForce = (run: Run, mission: Mission) => Math.round((mission.force * TUNING.hunt * run.threat) / THREAT_MAX)

/** The mission the squad would fight at a stop of the given kind now. Its force follows the leg, and so the size of the squad. */
export function missionAt(run: Run, kind: Mission['kind'], risk: Risk, goal: Goal = 'exterminate'): Mission {
  // A recovery's aliens come at two thirds of their strength.
  const extra = { battle: 0, key: 1, final: 0, ambush: run.keys, recovery: -Math.ceil(TUNING.legForce[run.keys] / 3) }[kind]
  return { kind, goal, risk, force: Math.max(1, TUNING.legForce[run.keys] + (late(run) ? 1 : 0) + extra + RISKS[risk].aliens + GOALS[goal].force) }
}

/**
 * The aliens of a mission: mustered at random for its force. A kind's health never changes;
 * deeper along the road aliens are better equipped: a point of armor each step, a point of damage every second. A key or final mission adds a boss, a trooper built up by the keys
 * already won: each adds health, armor and an escort, a zealot and a vise in turn; from the second satellite on it hits harder and
 * spawns swarmlings, and from the third it shoots farther.
 */
export function aliensOf(run: Run, mission: Mission, mustered?: AlienKind[], challenge: ChallengeId | null = null): Alien[] {
  const tier = depth(run)
  const armor = tier
  const weapon = Math.floor(tier / 2)
  const alien = (kind: Alien['kind']): Alien => ({ kind, stats: alienStats(kind, armor, weapon), stance: ALIENS[kind].stance, boss: false, spawns: ALIENS[kind].spawns ?? false, target: false, resists: ALIENS[kind].resists })
  const extraction = mission.kind === 'key' || mission.kind === 'final'
  const boss = extraction || challenge === 'bigOne'
  const escort = extraction ? run.keys : 0
  // The hunt sends more the higher the threat.
  const hunting = muster(run, huntForce(run, mission), tier).flatMap((pack) => pack.kinds)
  const aliens = [...(mustered ?? muster(run, Math.max(0, mission.force - (boss ? 2 + escort : 0)), tier).flatMap((pack) => pack.kinds)), ...hunting].map(alien)
  // An assassination's commander: a trooper tougher than its kind, with its guards.
  if (mission.goal === 'assassinate') {
    const commander = alien('trooper')
    commander.stats = { ...commander.stats, hp: commander.stats.hp + COMMANDER.hp, armor: commander.stats.armor + COMMANDER.armor, damage: commander.stats.damage + 1 }
    const guards = Array.from({ length: COMMANDER.guards + (tier >= COMMANDER.moreFrom ? 1 : 0) }, (_, i) => alien(i === 0 ? 'trooper' : 'aegis'))
    aliens.unshift({ ...commander, target: true, stance: 'anchor' }, ...guards)
  }
  // A terror site's harvesters, more of them deeper along the road.
  if (mission.goal === 'rescue') aliens.unshift(...Array.from({ length: tier >= HARVESTERS_MORE_FROM ? 2 : 1 }, () => alien('harvester')))
  // An ambush's Hunter: a mini-boss about half again as strong as the squad's strongest soldier, that runs it down.
  if (mission.goal === 'ambush') {
    const best = run.soldiers.map((s) => soldierStats(run, s)).reduce((a, b) => (b.hp * b.damage > a.hp * a.damage ? b : a))
    const trooper = alien('trooper')
    const stats = { ...best, hp: Math.round(best.hp * HUNTER.hp), damage: Math.ceil(best.damage * HUNTER.damage), armor: Math.max(best.armor, trooper.stats.armor) + 1, move: best.move + 1 }
    aliens.unshift({ ...trooper, stats, boss: true, stance: 'rush' })
  }
  const stiff = challenge && STIFFEN[challenge]
  if (stiff) {
    const party = Math.min(run.soldiers.length, 3) - 1
    for (const a of aliens) a.stats = { ...a.stats, range: a.stats.range > 1 ? a.stats.range + (stiff.range ?? 0) : a.stats.range, armor: a.stats.armor + (stiff.armor?.[party] ?? 0) }
    if (stiff.range) for (const a of aliens) a.stance = 'anchor'
  }
  if (challenge === 'scattered') for (const a of aliens.slice(0, sentries(mustered?.length ?? 0))) a.stance = 'anchor'
  if (boss) {
    const k = run.keys
    const rung = extraction ? 2 : rungOf(run.stop)
    const big = bigOneStats(run.soldiers.length, rung, BASE_STATS)
    // A leg's boss is the build's test: long to kill, so a squad whose pieces pay off ends it sooner, but no harder hitting.
    const stats = { ...big, ...(extraction ? { hp: Math.round(big.hp * LEG_BOSS.hp), damage: big.damage - LEG_BOSS.damage } : {}), range: BASE_STATS.range + (k >= 2 ? 1 : 0) }
    const escorts = Array.from({ length: escort }, (_, i) => alien(i % 2 === 0 ? 'zealot' : 'vise'))
    aliens.unshift({ kind: 'trooper', stats, stance: 'balanced', boss: true, spawns: extraction && k >= 1, target: false, resists: [], exam: run.bosses[k] }, ...escorts)
  }
  return aliens
}

/** The depth from which a rescue has a second harvester. */
export const HARVESTERS_MORE_FROM = 2

/** What a leg's boss multiplies its health by, and the damage it does less. */
export const LEG_BOSS = { hp: 3.2, damage: 4 }

/** What an ambush's Hunter multiplies the strongest soldier's health and damage by. */
export const HUNTER = { hp: 2, damage: 1.2 }

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

/** A battle of `risk` with a goal and place drawn at random, and from the second leg a challenge, its aliens mustered for the squad as it will be at `when`. */
export function drawBattle(run: Run, risk: Risk, when: Run = run, taken: ChallengeId[] = []): Stop {
  const goal = drawGoal(run, when)
  const party = Math.max(1, run.soldiers.length)
  const rung = rungOf(when.stop)
  // The first leg is normal fights, so the squad builds a kit before its first test.
  const challenge = when.keys === 0 ? null : drawChallenge(run, party, rung, goal, taken)
  // Each battle's force varies a little either way, so two battles of one risk are not the same fight.
  const aliens = challenge ? forceOf(challenge, party, rung, RISKS[risk].aliens + GOALS[goal].force + randomInt(run, 3) - 1) : []
  const terrain = ZONE_TERRAINS[randomInt(run, ZONE_TERRAINS.length)]
  return { kind: 'battle', risk, goal, terrain, challenge, twist: drawTwist(run, when.keys), aliens, ...placed(run, terrain) }
}

/** How hard a stop is: a battle counts one, a quiet one none and an overrun one two. */
export const danger = (stop: Stop) => (stop.kind === 'battle' ? 1 + RISKS[stop.risk].aliens : 0)
