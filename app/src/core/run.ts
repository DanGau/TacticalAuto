import { AID, FACILITIES, RARITY_CHANCE, type AidId, type FacilityId, type Lasting, type Rarity } from './base'
import { BASE_STATS, createBattle, type Alien, type Battle, type Stats } from './battle'
import { CLASSES, type ClassId } from './classes'
import { generateGear, SLOTS, type Gear, type Slot } from './gear'
import { TERRAIN_KINDS, type TerrainKind } from './terrain'
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
export const BASE_SQUAD = 4
export const OFFERS = 3
export const START_SUPPLIES = 3
/** Supplies a supply drop gives. */
export const DROP_SUPPLIES = 4

/** Experience needed for each rank; a soldier earns one per battle survived. */
export const RANK_XP = [0, 1, 3, 6, 10]
export const RANK_NAMES = ['Rookie', 'Squaddie', 'Corporal', 'Sergeant', 'Captain']
/** What each rank adds to a soldier's stats. */
export const RANK_STATS: Partial<Stats> = { hp: 1, aim: 0.03 }

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

/** A stretch of road the squad commits to: its risk, the kind of place its battles are fought in, and its stops, in order. */
export interface Zone {
  risk: Risk
  terrain: TerrainKind
  stops: StopKind[]
}

/** A battle to fight. A last stand comes when threat is full, in place of the next stop; losing it loses the run, as does losing the final mission. */
export interface Mission {
  kind: 'battle' | 'key' | 'final' | 'lastStand'
  risk: Risk
  aliens: number
}

export interface Soldier {
  id: number
  name: string
  xp: number
  /** Null for a rookie; drawn at random on first promotion. */
  cls: ClassId | null
  /** The id of the gear in each slot. */
  gear: Record<Slot, number | null>
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
  gear: Gear[]
  /** Whether an access key was won. */
  key: boolean
  /** Every soldier in the squad when a battle began, with the class each has after it; empty for an event. */
  soldiers: { name: string; cls: ClassId | null; xpBefore: number; xpAfter: number; died: boolean }[]
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
  /** In the overworld the player builds, equips, and chooses a zone or travels on. */
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
  /** Every piece of gear the base owns. A piece no living soldier holds is in the stash. */
  gear: Gear[]
  nextGear: number
  /** Facilities built, one entry per level. */
  built: FacilityId[]
  /** Aid taken. */
  aid: AidId[]
  /** Aid to choose from in the reward phase. */
  offers: AidId[]
}

export function rank(soldier: { xp: number }): number {
  return RANK_XP.findLastIndex((xp) => soldier.xp >= xp)
}

/** The sum of one lasting effect over every facility level built and aid taken. */
function total(run: Run, effect: (source: Lasting) => number | undefined): number {
  const sources: Lasting[] = [...run.built.map((id) => FACILITIES[id]), ...run.aid.map((id) => AID[id])]
  return sources.reduce((sum, source) => sum + (effect(source) ?? 0), 0)
}

export function level(run: Run, id: FacilityId): number {
  return run.built.filter((b) => b === id).length
}

/** Supplies the facility's next level costs, or null at its maximum. */
export function buildCost(run: Run, id: FacilityId): number | null {
  const facility = FACILITIES[id]
  return level(run, id) < facility.max ? facility.cost * (level(run, id) + 1) : null
}

/** Builds the facility's next level. The caller checks it is affordable. */
export function build(run: Run, id: FacilityId): void {
  run.supplies -= buildCost(run, id)!
  run.built.push(id)
  recruit(run)
}

export function squadSize(run: Run): number {
  return BASE_SQUAD + total(run, (u) => u.squad)
}

/** The gear a soldier has equipped. */
export function equipped(run: Run, soldier: Soldier): Gear[] {
  return SLOTS.flatMap((slot) => run.gear.filter((gear) => gear.id === soldier.gear[slot]))
}

/** The soldier holding a piece of gear, if any. */
export function holder(run: Run, gear: Gear): Soldier | undefined {
  return run.soldiers.find((soldier) => soldier.gear[gear.slot] === gear.id)
}

/** Gives a piece of gear to a soldier, taking it from whoever held it; what the soldier had in that slot returns to the stash. */
export function equip(run: Run, soldier: Soldier, gear: Gear): void {
  const previous = holder(run, gear)
  if (previous) previous.gear[gear.slot] = null
  soldier.gear[gear.slot] = gear.id
}

