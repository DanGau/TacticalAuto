import { FACILITIES, RARITY_CHANCE, type FacilityId, type Lasting, type Rarity } from './base'
import { ALIENS, alienStats, muster, type AlienKind } from './aliens'
import { GOALS, type Goal } from './goals'
import { BASE_STATS, createBattle, type Alien, type Battle, type Stats } from './battle'
import { CLASSES, type ClassId } from './classes'
import { EFFECTS, generateGear, SLOTS, type Gear, type Slot } from './gear'
import { RESISTS, type Keyword, type Resist } from './keywords'
import { RELIC_OFFERS, RELICS, type Relic, type RelicId } from './relics'
import { PATHS, SKILLS, type SkillId } from './skills'
import { ZONE_TERRAINS, type TerrainKind } from './terrain'
import { random, randomInt } from './rng'

/** Access keys needed to find the alien source; each is won at a satellite, at the end of a leg. */
export const KEYS = 3
/** Forks in the road on each leg, before its satellite. */
export const FORKS = 2
/** Threat at which the next stop becomes a last stand. */
export const THREAT_MAX = 6
/** Threat each stop adds, and what losing a battle adds on top. */
export const STOP_THREAT = 1
export const LOSS_THREAT = 1
/** The alien force a battle has in each leg, before its risk and kind are counted; the squad grows by one clone a leg. */
export const LEG_FORCE = [1, 4, 9, 15]
export const START_SUPPLIES = 3
/** What an assassination's commander has over a trooper. */
export const COMMANDER = { hp: 8, armor: 2 }
/** Supplies a supply drop gives. */
export const DROP_SUPPLIES = 4

/** Supplies a piece of gear sells for, by rarity. */
export const SELL: Record<Rarity, number> = { common: 2, rare: 3, epic: 5 }

/** What each level adds to a soldier's stats. */
export const LEVEL_STATS: Partial<Stats> = { hp: 1, aim: 0.02 }

const NAMES = ['Vega', 'Okafor', 'Lindqvist', 'Tanaka', 'Reyes', 'Novak', 'Haddad', 'Brandt', 'Silva', 'Kowalski', 'Mbeki', 'Dufour', 'Ivanov', 'Castillo', 'Ng', 'Shaw']

export type Risk = 'safe' | 'standard' | 'dangerous'

/** What each risk means for a zone: how its battles differ and what they pay. Its stops are set where zones are drawn. */
export const RISKS: Record<Risk, { name: string; aliens: number; supplies: number; drops: number; rareGear: boolean; text: string }> = {
  safe: { name: 'Quiet', aliens: -1, supplies: 1, drops: 0, rareGear: false, text: 'Fewer aliens and no gear, by the long way round' },
  standard: { name: 'Contested', aliens: 0, supplies: 2, drops: 1, rareGear: false, text: 'A fair fight' },
  dangerous: { name: 'Overrun', aliens: 1, supplies: 4, drops: 2, rareGear: true, text: 'More aliens; one fight, and two pieces of rare or better gear' },
}

/**
 * A stop on the road. A battle must be fought. A supply drop gives supplies and a cache gives gear, with no fight.
 * A key mission, at a satellite, wins an access key; the final mission strikes the alien source. Both have a boss.
 */
export type StopKind = 'battle' | 'supply' | 'cache' | 'key' | 'final'

/** A pack of aliens by name and kinds, mustered before it is equipped. */
export interface Muster {
  name: string
  kinds: AlienKind[]
}

/**
 * A stretch of road the squad commits to: its risk, the goal of its battles, the kind of place they are fought in,
 * and its stops, in order. `packs` holds the aliens each battle stop will send, mustered in advance so a fork can
 * show them; empty for other stops.
 */
export interface Zone {
  risk: Risk
  goal: Goal
  terrain: TerrainKind
  stops: StopKind[]
  packs: Muster[][]
}

/**
 * A battle to fight. A last stand comes when threat is full, in place of the next stop; losing it loses the run,
 * as does losing the final mission. `force` is what the aliens can muster: a trooper costs one, and some kinds
 * cost two or come in pairs.
 */
export interface Mission {
  kind: 'battle' | 'key' | 'final' | 'lastStand'
  goal: Goal
  risk: Risk
  force: number
}

