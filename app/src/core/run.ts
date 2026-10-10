import { AID, FACILITIES, RARITY_CHANCE, type AidId, type FacilityId, type Lasting, type Rarity } from './base'
import { ALIENS, alienStats, muster } from './aliens'
import { BASE_STATS, createBattle, type Alien, type Battle, type Stats } from './battle'
import { CLASSES, type ClassId } from './classes'
import { generateGear, SLOTS, type Gear, type Slot } from './gear'
import { RELIC_OFFERS, RELICS, type Relic, type RelicId } from './relics'
import { CLASS_SKILLS, SKILL_OFFERS, SKILLS, type SkillId } from './skills'
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
export const OFFERS = 3
export const START_SUPPLIES = 3
/** Supplies a supply drop gives. */
export const DROP_SUPPLIES = 4

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

/** A stretch of road the squad commits to: its risk, the kind of place its battles are fought in, and its stops, in order. */
export interface Zone {
  risk: Risk
  terrain: TerrainKind
  stops: StopKind[]
}

/**
 * A battle to fight. A last stand comes when threat is full, in place of the next stop; losing it loses the run,
 * as does losing the final mission. `force` is what the aliens can muster: a trooper costs one, and some kinds
 * cost two or come in pairs.
 */
export interface Mission {
  kind: 'battle' | 'key' | 'final' | 'lastStand'
  risk: Risk
  force: number
}

export interface Soldier {
  id: number
  name: string
  xp: number
  /** Drawn at random when the clone is made. */
  cls: ClassId | null
  skills: SkillId[]
  /** Skills still to choose, one for each level gained. */
  picks: number
  /** The skills to choose the next from; empty with none to choose. */
  offers: SkillId[]
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
  /** Every soldier in the squad when a battle began, with the class each has after it; empty for an event. A downed soldier fell in the battle and is cloned anew. */
  soldiers: { name: string; cls: ClassId | null; xpBefore: number; xpAfter: number; downed: boolean }[]
  /** The name of a clone the stop added to the squad. */
  hired: string | null
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
  relics: RelicId[]
  /** Relics to choose from in the reward phase, before the aid. */
  relicOffers: RelicId[]
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

/** Draws the skills a soldier chooses the next from: up to SKILL_OFFERS of its class's that it lacks. */
function offerSkills(run: Run, soldier: Soldier): void {
  const pool = CLASS_SKILLS[soldier.cls!].filter((id) => !soldier.skills.includes(id))
  soldier.offers = []
  while (soldier.offers.length < SKILL_OFFERS && pool.length > 0) soldier.offers.push(...pool.splice(randomInt(run, pool.length), 1))
  if (soldier.offers.length === 0) soldier.picks = 0
}

/** Gives a soldier experience, and a skill to choose for each level it gains. */
function gainXp(run: Run, soldier: Soldier, xp: number): void {
  const before = level(soldier)
  soldier.xp += xp
  soldier.picks += level(soldier) - before
  if (soldier.picks > 0 && soldier.offers.length === 0) offerSkills(run, soldier)
}

/** Learns the offered skill at `index`, and offers the next if more are owed. */
export function takeSkill(run: Run, soldier: Soldier, index: number): void {
  soldier.skills.push(soldier.offers[index])
  soldier.picks--
  soldier.offers = []
  if (soldier.picks > 0) offerSkills(run, soldier)
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
    const fromGear = equipped(run, soldier).reduce((sum, gear) => sum + (gear.stats[key] ?? 0), 0)
    const fromSkills = soldier.skills.reduce((sum, id) => sum + (SKILLS[id].stats?.[key] ?? 0), 0)
    stats[key] += fromClass + fromGear + fromSkills + level(soldier) * (LEVEL_STATS[key] ?? 0) + total(run, (u) => u.stats?.[key])
  }
  return stats
}

/**
 * Adds a clone to the squad and returns it. It arrives at level 1, or at the level of the squad's lowest if that is
 * higher, plus what the academy adds, so a late arrival is not left behind; it has a skill to choose for each level.
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
    picks: 0,
    offers: [],
    gear: { weapon: null, armor: null, utility: null },
  }
  run.soldiers.push(soldier)
  gainXp(run, soldier, xpFor(Math.max(1, lowest) + total(run, (u) => u.recruitRank)))
  return soldier
}

/** How far along the road the squad is, which sets which packs appear and how much armor aliens wear: two steps a leg, the second at its last fork. */
function depth(run: Run): number {
  return run.keys * 2 + (run.fork >= FORKS ? 1 : 0)
}

/** The mission the squad would fight at a stop of the given kind now. Its force follows the leg, and so the size of the squad. */
export function missionAt(run: Run, kind: Mission['kind'], risk: Risk): Mission {
  const extra = { battle: 0, key: 1, final: 3, lastStand: 1 + run.keys }[kind]
  return { kind, risk, force: Math.max(1, LEG_FORCE[run.keys] + (run.fork >= FORKS ? 1 : 0) + extra + RISKS[risk].aliens) }
}

/**
 * The aliens of a mission, in pods: packs mustered at random for its force. A kind's health and aim never change;
 * deeper along the road aliens are better equipped: a point of armor each step, a point of damage every second. A key or final mission adds a boss, a trooper built up by the keys
 * already won: each adds health, armor and an escorting trooper; from the second satellite on it hits harder and
 * spawns swarmlings, and from the third it shoots farther.
 */