/** A soldier's stats in battle: base, plus class, plus rank, plus gear, plus facilities and aid. */
export function soldierStats(run: Run, soldier: Soldier): Stats {
  const stats = { ...BASE_STATS }
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const fromClass = soldier.cls ? (CLASSES[soldier.cls].stats[key] ?? 0) : 0
    const fromGear = equipped(run, soldier).reduce((sum, gear) => sum + (gear.stats[key] ?? 0), 0)
    stats[key] += fromClass + fromGear + rank(soldier) * (RANK_STATS[key] ?? 0) + total(run, (u) => u.stats?.[key])
  }
  return stats
}

/** Gives every promoted soldier still without a class one at random. */
function assignClasses(run: Run): void {
  const ids = Object.keys(CLASSES) as ClassId[]
  for (const soldier of run.soldiers) {
    if (soldier.cls === null && rank(soldier) > 0) soldier.cls = ids[randomInt(run, ids.length)]
  }
}

/** Fills the squad with recruits, each named unlike the living. */
function recruit(run: Run): void {
  const xp = RANK_XP[Math.min(total(run, (u) => u.recruitRank), RANK_XP.length - 1)]
  while (run.soldiers.length < squadSize(run)) {
    const free = NAMES.filter((name) => !run.soldiers.some((s) => s.name === name))
    run.soldiers.push({ id: run.nextSoldier++, name: free[randomInt(run, free.length)], xp, cls: null, gear: { weapon: null, armor: null, utility: null } })
  }
  assignClasses(run)
}

/** How far along the road the squad is, which sets how strong the aliens are: two steps a leg, the second at its last fork. */
function depth(run: Run): number {
  return run.keys * 2 + (run.fork >= FORKS ? 1 : 0)
}

/** The mission the squad would fight at a stop of the given kind now. */
export function missionAt(run: Run, kind: Mission['kind'], risk: Risk): Mission {
  const extra = { battle: 0, key: 1, final: 2, lastStand: 4 }[kind]
  return { kind, risk, aliens: 4 + depth(run) + extra + RISKS[risk].aliens }
}

/** The aliens of a mission. Each step of depth adds health and aim; deep in, damage too. A key or final mission has a boss. */
function aliensOf(run: Run, mission: Mission): Alien[] {
  const tier = depth(run)
  const stats: Stats = { ...BASE_STATS, hp: BASE_STATS.hp + Math.round(2.5 * tier), aim: BASE_STATS.aim + 0.03 * tier, damage: BASE_STATS.damage + (tier >= 5 ? 1 : 0) }
  const aliens: Alien[] = Array.from({ length: mission.aliens }, () => ({ stats, boss: false }))
  if (mission.kind === 'key' || mission.kind === 'final') {
    const scale = mission.kind === 'final' ? 4 : 3
    aliens[0] = { stats: { ...stats, hp: stats.hp * scale, damage: stats.damage + 1, range: stats.range + 1 }, boss: true }
  }
  return aliens
}

/** The three zones at a fork, one of each risk: a quiet one is long, an overrun one is a single hard fight. */
function drawZones(run: Run): Zone[] {
  const event = (): StopKind => (random(run) < 0.5 ? 'supply' : 'cache')
  const shuffled = (stops: StopKind[]) => {
    const [first] = stops.splice(randomInt(run, stops.length), 1)
    return [first, ...stops]
  }
  const terrain = () => TERRAIN_KINDS[randomInt(run, TERRAIN_KINDS.length)]
  return [
    { risk: 'safe', terrain: terrain(), stops: shuffled(['battle', event(), 'battle']) },
    { risk: 'standard', terrain: terrain(), stops: ['battle', 'battle'] },
    { risk: 'dangerous', terrain: terrain(), stops: ['battle'] },
  ]
}

/** Sets what lies ahead once a zone is done or a run begins: a fork, the leg's satellite, or the alien source. */
function nextStretch(run: Run): void {
  run.stop = 0
  run.zone = null
  run.zones = []
  if (run.keys === KEYS) run.zone = { risk: 'standard', terrain: 'industrial', stops: ['final'] }
  else if (run.fork === FORKS) run.zone = { risk: 'standard', terrain: TERRAIN_KINDS[randomInt(run, TERRAIN_KINDS.length)], stops: ['key'] }
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
    gear: [],
    nextGear: 1,
    built: [],
    aid: [],
    offers: [],
  }
  recruit(run)
  nextStretch(run)
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