export interface Soldier {
  id: number
  name: string
  xp: number
  /** Drawn at random when the clone is made. */
  cls: ClassId | null
  /** In the order learned; the first sets the soldier's path. */
  skills: SkillId[]
  gear: Record<Slot, Gear | null>
}

/** Gear a soldier found, waiting to be equipped on that soldier or sold. */
export interface Find {
  soldier: number
  gear: Gear
}

/** What the last stop changed, for the player to review. */
export interface Report {
  /** The stop: a mission fought, or an event met on the road. */
  stop: Mission['kind'] | 'supply' | 'cache'
  /** False only for a lost battle. */
  won: boolean
  /** Threat before the stop and after it. */
  threat: { before: number; after: number }
  supplies: number
  /** Whether an access key was won. */
  key: boolean
  /** Every soldier in the squad when a battle began, with the class each has after it; empty for an event. A downed soldier fell in the battle and is cloned anew. */
  soldiers: { name: string; cls: ClassId | null; xpBefore: number; xpAfter: number; downed: boolean }[]
  /** The name of a clone the stop added to the squad. */
  hired: string | null
  /** Civilians kept alive on a rescue; null on any other stop. */
  rescued: number | null
}

export interface Run {
  seed: number
  rng: number
  /** Access keys won; also the number of the leg under way, from 0. At KEYS, the final mission is all that remains. */
  keys: number
  /** Forks passed on this leg. */
  fork: number
  /** Zones to choose from at a fork; empty while travelling. */
  zones: Zone[]
  /** The zone being travelled; null at a fork. */
  zone: Zone | null
  /** Index of the next stop in the zone. */
  stop: number
  threat: number
  /** In the overworld the player builds and chooses a zone or travels on; in the reward phase, makes the choices a stop left. */
  phase: 'overworld' | 'battle' | 'reward' | 'won' | 'lost'
  /** The mission being fought or last fought. */
  mission: Mission | null
  /** The battle being fought or last fought. */
  battle: Battle | null
  /** Null until the first stop is done. */
  report: Report | null
  soldiers: Soldier[]
  nextSoldier: number
  supplies: number
  /** Gear found and not yet equipped or sold, decided in order. */
  finds: Find[]
  nextGear: number
  /** Facilities built, one entry per level. */
  built: FacilityId[]
  relics: RelicId[]
  /** Relics to choose from in the reward phase. */
  relicOffers: RelicId[]
  /** What each leg's boss resists, by keys won; known from the start so the squad can build to beat it. */
  bosses: Resist[]
}

/** Experience a soldier needs for a level; each level takes one more battle than the last, without end. */
export function xpFor(level: number): number {
  return (level * (level + 1)) / 2
}

/** A soldier's level, from experience; a soldier earns one experience per battle survived. */
export function level(soldier: { xp: number }): number {
  return Math.floor((Math.sqrt(8 * soldier.xp + 1) - 1) / 2)
}

/** The sum of one lasting effect over every facility level built and relic held. */
function total(run: Run, effect: (source: Lasting) => number | undefined): number {
  const sources: Lasting[] = [...run.built.map((id) => FACILITIES[id]), ...run.relics.map((id): Relic => RELICS[id])]
  return sources.reduce((sum, source) => sum + (effect(source) ?? 0), 0)
}

/**
 * The skills a soldier chooses the next from, or none if no choice is owed. A soldier learns a skill at each of its
 * first levels: first the core of one of its class's two paths, which shuts the other, then one of each tier's pair.
 */
export function skillOffers(soldier: Soldier): SkillId[] {
  if (!soldier.cls) return []
  const paths = PATHS[soldier.cls]
  const path = paths.find((p) => p.core === soldier.skills[0])
  if (soldier.skills.length >= Math.min(level(soldier), 1 + paths[0].tiers.length)) return []
  return path ? path.tiers[soldier.skills.length - 1] : paths.map((p) => p.core)
}

/** Learns the offered skill at `index`. */
export function takeSkill(run: Run, soldier: Soldier, index: number): void {
  soldier.skills.push(skillOffers(soldier)[index])
  settle(run)
}

export function built(run: Run, id: FacilityId): number {
  return run.built.filter((b) => b === id).length
}