function packsOf(run: Run, mission: Mission): { name: string; aliens: Alien[] }[] {
  const tier = depth(run)
  const armor = tier
  const weapon = Math.floor(tier / 2)
  const alien = (kind: Alien['kind']): Alien => ({ kind, stats: alienStats(kind, armor, weapon), stance: ALIENS[kind].stance, boss: false, spawns: false })
  const boss = mission.kind === 'key' || mission.kind === 'final'
  const escort = boss ? run.keys : 0
  const packs = muster(run, Math.max(0, mission.force - (boss ? 2 + escort : 0)), tier).map((pack) => ({ name: pack.name, aliens: pack.kinds.map(alien) }))
  if (boss) {
    const k = run.keys
    const stats: Stats = { ...BASE_STATS, hp: BASE_STATS.hp + 5 * k, armor: 2 + k, damage: BASE_STATS.damage + (k >= 1 ? 1 : 0), range: BASE_STATS.range + (k >= 2 ? 1 : 0) }
    const escorts = Array.from({ length: escort }, () => alien('trooper'))
    packs.unshift({ name: mission.kind === 'final' ? 'The source' : 'Guardian', aliens: [{ kind: 'trooper', stats, stance: 'balanced', boss: true, spawns: k >= 1 }, ...escorts] })
  }
  return packs
}

/** The three zones at a fork, one of each risk: a quiet one is long, an overrun one is a single hard fight. */
function drawZones(run: Run): Zone[] {
  const event = (): StopKind => (random(run) < 0.5 ? 'supply' : 'cache')
  const shuffled = (stops: StopKind[]) => {
    const [first] = stops.splice(randomInt(run, stops.length), 1)
    return [first, ...stops]
  }
  const terrain = () => ZONE_TERRAINS[randomInt(run, ZONE_TERRAINS.length)]
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
  if (run.keys === KEYS) run.zone = { risk: 'standard', terrain: 'hive', stops: ['final'] }
  else if (run.fork === FORKS) run.zone = { risk: 'standard', terrain: 'compound', stops: ['key'] }
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
    relics: [],
    relicOffers: [],
  }
  hire(run)
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
    const gear = stop === 'cache' ? [dropGear(run, RISKS[zone.risk].rareGear || run.relics.some((id) => (RELICS[id] as Relic).rareGear))] : []
    run.report = { stop, won: true, threat: { before, after: run.threat }, supplies, gear, key: false, soldiers: [], hired: null }
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
    charges: charges(run, s),
    stance: s.cls ? CLASSES[s.cls].stance : ('balanced' as const),
    effects: [...equipped(run, s).flatMap((gear) => gear.effect ?? []), ...s.skills.flatMap((id) => SKILLS[id].effect ?? []), ...run.relics.flatMap((id): Relic['effect'][] => [RELICS[id].effect]).flatMap((effect) => effect ?? [])],
  }))
  run.battle = createBattle(randomInt(run, 2 ** 31), zone.terrain, packsOf(run, mission), reserve)
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
  for (const s of run.soldiers) if (standing.has(s.id)) gainXp(run, s, 1)
  const soldiers = run.soldiers.map((s, i) => ({ name: s.name, cls: s.cls, xpBefore: xpBefore[i], xpAfter: s.xp, downed: !standing.has(s.id) }))

  const won = battle.winner === 'human'
  const before = run.threat
  const risk = RISKS[mission.risk]
  // A last stand won empties the threat; any other battle is a stop, and adds to it.
  if (mission.kind === 'lastStand') run.threat = won ? 0 : run.threat
  else run.threat = Math.min(run.threat + STOP_THREAT + (won ? 0 : LOSS_THREAT), THREAT_MAX)
  const held = run.relics.map((id): Relic => RELICS[id])
  const supplies = won ? risk.supplies + held.reduce((sum, relic) => sum + (relic.supplies ?? 0), 0) : 0
  run.supplies += supplies
  // A won battle drops gear; a key mission's or a last stand's is rare or better.
  const drops = won && mission.kind !== 'final' ? (mission.kind === 'battle' ? risk.drops : 1) : 0
  const gear = Array.from({ length: drops }, () => dropGear(run, risk.rareGear || mission.kind !== 'battle' || held.some((relic) => relic.rareGear)))
  const key = won && mission.kind === 'key'
  // Each key won brings a new clone to the squad.
  const hired = key ? hire(run).name : null
  run.report = { stop: mission.kind, won, threat: { before, after: run.threat }, supplies, gear, key, soldiers, hired }

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
    // A satellite or a last stand won also offers relics.
    if (mission.kind !== 'battle') {
      const pool = (Object.keys(RELICS) as RelicId[]).filter((id) => !run.relics.includes(id))
      while (run.relicOffers.length < RELIC_OFFERS && pool.length > 0) run.relicOffers.push(...pool.splice(randomInt(run, pool.length), 1))
    }
    run.phase = 'reward'
  } else {
    run.phase = 'overworld'
  }
}

/** Takes an offered relic. */
export function takeRelic(run: Run, id: RelicId): void {
  run.relics.push(id)
  run.relicOffers = []
}

/** Takes offered aid, applies what it does at once, and returns to the overworld. */
export function takeAid(run: Run, id: AidId): void {
  const aid = AID[id]
  run.aid.push(id)
  run.offers = []
  run.supplies += aid.supplies ?? 0
  run.threat = Math.max(0, run.threat + (aid.threat ?? 0))
  for (const soldier of run.soldiers) gainXp(run, soldier, aid.xp ?? 0)
  if (aid.promote) {
    const lowest = run.soldiers.reduce((low, soldier) => (soldier.xp < low.xp ? soldier : low))
    gainXp(run, lowest, Math.max(0, xpFor(level(lowest) + aid.promote) - lowest.xp))
  }
  run.phase = 'overworld'
}