function dropGear(run: Run, lucky: boolean): Gear {
  const gear = generateGear(run, run.nextGear++, rollRarity(run, lucky))
  run.gear.push(gear)
  return gear
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
    const gear = stop === 'cache' ? [dropGear(run, RISKS[zone.risk].rareGear)] : []
    run.report = { stop, won: true, threat: { before, after: run.threat }, supplies, gear, key: false, soldiers: [] }
    passStop(run)
    return
  }
  const mission = missionAt(run, stop, zone.risk)
  run.mission = mission
  run.phase = 'battle'
  const reserve = run.soldiers.map((s) => ({
    soldier: s.id,
    stats: soldierStats(run, s),
    ability: s.cls && CLASSES[s.cls].ability,
    charges: s.cls ? CLASSES[s.cls].charges : 0,
    stance: s.cls ? CLASSES[s.cls].stance : ('balanced' as const),
    effects: equipped(run, s).flatMap((gear) => gear.effect ?? []),
  }))
  run.battle = createBattle(randomInt(run, 2 ** 31), zone.terrain, aliensOf(run, mission), reserve)
}

/** Three different aid cards; the first from an overrun zone is rare or better. */
function drawOffers(run: Run, lucky: boolean): AidId[] {
  const offers: AidId[] = []
  while (offers.length < OFFERS) {
    const rarity = rollRarity(run, lucky && offers.length === 0)
    const pool = (Object.keys(AID) as AidId[]).filter((id) => AID[id].rarity === rarity && !offers.includes(id))
    if (pool.length > 0) offers.push(pool[randomInt(run, pool.length)])
  }
  return offers
}

/** Settles a finished battle: experience, casualties, threat, rewards, and where the squad stands on the road. */
export function endBattle(run: Run): void {
  const battle = run.battle!
  const mission = run.mission!
  const dead = new Set(run.soldiers.map((s) => s.id))
  for (const survivor of [...battle.units, ...battle.reserve]) if (survivor.soldier !== null) dead.delete(survivor.soldier)
  const fought = new Set(battle.units.map((u) => u.soldier))
  const xpBefore = run.soldiers.map((s) => s.xp)
  for (const s of run.soldiers) if (fought.has(s.id)) s.xp++
  assignClasses(run)
  const soldiers = run.soldiers.map((s, i) => ({ name: s.name, cls: s.cls, xpBefore: xpBefore[i], xpAfter: s.xp, died: dead.has(s.id) }))
  run.soldiers = run.soldiers.filter((s) => !dead.has(s.id))
  recruit(run)

  const won = battle.winner === 'human'
  const before = run.threat
  const risk = RISKS[mission.risk]
  // A last stand won empties the threat; any other battle is a stop, and adds to it.
  if (mission.kind === 'lastStand') run.threat = won ? 0 : run.threat
  else run.threat = Math.min(run.threat + STOP_THREAT + (won ? 0 : LOSS_THREAT), THREAT_MAX)
  const supplies = won ? risk.supplies : 0
  run.supplies += supplies
  // A won battle drops gear; a key mission's or a last stand's is rare or better.
  const drops = won && mission.kind !== 'final' ? (mission.kind === 'battle' ? risk.drops : 1) : 0
  const gear = Array.from({ length: drops }, () => dropGear(run, risk.rareGear || mission.kind !== 'battle'))
  const key = won && mission.kind === 'key'
  run.report = { stop: mission.kind, won, threat: { before, after: run.threat }, supplies, gear, key, soldiers }

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
  if (won) {
    run.offers = drawOffers(run, risk.rareGear)
    run.phase = 'reward'
  } else {
    run.phase = 'overworld'
  }
}

/** Takes offered aid, applies what it does at once, and returns to the overworld. */
export function takeAid(run: Run, id: AidId): void {
  const aid = AID[id]
  run.aid.push(id)
  run.offers = []
  run.supplies += aid.supplies ?? 0
  run.threat = Math.max(0, run.threat + (aid.threat ?? 0))
  for (const soldier of run.soldiers) soldier.xp += aid.xp ?? 0
  if (aid.promote) {
    const lowest = run.soldiers.reduce((low, soldier) => (soldier.xp < low.xp ? soldier : low))
    lowest.xp = Math.max(lowest.xp, RANK_XP[aid.promote])
  }
  assignClasses(run)
  run.phase = 'overworld'
}