/** Supplies the facility's next level costs, or null at its maximum. */
export function buildCost(run: Run, id: FacilityId): number | null {
  const facility = FACILITIES[id]
  return built(run, id) < facility.max ? facility.cost * (built(run, id) + 1) : null
}

/** Builds the facility's next level. The caller checks it is affordable. */
export function build(run: Run, id: FacilityId): void {
  run.supplies -= buildCost(run, id)!
  run.built.push(id)
}

export function equipped(soldier: Soldier): Gear[] {
  return SLOTS.flatMap((slot) => soldier.gear[slot] ?? [])
}

/** Equips the first find on the soldier who found it, selling what that soldier had in the slot. */
export function keepFind(run: Run): void {
  const { soldier: id, gear } = run.finds.shift()!
  const soldier = run.soldiers.find((s) => s.id === id)!
  const old = soldier.gear[gear.slot]
  if (old) run.supplies += SELL[old.rarity]
  soldier.gear[gear.slot] = gear
  settle(run)
}

/** Sells the first find. */
export function sellFind(run: Run): void {
  run.supplies += SELL[run.finds.shift()!.gear.rarity]
  settle(run)
}

/** Ends the reward phase once no choice is left: no relic, find or skill. */
function settle(run: Run): void {
  const owed = run.relicOffers.length > 0 || run.finds.length > 0 || run.soldiers.some((s) => skillOffers(s).length > 0)
  run.phase = owed ? 'reward' : 'overworld'
}

/** Uses of a soldier's class ability each battle: the class's, plus what skills and relics add to an ability that has uses. */
export function charges(run: Run, soldier: Soldier): number {
  const base = soldier.cls ? CLASSES[soldier.cls].charges : 0
  if (base === 0) return 0
  return base + soldier.skills.reduce((sum, id) => sum + (SKILLS[id].charges ?? 0), 0) + run.relics.reduce((sum, id) => sum + ((RELICS[id] as Relic).charges ?? 0), 0)
}

/** A soldier's stats in battle: base, plus class, level, skills and gear, plus facilities and relics. */
export function soldierStats(run: Run, soldier: Soldier): Stats {
  const stats = { ...BASE_STATS }
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const fromClass = soldier.cls ? (CLASSES[soldier.cls].stats[key] ?? 0) : 0
    const fromGear = equipped(soldier).reduce((sum, gear) => sum + (gear.stats[key] ?? 0), 0)
    const fromSkills = soldier.skills.reduce((sum, id) => sum + (SKILLS[id].stats?.[key] ?? 0), 0)
    stats[key] += fromClass + fromGear + fromSkills + level(soldier) * (LEVEL_STATS[key] ?? 0) + total(run, (u) => u.stats?.[key])
  }
  return stats
}

/**
 * Adds a clone to the squad and returns it. It arrives at level 1, or at the level of the squad's lowest if that is
 * higher, plus what the academy adds, so a late arrival is not left behind.
 */
function hire(run: Run): Soldier {
  const lowest = run.soldiers.length > 0 ? Math.min(...run.soldiers.map(level)) : 1
  const classes = Object.keys(CLASSES) as ClassId[]
  const free = NAMES.filter((name) => !run.soldiers.some((s) => s.name === name))
  const soldier: Soldier = {
    id: run.nextSoldier++,
    name: free[randomInt(run, free.length)],
    xp: 0,
    cls: classes[randomInt(run, classes.length)],
    skills: [],
    gear: { weapon: null, armor: null, utility: null },
  }
  run.soldiers.push(soldier)
  soldier.xp = xpFor(Math.max(1, lowest) + total(run, (u) => u.recruitRank))
  return soldier
}

/** How far along the road the squad is, which sets which packs appear and how much armor aliens wear: two steps a leg, the second at its last fork. */
function depth(run: Run): number {
  return run.keys * 2 + (run.fork >= FORKS ? 1 : 0)
}

/** The mission the squad would fight at a stop of the given kind now. Its force follows the leg, and so the size of the squad. */
export function missionAt(run: Run, kind: Mission['kind'], risk: Risk, goal: Goal = 'exterminate'): Mission {
  const extra = { battle: 0, key: 1, final: 2, lastStand: run.keys }[kind]
  return { kind, goal, risk, force: Math.max(1, LEG_FORCE[run.keys] + (run.fork >= FORKS ? 1 : 0) + extra + RISKS[risk].aliens + GOALS[goal].force) }
}

/**
 * The aliens of a mission, in pods: packs mustered at random for its force. A kind's health and aim never change;
 * deeper along the road aliens are better equipped: a point of armor each step, a point of damage every second. A key or final mission adds a boss, a trooper built up by the keys
 * already won: each adds health, armor and an escorting trooper; from the second satellite on it hits harder and
 * spawns swarmlings, and from the third it shoots farther.
 */
function packsOf(run: Run, mission: Mission, mustered?: Muster[]): { name: string; aliens: Alien[] }[] {
  const tier = depth(run)
  const armor = tier
  const weapon = Math.floor(tier / 2)
  const alien = (kind: Alien['kind']): Alien => ({ kind, stats: alienStats(kind, armor, weapon), stance: ALIENS[kind].stance, boss: false, spawns: false, target: false, resists: ALIENS[kind].resists })
  const boss = mission.kind === 'key' || mission.kind === 'final'
  const escort = boss ? run.keys : 0
  const packs = (mustered ?? muster(run, Math.max(0, mission.force - (boss ? 2 + escort : 0)), tier)).map((pack) => ({ name: pack.name, aliens: pack.kinds.map(alien) }))
  // An assassination's commander: a trooper tougher than its kind, with a guard.
  if (mission.goal === 'assassinate') {
    const commander = alien('trooper')
    commander.stats = { ...commander.stats, hp: commander.stats.hp + COMMANDER.hp, armor: commander.stats.armor + COMMANDER.armor, damage: commander.stats.damage + 1 }
    packs.unshift({ name: 'Commander', aliens: [{ ...commander, target: true, stance: 'anchor' }, alien('trooper')] })
  }
  if (boss) {
    const k = run.keys
    const stats: Stats = { ...BASE_STATS, hp: BASE_STATS.hp + 5 * k, armor: 2 + k, damage: BASE_STATS.damage + (k >= 1 ? 1 : 0), range: BASE_STATS.range + (k >= 2 ? 1 : 0) }
    const escorts = Array.from({ length: escort }, () => alien('trooper'))
    packs.unshift({ name: mission.kind === 'final' ? 'The source' : 'Guardian', aliens: [{ kind: 'trooper', stats, stance: 'balanced', boss: true, spawns: k >= 1, target: false, resists: [run.bosses[k]] }, ...escorts] })
  }
  return packs
}

/** A goal drawn by GOALS' weights. */
function drawGoal(run: Run): Goal {
  const goals = Object.keys(GOALS) as Goal[]
  let roll = random(run) * goals.reduce((sum, goal) => sum + GOALS[goal].weight, 0)
  return goals.find((goal) => (roll -= GOALS[goal].weight) < 0) ?? 'exterminate'
}

/**
 * The three zones at a fork, one of each risk, each with a goal: a quiet one is long, an overrun one is a single
 * hard fight. Their battles are mustered as they will be once the squad has taken the fork.
 */
function drawZones(run: Run): Zone[] {
  const event = (): StopKind => (random(run) < 0.5 ? 'supply' : 'cache')
  const shuffled = (stops: StopKind[]) => {
    const [first] = stops.splice(randomInt(run, stops.length), 1)
    return [first, ...stops]
  }
  const terrain = () => ZONE_TERRAINS[randomInt(run, ZONE_TERRAINS.length)]
  const ahead = { ...run, fork: run.fork + 1 }
  const zone = (risk: Risk, stops: StopKind[]): Zone => {
    const goal = drawGoal(run)
    const force = missionAt(ahead, 'battle', risk, goal).force
    const packs = stops.map((stop) => (stop === 'battle' ? muster(run, force, depth(ahead)).map(({ name, kinds }) => ({ name, kinds })) : []))
    return { risk, goal, terrain: terrain(), stops, packs }
  }
  return [zone('safe', shuffled(['battle', event(), 'battle'])), zone('standard', ['battle', 'battle']), zone('dangerous', ['battle'])]
}

/** Sets what lies ahead once a zone is done or a run begins: a fork, the leg's satellite, or the alien source. */
function nextStretch(run: Run): void {
  run.stop = 0
  run.zone = null
  run.zones = []
  if (run.keys === KEYS) run.zone = { risk: 'standard', goal: 'exterminate', terrain: 'hive', stops: ['final'], packs: [[]] }
  else if (run.fork === FORKS) run.zone = { risk: 'standard', goal: 'exterminate', terrain: 'compound', stops: ['key'], packs: [[]] }
  else run.zones = drawZones(run)
}

export function createRun(seed: number): Run {
  const run: Run = {
    seed,
    rng: seed,
    keys: 0,
    fork: 0,
    zones: [],
    zone: null,
    stop: 0,
    threat: 0,
    phase: 'overworld',
    mission: null,
    battle: null,
    report: null,
    soldiers: [],
    nextSoldier: 1,
    supplies: START_SUPPLIES,
    finds: [],
    nextGear: 1,
    built: [],
    relics: [],
    relicOffers: [],
    bosses: [],
  }
  hire(run)
  nextStretch(run)
  settle(run)
  const resists = Object.keys(RESISTS) as Resist[]
  run.bosses = Array.from({ length: KEYS + 1 }, () => resists[randomInt(run, resists.length)])
  return run
}

/** Commits the squad to one of the zones at a fork. */
export function enterZone(run: Run, zone: Zone): void {
  run.zone = zone
  run.zones = []
  run.fork++
}

/** The stop the squad travels to next: a last stand if threat is full, else the zone's next stop. Null at a fork. */
export function nextStop(run: Run): StopKind | 'lastStand' | null {
  if (!run.zone) return null
  return run.threat >= THREAT_MAX ? 'lastStand' : run.zone.stops[run.stop]
}

/** A random rarity; `lucky` rules out common. */
function rollRarity(run: Run, lucky: boolean): Rarity {
  let roll = random(run)
  if (lucky) roll = RARITY_CHANCE.common + roll * (1 - RARITY_CHANCE.common)
  return roll < RARITY_CHANCE.common ? 'common' : roll < RARITY_CHANCE.common + RARITY_CHANCE.rare ? 'rare' : 'epic'
}

/** A piece of gear found by a soldier drawn at random. */
function dropGear(run: Run, lucky: boolean): void {
  const gear = generateGear(run, run.nextGear++, rollRarity(run, lucky))
  run.finds.push({ soldier: run.soldiers[randomInt(run, run.soldiers.length)].id, gear })
}

/** Moves past the zone's current stop; past its last, sets what lies ahead. */
function passStop(run: Run): void {
  run.stop++
  if (run.stop === run.zone!.stops.length) nextStretch(run)
}

/** Travels to the next stop. A battle begins; a supply drop or cache is collected at once. */
export function advance(run: Run): void {
  const zone = run.zone!
  const stop = nextStop(run)!
  if (stop === 'supply' || stop === 'cache') {
    const before = run.threat
    run.threat = Math.min(run.threat + STOP_THREAT, THREAT_MAX)
    const supplies = stop === 'supply' ? DROP_SUPPLIES : 0
    run.supplies += supplies
    if (stop === 'cache') dropGear(run, RISKS[zone.risk].rareGear || run.relics.some((id) => (RELICS[id] as Relic).rareGear))
    run.report = { stop, won: true, threat: { before, after: run.threat }, supplies, key: false, soldiers: [], hired: null, rescued: null }
    passStop(run)
    settle(run)
    return
  }
  const mission = missionAt(run, stop, zone.risk, stop === 'battle' ? zone.goal : 'exterminate')
  run.mission = mission
  run.phase = 'battle'
  const reserve = run.soldiers.map((s) => ({
    soldier: s.id,
    stats: soldierStats(run, s),
    ability: s.cls && CLASSES[s.cls].ability,
    charges: charges(run, s),
    stance: s.cls ? CLASSES[s.cls].stance : ('balanced' as const),
    effects: [...equipped(s).flatMap((gear) => gear.effect ?? []), ...s.skills.flatMap((id) => SKILLS[id].effect ?? []), ...run.relics.flatMap((id): Relic['effect'][] => [RELICS[id].effect]).flatMap((effect) => effect ?? [])],
  }))
  run.battle = createBattle(randomInt(run, 2 ** 31), zone.terrain, packsOf(run, mission, stop === 'battle' ? zone.packs[run.stop] : undefined), reserve, mission.goal)
}

/**
 * Settles a finished battle: experience, threat, rewards, and where the squad stands on the road.
 * A soldier who fell is cloned anew and stays in the squad with everything they had; only those still standing
 * gain experience.
 */
export function endBattle(run: Run): void {
  const battle = run.battle!
  const mission = run.mission!
  const standing = new Set(battle.units.map((u) => u.soldier))
  const xpBefore = run.soldiers.map((s) => s.xp)
  const won = battle.winner === 'human'
  // A rescue won pays each standing soldier a point of experience for each civilian kept alive.
  const rescued = mission.goal === 'rescue' ? battle.units.filter((u) => u.civilian).length : null
  for (const s of run.soldiers) if (standing.has(s.id)) s.xp += 1 + (won ? (rescued ?? 0) : 0)
  const soldiers = run.soldiers.map((s, i) => ({ name: s.name, cls: s.cls, xpBefore: xpBefore[i], xpAfter: s.xp, downed: !standing.has(s.id) }))

  const before = run.threat
  const risk = RISKS[mission.risk]
  // A last stand won empties the threat; any other battle is a stop, and adds to it.
  if (mission.kind === 'lastStand') run.threat = won ? 0 : run.threat
  else run.threat = Math.min(run.threat + STOP_THREAT + (won ? 0 : LOSS_THREAT), THREAT_MAX)
  const held = run.relics.map((id): Relic => RELICS[id])
  const supplies = won ? risk.supplies * (mission.goal === 'raid' ? 3 : 1) + held.reduce((sum, relic) => sum + (relic.supplies ?? 0), 0) : 0
  run.supplies += supplies
  // A won battle drops gear by its goal; a key mission's, a last stand's or an assassination's is rare or better.
  const byGoal = { exterminate: risk.drops, assassinate: Math.max(1, risk.drops), hold: 0, rescue: 0, raid: 0 }[mission.goal]
  const drops = won && mission.kind !== 'final' ? (mission.kind === 'battle' ? byGoal : 1) : 0
  for (let i = 0; i < drops; i++) dropGear(run, risk.rareGear || mission.kind !== 'battle' || mission.goal === 'assassinate' || held.some((relic) => relic.rareGear))
  const key = won && mission.kind === 'key'
  // Each key won brings a new clone to the squad.
  const hired = key ? hire(run).name : null
  run.report = { stop: mission.kind, won, threat: { before, after: run.threat }, supplies, key, soldiers, hired, rescued }

  if (mission.kind === 'final' || (mission.kind === 'lastStand' && !won)) {
    run.phase = won ? 'won' : 'lost'
    return
  }
  // A key mission lost is fought again; a last stand stands in front of the stop it interrupted.
  if (key) {
    run.keys++
    run.fork = 0
  }
  if (mission.kind === 'battle' || key) passStop(run)
  // A satellite, a last stand or a hold won offers relics.
  if (won && (mission.kind !== 'battle' || mission.goal === 'hold')) {
    const pool = (Object.keys(RELICS) as RelicId[]).filter((id) => !run.relics.includes(id))
    // The first offer builds on a keyword the squad already has, when one can.
    const held = squadKeywords(run)
    const fits = pool.filter((id) => RELICS[id].tags?.some((tag) => held.includes(tag)))
    if (fits.length > 0) run.relicOffers.push(...pool.splice(pool.indexOf(fits[randomInt(run, fits.length)]), 1))
    while (run.relicOffers.length < RELIC_OFFERS && pool.length > 0) run.relicOffers.push(...pool.splice(randomInt(run, pool.length), 1))
  }
  settle(run)
}

/** The keywords of everything the squad has: its soldiers' skills and gear, and its relics. */
export function squadKeywords(run: Run): Keyword[] {
  const tags = [
    ...run.soldiers.flatMap((s) => [...s.skills.map((id) => SKILLS[id].tags ?? []), ...equipped(s).map((gear) => (gear.effect && EFFECTS[gear.effect].tags) || [])]),
    ...run.relics.map((id) => RELICS[id].tags ?? []),
  ].flat()
  return [...new Set(tags)]
}

/** Takes an offered relic. */
export function takeRelic(run: Run, id: RelicId): void {
  run.relics.push(id)
  run.relicOffers = []
  settle(run)
}
