import { RARITY_CHANCE, type Lasting, type Rarity } from './base'
import { TUNING } from './tuning'
import { ALIENS, alienStats, muster, type AlienKind } from './aliens'
import { CIVILIAN_SUPPLIES, CIVILIANS, CIVILIANS_PER_THREAT, GOALS, type Goal } from './goals'
import { BASE_STATS, createBattle, type Alien, type Battle, type Stats } from './battle'
import { CLASSES, type ClassId } from './classes'
import { DOCTRINES, type Doctrine, type DoctrineId } from './doctrines'
import type { EventId } from './events'
import { FEATS, type FeatId } from './feats'
import { EFFECTS, generateGear, SLOTS, type Gear, type Slot } from './gear'
import { RESISTS, type Keyword, type Resist } from './keywords'
import { RELIC_OFFERS, RELICS, type Relic, type RelicId } from './relics'
import { PATHS, SKILLS, type SkillId } from './skills'
import { ZONE_TERRAINS, type TerrainKind } from './terrain'
import { drawTwist, type Twist } from './twists'
import { random, randomInt } from './rng'
import { TRAITS, type Trait, type TraitId } from './traits'

/** Access keys needed to find the alien source; each is won at a satellite, at the end of a leg. */
export const KEYS = 3
/** Stops on each leg before its satellite, whichever way the squad goes. */
export const LEG_STOPS = 9
/** Rows a leg's map spreads across, and trails that wander them from start to satellite. */
export const MAP_ROWS = 5
const TRAILS = 4
/** Threat at which the next stop becomes an escape. */
export const THREAT_MAX = 18
/** Threat each stop adds, and what losing a battle adds on top. */
export const STOP_THREAT = 1
export const LOSS_THREAT = 1
export const START_SUPPLIES = 3
/** Supplies lost for each soldier downed on an escape. */
export const ESCAPE_DOWNED_SUPPLIES = 2
/** What an assassination's commander has over a trooper. */
export const COMMANDER = { hp: 4, armor: 1 }
/** Supplies a supply drop gives. */
export const DROP_SUPPLIES = 4

/** Supplies a piece of gear sells for, by rarity. */
export const SELL: Record<Rarity, number> = { common: 2, rare: 3, epic: 5 }

/** What each level adds to a soldier's stats. */
export const LEVEL_STATS: Partial<Stats> = { hp: 2, aim: 0.05 }

const NAMES = ['Vega', 'Okafor', 'Lindqvist', 'Tanaka', 'Reyes', 'Novak', 'Haddad', 'Brandt', 'Silva', 'Kowalski', 'Mbeki', 'Dufour', 'Ivanov', 'Castillo', 'Ng', 'Shaw']

export type Risk = 'safe' | 'standard' | 'dangerous'

/** What each risk means for a battle: how many aliens it has and what it pays. */
export const RISKS: Record<Risk, { name: string; aliens: number; supplies: number; drops: number; rareGear: boolean; text: string }> = {
  safe: { name: 'Quiet', aliens: -1, supplies: 1, drops: 0, rareGear: false, text: 'Fewer aliens, and no gear' },
  standard: { name: 'Contested', aliens: 0, supplies: 2, drops: 1, rareGear: false, text: 'A fair fight' },
  dangerous: { name: 'Overrun', aliens: 1, supplies: TUNING.dangerSupplies, drops: 2, rareGear: true, text: 'More aliens, and two pieces of gear, one rare or better' },
}

/**
 * A stop on the road. A battle must be fought. A supply drop gives supplies and a cache gives gear, with no fight.
 * A shop sells gear, relics and a bribe. An unknown stop is revealed on arrival as a battle, a shop or an event.
 * A key mission, at a satellite, wins an access key; the final mission strikes the alien source. Both have a boss.
 */
export type StopKind = 'battle' | 'supply' | 'cache' | 'shop' | 'unknown' | 'key' | 'final'

/** A pack of aliens by name and kinds, mustered before it is equipped. */
export interface Muster {
  name: string
  kinds: AlienKind[]
}

/**
 * A stop on the road. A battle has its own risk, goal and kind of place, and `packs` holds the aliens it will send,
 * mustered in advance so the map can show them. Other stops fight as `standard` exterminations, and have no packs.
 */
export interface Stop {
  kind: StopKind
  risk: Risk
  goal: Goal
  terrain: TerrainKind
  /** What about the ground or weather changes the battle; drawn ahead, so the map can show it. */
  twist: Twist | null
  packs: Muster[]
}

/** A stop on a leg's map: its row, the stops in the next column it leads to, and the stop, null until its leg begins. */
export interface MapNode {
  row: number
  next: number[]
  stop: Stop | null
}

/**
 * A leg of the road as a map: columns of stops, LEG_STOPS of them then the satellite, or the source alone on the
 * last. `path` is the index the squad took in each column entered, -1 for a column passed underground.
 */
export interface Leg {
  columns: MapNode[][]
  path: number[]
}

/**
 * A battle to fight. An escape comes when threat is full, in place of the next stop; losing it loses the run,
 * as does losing the final mission. `force` is what the aliens can muster: a trooper costs one, and some kinds
 * cost two or come in pairs.
 */
export interface Mission {
  kind: 'battle' | 'key' | 'final' | 'escape'
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
  /** In the order learned; the first, drawn at random when the clone is made, sets the soldier's path. */
  skills: SkillId[]
  /** Feats it has pulled off, each paying experience only the first time. */
  feats: FeatId[]
  gear: Record<Slot, Gear | null>
  /** The quirk it was recruited with, if any. */
  trait: TraitId | null
}

/** Gear a soldier found, waiting to be equipped on that soldier or sold. */
export interface Find {
  soldier: number
  gear: Gear
}

/** A find its finder decided alone: worn or sold, and what the finder said. */
export interface Decision {
  soldier: string
  gear: Gear
  kept: boolean
  line: string
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
  /**
   * Every soldier in the squad when a battle began, with the class each has after it; empty for an event. A downed
   * soldier fell in the battle and is cloned anew. `earned` is what its experience came from; `feats`, those first
   * pulled off.
   */
  soldiers: { id: number; name: string; cls: ClassId | null; xpBefore: number; xpAfter: number; downed: boolean; earned: Earned[]; feats: FeatId[] }[]
  /** The name of a clone the stop added to the squad. */
  hired: string | null
  /** Civilians kept alive on a rescue; null on any other stop. */
  rescued: number | null
}

/** Experience from one source. */
export interface Earned {
  label: string
  xp: number
}

/** A piece of gear for sale, and the soldier it is fitted to when bought. */
export interface Ware {
  gear: Gear
  soldier: number
}

/** A shop's stock, each item gone once bought, and whether its bribe is spent. */
export interface Shop {
  wares: Ware[]
  relics: RelicId[]
  bribed: boolean
}

export interface Run {
  seed: number
  rng: number
  /** Access keys won; also the number of the leg under way, from 0. At KEYS, the final mission is all that remains. */
  keys: number
  /** Every leg's map, its shape drawn when the run begins; the one at `keys` is under way. */
  legs: Leg[]
  /** Columns passed on the leg under way. The squad chooses where to go when it has entered no column beyond them. */
  stop: number
  threat: number
  /**
   * In the overworld the player chooses where to go or travels on; in the reward phase, makes the choices a stop left;
   * in a shop, buys; at an event, chooses how to meet it.
   */
  phase: 'recruit' | 'overworld' | 'battle' | 'reward' | 'shop' | 'event' | 'won' | 'lost'
  /** What the shop the squad is in sells; null outside a shop. */
  shop: Shop | null
  /** The event the squad is meeting; null outside one. */
  event: EventId | null
  /** Events met this run, which are not met again. */
  met: EventId[]
  /** Doctrines adopted, in order. */
  doctrines: DoctrineId[]
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
  /** Finds their finders decided alone at the last stop. */
  decisions: Decision[]
  nextGear: number
  relics: RelicId[]
  /** Relics to choose from in the reward phase. */
  relicOffers: RelicId[]
  /** At the run's start, the recruits to choose the first soldier from. */
  recruits: Soldier[]
  /** What each leg's boss resists, by keys won; known from the start so the squad can build to beat it. */
  bosses: Resist[]
}

/** Experience each level takes beyond the last: level n takes LEVEL_XP × n more. */
export const LEVEL_XP = 4

/** Experience a soldier needs for a level. */
export function xpFor(level: number): number {
  return (LEVEL_XP * level * (level + 1)) / 2
}

/** A soldier's level, from experience. */
export function level(soldier: { xp: number }): number {
  return Math.floor((Math.sqrt((8 * soldier.xp) / LEVEL_XP + 1) - 1) / 2)
}

/**
 * Experience a soldier still standing earns from a battle: some shared, for surviving and winning, and the rest its
 * own: for each kill, each `damage` points done, each civilian a won rescue keeps alive, and each feat the first time.
 */
export const XP = { survived: 1, won: 2, kill: 1, damage: 5, civilian: 1, feat: 2 }

/** The sum of one lasting effect over every relic and doctrine held. */
function total(run: Run, effect: (source: Lasting) => number | undefined): number {
  const sources: Lasting[] = [...run.relics.map((id): Relic => RELICS[id]), ...run.doctrines.map((id): Doctrine => DOCTRINES[id])]
  return sources.reduce((sum, source) => sum + (effect(source) ?? 0), 0)
}

/**
 * The skills a soldier chooses the next from, or none if no choice is owed. A soldier arrives with the core of one of
 * its class's two paths; at each next level it learns one of that path's next pair.
 */
export function skillOffers(soldier: Soldier): SkillId[] {
  if (!soldier.cls) return []
  const path = PATHS[soldier.cls].find((p) => p.core === soldier.skills[0])
  if (!path || soldier.skills.length >= Math.min(level(soldier), 1 + path.tiers.length)) return []
  return path.tiers[soldier.skills.length - 1]
}

/** Learns the offered skill at `index`. */
export function takeSkill(run: Run, soldier: Soldier, index: number): void {
  soldier.skills.push(skillOffers(soldier)[index])
  settle(run)
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

/** What gear costs in a shop, by rarity. */
export const GEAR_PRICE: Record<Exclude<Rarity, 'common'>, number> = { rare: 5, epic: 8 }
/** Pieces of gear and relics a shop stocks. */
const SHOP_WARES = 2
const SHOP_RELICS = 2
/** Chance a piece of shop gear is epic rather than rare. */
const SHOP_EPIC = 0.3

/**
 * Stocks a shop: gear, each piece with an effect no other piece there has and fitted to the soldier it suits best, an
 * empty slot first, then the commonest; relics the squad lacks; and a bribe.
 */
export function stockShop(run: Run): Shop {
  const wares: Ware[] = []
  for (let tries = 0; wares.length < SHOP_WARES && tries < 50; tries++) {
    const gear = generateGear(run, run.nextGear, random(run) < SHOP_EPIC ? 'epic' : 'rare')
    if (wares.some((w) => w.gear.effect === gear.effect)) continue
    run.nextGear++
    // The soldier worst equipped in its slot, spread across the squad: each ware already fitted to one counts as a rank.
    const rank = (s: Soldier) => (s.gear[gear.slot] ? RARITY_RANK[s.gear[gear.slot]!.rarity] + 1 : 0) + wares.filter((w) => w.soldier === s.id).length
    const fits = run.soldiers.filter((s) => rank(s) === Math.min(...run.soldiers.map(rank)))
    wares.push({ gear, soldier: fits[randomInt(run, fits.length)].id })
  }
  const relics = (Object.keys(RELICS) as RelicId[]).filter((id) => !run.relics.includes(id))
  const stocked: RelicId[] = []
  while (stocked.length < SHOP_RELICS && relics.length > 0) stocked.push(relics.splice(randomInt(run, relics.length), 1)[0])
  return { wares, relics: stocked, bribed: false }
}

/** Buys the ware at `index`: its soldier wears it, selling what it replaces. The caller checks it is affordable. */
export function buyWare(run: Run, index: number): void {
  const [{ gear, soldier: id }] = run.shop!.wares.splice(index, 1)
  const soldier = run.soldiers.find((s) => s.id === id)!
  run.supplies -= GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
  const old = soldier.gear[gear.slot]
  if (old) run.supplies += SELL[old.rarity]
  soldier.gear[gear.slot] = gear
}

/** Sells the first find. */
export function sellFind(run: Run): void {
  run.supplies += SELL[run.finds.shift()!.gear.rarity]
  settle(run)
}

/** Ends the reward phase once no choice is left: no relic, find or skill. */
export function settle(run: Run): void {
  const owed = run.relicOffers.length > 0 || run.finds.length > 0 || run.soldiers.some((s) => skillOffers(s).length > 0)
  run.phase = owed ? 'reward' : 'overworld'
}

/** Uses of a soldier's class ability each battle: the class's, plus what skills and relics add to an ability that has uses. */
export function charges(run: Run, soldier: Soldier): number {
  const base = soldier.cls ? CLASSES[soldier.cls].charges : 0
  if (base === 0) return 0
  return base + soldier.skills.reduce((sum, id) => sum + (SKILLS[id].charges ?? 0), 0) + run.relics.reduce((sum, id) => sum + ((RELICS[id] as Relic).charges ?? 0), 0)
}

/** A soldier's stats in battle: base, plus class, level, skills and gear, plus relics. */
export function soldierStats(run: Run, soldier: Soldier): Stats {
  const stats = { ...BASE_STATS }
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const fromClass = soldier.cls ? (CLASSES[soldier.cls].stats[key] ?? 0) : 0
    const fromGear = equipped(soldier).reduce((sum, gear) => sum + (gear.stats[key] ?? 0), 0)
    const fromSkills = soldier.skills.reduce((sum, id) => sum + (SKILLS[id].stats?.[key] ?? 0), 0)
    const fromTrait = soldier.trait ? ((TRAITS[soldier.trait] as Trait).stats?.[key] ?? 0) : 0
    stats[key] += fromClass + fromGear + fromSkills + fromTrait + level(soldier) * (LEVEL_STATS[key] ?? 0) + total(run, (u) => u.stats?.[key])
  }
  for (const id of run.doctrines) Object.assign(stats, (DOCTRINES[id] as Doctrine).set)
  return stats
}

/**
 * Adds a clone to the squad and returns it: a level 1 recruit set on one of its class's paths at random. Under a
 * doctrine of unique classes it takes a class no squadmate has, while one is left.
 */
export function hire(run: Run): Soldier {
  const soldier = draft(run, [])
  soldier.id = run.nextSoldier++
  run.soldiers.push(soldier)
  return soldier
}

/** A level 1 clone of a class none of `taken` has, if one is left, not yet in the squad. */
function draft(run: Run, taken: ClassId[]): Soldier {
  const unused = (Object.keys(CLASSES) as ClassId[]).filter((id) => !run.soldiers.some((s) => s.cls === id))
  const unique = run.doctrines.some((id) => (DOCTRINES[id] as Doctrine).uniqueClasses) && unused.length > 0
  const all = (unique ? unused : (Object.keys(CLASSES) as ClassId[])).filter((id) => !taken.includes(id))
  const classes = all.length > 0 ? all : (Object.keys(CLASSES) as ClassId[])
  const free = NAMES.filter((name) => ![...run.soldiers, ...run.recruits].some((s) => s.name === name))
  const name = free[randomInt(run, free.length)]
  const cls = classes[randomInt(run, classes.length)]
  const soldier: Soldier = {
    id: 0,
    name,
    xp: xpFor(1),
    cls,
    skills: [PATHS[cls][randomInt(run, 2)].core],
    feats: [],
    gear: { weapon: null, armor: null, utility: null },
    trait: null,
  }
  return soldier
}

/** Recruits offered at a run's start. */
export const RECRUITS = 3

/** Offers the run's first soldier: recruits of different classes, one plain and the rest each with a different trait. */
function offerRecruits(run: Run): void {
  const traits = Object.keys(TRAITS) as TraitId[]
  const plain = randomInt(run, RECRUITS)
  for (let i = 0; i < RECRUITS; i++) {
    const recruit = draft(run, run.recruits.map((r) => r.cls!))
    if (i !== plain) recruit.trait = traits.splice(randomInt(run, traits.length), 1)[0]
    run.recruits.push(recruit)
  }
}

/** Takes the recruit at `index` as the run's first soldier, with what its trait brings. */
export function recruit(run: Run, index: number): void {
  const soldier = run.recruits[index]
  run.recruits = []
  soldier.id = run.nextSoldier++
  run.soldiers.push(soldier)
  const trait: Trait | null = soldier.trait ? TRAITS[soldier.trait] : null
  if (trait?.level) soldier.xp = xpFor(trait.level)
  run.supplies += trait?.supplies ?? 0
  run.threat = Math.min(run.threat + (trait?.threat ?? 0), THREAT_MAX)
  if (trait?.relic) {
    const unheld = (Object.keys(RELICS) as RelicId[]).filter((id) => !run.relics.includes(id))
    run.relics.push(unheld[randomInt(run, unheld.length)])
  }
  settle(run)
}

/** Whether the squad is in the second half of its leg, where aliens are stronger. */
const late = (run: Run) => run.stop >= LEG_STOPS / 2

/** How far along the road the squad is, which sets which packs appear and how much armor aliens wear: two steps a leg, the second halfway. */
function depth(run: Run): number {
  return run.keys * 2 + (late(run) ? 1 : 0)
}

/** The mission the squad would fight at a stop of the given kind now. Its force follows the leg, and so the size of the squad. */
export function missionAt(run: Run, kind: Mission['kind'], risk: Risk, goal: Goal = 'exterminate'): Mission {
  const extra = { battle: 0, key: 1, final: 2, escape: run.keys }[kind]
  return { kind, goal, risk, force: Math.max(1, TUNING.legForce[run.keys] + (late(run) ? 1 : 0) + extra + RISKS[risk].aliens + GOALS[goal].force) }
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
  const alien = (kind: Alien['kind']): Alien => ({ kind, stats: alienStats(kind, armor, weapon), stance: ALIENS[kind].stance, boss: false, spawns: ALIENS[kind].spawns ?? false, target: false, resists: ALIENS[kind].resists })
  const boss = mission.kind === 'key' || mission.kind === 'final'
  const escort = boss ? run.keys : 0
  const packs = (mustered ?? muster(run, Math.max(0, mission.force - (boss ? 2 + escort : 0)), tier)).map((pack) => ({ name: pack.name, aliens: pack.kinds.map(alien) }))
  // An assassination's commander: a trooper tougher than its kind.
  if (mission.goal === 'assassinate') {
    const commander = alien('trooper')
    commander.stats = { ...commander.stats, hp: commander.stats.hp + COMMANDER.hp, armor: commander.stats.armor + COMMANDER.armor, damage: commander.stats.damage + 1 }
    packs.unshift({ name: 'Commander', aliens: [{ ...commander, target: true, stance: 'anchor' }] })
  }
  // An escape's champion: a hunter tougher, faster and deadlier than any trooper, that runs the squad down.
  if (mission.goal === 'escape') {
    const hunter = alien('trooper')
    hunter.stats = { ...hunter.stats, hp: hunter.stats.hp + HUNTER.hp, armor: hunter.stats.armor + HUNTER.armor, damage: hunter.stats.damage + HUNTER.damage, move: hunter.stats.move + HUNTER.move, range: hunter.stats.range + 1 }
    packs.unshift({ name: 'The Hunter', aliens: [{ ...hunter, boss: true, stance: 'rush' }] })
  }
  if (boss) {
    const k = run.keys
    const stats: Stats = { ...BASE_STATS, hp: BASE_STATS.hp + 5 * k, armor: 2 + k, damage: BASE_STATS.damage + (k >= 1 ? 1 : 0), range: BASE_STATS.range + (k >= 2 ? 1 : 0) }
    const escorts = Array.from({ length: escort }, () => alien('trooper'))
    packs.unshift({ name: mission.kind === 'final' ? 'The source' : 'Guardian', aliens: [{ kind: 'trooper', stats, stance: 'balanced', boss: true, spawns: k >= 1, target: false, resists: [run.bosses[k]] }, ...escorts] })
  }
  return packs
}

/** What an escape's hunter adds to a trooper. */
const HUNTER = { hp: 6, armor: 1, damage: 1, move: 1 }

/** A goal drawn by GOALS' weights. */
function drawGoal(run: Run): Goal {
  const goals = Object.keys(GOALS) as Goal[]
  let roll = random(run) * goals.reduce((sum, goal) => sum + GOALS[goal].weight, 0)
  return goals.find((goal) => (roll -= GOALS[goal].weight) < 0) ?? 'exterminate'
}

/** How likely a stop past a leg's first column is to be each kind other than a battle; the rest are battles. */
export const STOP_CHANCE = { unknown: 0.25, shop: 0.1, supply: 0.1, cache: 0.1 }

/**
 * The shape of a leg's map: trails start apart and wander a row up, down or on each column, never crossing, and
 * every stop they pass is a node. Then the satellite, which all reach.
 */
function drawShape(run: Run): MapNode[][] {
  const edges = Array.from({ length: LEG_STOPS }, () => new Map<number, Set<number>>())
  const first = randomInt(run, MAP_ROWS)
  for (let t = 0; t < TRAILS; t++) {
    let row = t === 0 ? first : t === 1 ? (first + 1 + randomInt(run, MAP_ROWS - 1)) % MAP_ROWS : randomInt(run, MAP_ROWS)
    for (let c = 0; c < LEG_STOPS; c++) {
      const out = edges[c].get(row) ?? new Set<number>()
      edges[c].set(row, out)
      if (c === LEG_STOPS - 1) break
      const step = Math.min(MAP_ROWS - 1, Math.max(0, row + randomInt(run, 3) - 1))
      // Only a step up and a step down between the same two rows can cross; then the trail goes straight on.
      const to = step !== row && edges[c].get(step)?.has(row) ? row : step
      out.add(to)
      row = to
    }
  }
  const rows = edges.map((column) => [...column.keys()].sort((a, b) => a - b))
  const nodes = rows.map((column, c) =>
    column.map((row): MapNode => ({ row, stop: null, next: c === LEG_STOPS - 1 ? [0] : [...edges[c].get(row)!].sort((a, b) => a - b).map((r) => rows[c + 1].indexOf(r)) })),
  )
  return [...nodes, [{ row: Math.floor(MAP_ROWS / 2), next: [], stop: null }]]
}

/** Fills the stops of the leg under way: its first column battles, the rest drawn at random, each battle mustered for where it stands. */
function drawStops(run: Run): void {
  const leg = run.legs[run.keys]
  if (run.keys === KEYS) {
    leg.columns[0][0].stop = fixed('final', 'hive')
    return
  }
  const risks = Object.keys(RISKS) as Risk[]
  leg.columns.forEach((column, c) => {
    for (const node of column) {
      let roll = random(run)
      const kind = c === 0 ? undefined : (Object.keys(STOP_CHANCE) as (keyof typeof STOP_CHANCE)[]).find((k) => (roll -= STOP_CHANCE[k]) < 0)
      node.stop = c === LEG_STOPS ? fixed('key', 'compound') : kind ? fixed(kind, 'town') : drawBattle(run, risks[randomInt(run, risks.length)], { ...run, stop: c })
    }
  })
}

/** A battle of `risk` with a goal and place drawn at random, its aliens mustered for the squad as it will be at `when`. */
export function drawBattle(run: Run, risk: Risk, when: Run = run): Stop {
  const goal = drawGoal(run)
  const force = missionAt(when, 'battle', risk, goal).force
  // Each battle's force varies a little either way, so two battles of one risk are not the same fight.
  const packs = muster(run, Math.max(1, force + randomInt(run, 3) - 1), depth(when)).map(({ name, kinds }) => ({ name, kinds }))
  return { kind: 'battle', risk, goal, terrain: ZONE_TERRAINS[randomInt(run, ZONE_TERRAINS.length)], twist: drawTwist(run, when.keys), packs }
}

/** A stop with no aliens drawn ahead: an event, a key mission or the final mission. */
const fixed = (kind: StopKind, terrain: TerrainKind): Stop => ({ kind, risk: 'standard', goal: 'exterminate', terrain, twist: null, packs: [] })

/** How hard a stop is: a battle counts one, a quiet one none and an overrun one two. */
export const danger = (stop: Stop) => (stop.kind === 'battle' ? 1 + RISKS[stop.risk].aliens : 0)

/** The leg under way. */
export const legOf = (run: Run) => run.legs[run.keys]

/** The node the squad has entered and not yet passed; null while it chooses where to go. */
export function current(run: Run): MapNode | null {
  const leg = legOf(run)
  return leg.path.length > run.stop ? leg.columns[run.stop][leg.path[run.stop]] : null
}

/** Indexes in the next column of where the squad can go: where its last stop leads, or anywhere at a leg's start or out of a tunnel. */
export function ways(run: Run): number[] {
  const leg = legOf(run)
  const last = leg.path[run.stop - 1] ?? -1
  return last === -1 ? leg.columns[run.stop].map((_, i) => i) : leg.columns[run.stop - 1][last].next
}

/** Enters the node at `index` of the next column. */
export function go(run: Run, index: number): void {
  legOf(run).path.push(index)
}

/** Takes the way on if there is only one. */
function onward(run: Run): void {
  const open = ways(run)
  if (open.length === 1) go(run, open[0])
}

export function createRun(seed: number): Run {
  const run: Run = {
    seed,
    rng: seed,
    keys: 0,
    legs: [],
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
    decisions: [],
    nextGear: 1,
    relics: [],
    relicOffers: [],
    recruits: [],
    bosses: [],
    shop: null,
    event: null,
    met: [],
    doctrines: [],
  }
  offerRecruits(run)
  run.legs = Array.from({ length: KEYS + 1 }, (_, k) => ({ columns: k === KEYS ? [[{ row: Math.floor(MAP_ROWS / 2), next: [], stop: null }]] : drawShape(run), path: [] }))
  drawStops(run)
  run.phase = 'recruit'
  const resists = Object.keys(RESISTS) as Resist[]
  run.bosses = Array.from({ length: KEYS + 1 }, () => resists[randomInt(run, resists.length)])
  return run
}

/** The stop the squad travels to next: an escape if threat is full, else the stop it has entered. Null while it chooses. */
export function nextStop(run: Run): StopKind | 'escape' | null {
  const node = current(run)
  if (!node) return null
  return run.threat >= THREAT_MAX ? 'escape' : node.stop!.kind
}

/** A random rarity; `lucky` rules out common. */
function rollRarity(run: Run, lucky: boolean): Rarity {
  let roll = random(run)
  if (lucky) roll = RARITY_CHANCE.common + roll * (1 - RARITY_CHANCE.common)
  return roll < RARITY_CHANCE.common ? 'common' : roll < RARITY_CHANCE.common + RARITY_CHANCE.rare ? 'rare' : 'epic'
}

const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2 }

/** What a finder says on deciding a find alone, by whether the slot was empty, the find better, the same as what it wears, or worse. */
const BLURBS = {
  empty: ['"Finders keepers."', '"Was this anyone\'s? It\'s mine now."', '"Oh, that\'s going on immediately."', '"Naked no more!"'],
  better: ['"Upgrade! The old one can go live on a farm."', '"Yes. Yes, you\'ll do."', '"Out with the old, in with the shiny."', '"I deserve this. Don\'t look it up."'],
  same: ['"Already got one."', '"Twins. One of you goes."', '"Same again? Sell it."', '"I can only hold one of these."'],
  worse: ['"I have standards."', '"Downgrade? In this economy?"', '"Sell it. Sentiment is for the dead."', '"Mine\'s better. Obviously."'],
}

/**
 * A piece of gear found by a soldier drawn at random. The finder decides alone, with a word on why: an empty slot or a
 * rarer find is worn, selling what it replaces; a commoner one, or one the same as what it wears, is sold. Another find
 * as rare as what the finder wears waits for the player in run.finds.
 */
export function dropGear(run: Run, lucky: boolean): void {
  const gear = generateGear(run, run.nextGear++, rollRarity(run, lucky))
  const soldier = run.soldiers[randomInt(run, run.soldiers.length)]
  const old = soldier.gear[gear.slot]
  const same = !!old && old.effect === gear.effect && JSON.stringify(old.stats) === JSON.stringify(gear.stats)
  if (old && !same && old.rarity === gear.rarity) {
    run.finds.push({ soldier: soldier.id, gear })
    return
  }
  const kept = !old || RARITY_RANK[gear.rarity] > RARITY_RANK[old.rarity]
  const lines = BLURBS[!old ? 'empty' : kept ? 'better' : same ? 'same' : 'worse']
  const line = lines[randomInt(run, lines.length)]
  if (kept) {
    if (old) run.supplies += SELL[old.rarity]
    soldier.gear[gear.slot] = gear
  } else run.supplies += SELL[gear.rarity]
  run.decisions.push({ soldier: soldier.name, gear, kept, line })
}

/** Moves past the stop the squad is at, and takes the way on if there is only one. */
export function passStop(run: Run): void {
  run.stop++
  onward(run)
}

/** Travels to the next stop, unless it is a shop or unknown. A battle begins; a supply drop or cache is collected at once. */
export function advance(run: Run): void {
  const here = current(run)!.stop!
  const stop = nextStop(run)!
  if (stop === 'shop' || stop === 'unknown') throw new Error('a shop or unknown stop is arrived at, not advanced to')
  run.decisions = []
  if (stop === 'supply' || stop === 'cache') {
    const before = run.threat
    run.threat = Math.min(run.threat + STOP_THREAT, THREAT_MAX)
    const supplies = stop === 'supply' ? DROP_SUPPLIES : 0
    run.supplies += supplies
    if (stop === 'cache') dropGear(run, run.relics.some((id) => (RELICS[id] as Relic).rareGear))
    run.report = { stop, won: true, threat: { before, after: run.threat }, supplies, key: false, soldiers: [], hired: null, rescued: null }
    passStop(run)
    settle(run)
    return
  }
  const mission = missionAt(run, stop, here.risk, stop === 'battle' ? here.goal : stop === 'escape' ? 'escape' : 'exterminate')
  run.mission = mission
  run.phase = 'battle'
  const doctrines = run.doctrines.map((id): Doctrine => DOCTRINES[id])
  const reserve = run.soldiers.map((s) => ({
    soldier: s.id,
    stats: soldierStats(run, s),
    ability: s.cls && CLASSES[s.cls].ability,
    charges: charges(run, s),
    stance: doctrines.find((d) => d.stance)?.stance ?? (s.cls ? CLASSES[s.cls].stance : ('balanced' as const)),
    effects: [...doctrines.flatMap((d) => d.effect ?? []), ...equipped(s).flatMap((gear) => gear.effect ?? []), ...s.skills.flatMap((id) => SKILLS[id].effect ?? []), ...run.relics.flatMap((id): Relic['effect'][] => [RELICS[id].effect]).flatMap((effect) => effect ?? [])],
  }))
  const rules = doctrines.flatMap((d) => d.rule ?? [])
  run.battle = createBattle(randomInt(run, 2 ** 31), here.terrain, packsOf(run, mission, stop === 'battle' ? here.packs : undefined), reserve, mission.goal, rules, here.twist)
}

/** What a soldier still standing earns from a battle, after the feats it ends the battle with are recorded. */
function earn(battle: Battle, soldier: Soldier, won: boolean, rescued: number | null): { earned: Earned[]; feats: FeatId[] } {
  const tally = battle.tally[soldier.id] ?? { dealt: 0, kills: 0, taken: 0, feats: [] }
  const unit = battle.units.find((u) => u.soldier === soldier.id)!
  if (won && tally.taken === 0) tally.feats.push('untouched')
  if (won && unit.hp <= 2) tally.feats.push('lastLegs')
  const feats = tally.feats.filter((id) => !soldier.feats.includes(id))
  soldier.feats.push(...feats)
  const saved = won ? (rescued ?? 0) : 0
  const earned: Earned[] = [
    { label: 'survived', xp: XP.survived },
    { label: 'won', xp: won ? XP.won : 0 },
    { label: `${tally.kills} kill${tally.kills === 1 ? '' : 's'}`, xp: tally.kills * XP.kill },
    { label: `${tally.dealt} damage`, xp: Math.floor(tally.dealt / XP.damage) },
    { label: `${saved} civilians saved`, xp: saved * XP.civilian },
    ...feats.map((id) => ({ label: FEATS[id].name, xp: XP.feat })),
  ]
  return { earned: earned.filter((e) => e.xp > 0), feats }
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
  const won = battle.winner === 'human'
  const rescued = mission.goal === 'rescue' ? battle.saved + battle.units.filter((u) => u.civilian).length : null
  const soldiers = run.soldiers.map((s) => {
    const xpBefore = s.xp
    const { earned, feats } = standing.has(s.id) ? earn(battle, s, won, rescued) : { earned: [], feats: [] }
    s.xp += earned.reduce((sum, e) => sum + e.xp, 0)
    return { id: s.id, name: s.name, cls: s.cls, xpBefore, xpAfter: s.xp, downed: !standing.has(s.id), earned, feats }
  })

  const before = run.threat
  const risk = RISKS[mission.risk]
  // An escape won empties the threat; any other battle is a stop, and adds to it.
  if (mission.kind === 'escape') run.threat = won ? 0 : run.threat
  else run.threat = Math.min(run.threat + STOP_THREAT + (won ? 0 : LOSS_THREAT) + (mission.goal === 'raid' ? Math.max(0, battle.greed - 1) : 0) + (rescued === null ? 0 : Math.floor((CIVILIANS - (won ? rescued : 0)) / CIVILIANS_PER_THREAT)), THREAT_MAX)
  const held = run.relics.map((id): Relic => RELICS[id])
  const supplies = won ? risk.supplies * (mission.goal === 'raid' ? battle.grabbed : 1) + (rescued ?? 0) * (CIVILIAN_SUPPLIES + held.reduce((sum, relic) => sum + (relic.civilianSupplies ?? 0), 0)) + held.reduce((sum, relic) => sum + (relic.supplies ?? 0), 0) : 0
  const downed = mission.kind === 'escape' ? soldiers.filter((s) => s.downed).length * ESCAPE_DOWNED_SUPPLIES : 0
  run.supplies = Math.max(0, run.supplies + supplies - downed)
  // A won battle drops gear by its goal; a key mission's, an escape's, and the first of an Overrun battle's is rare or better.
  const byGoal = { exterminate: risk.drops, assassinate: Math.max(1, risk.drops), hold: 0, rescue: 0, raid: 0, escape: 0 }[mission.goal]
  const drops = won && mission.kind !== 'final' ? (mission.kind === 'battle' ? byGoal : 1) : 0
  for (let i = 0; i < drops; i++) dropGear(run, (risk.rareGear && i === 0) || mission.kind !== 'battle' || held.some((relic) => relic.rareGear))
  const key = won && mission.kind === 'key'
  // Each key won brings a new clone to the squad.
  const hired = key && !run.doctrines.some((id) => (DOCTRINES[id] as Doctrine).noRecruits) ? hire(run).name : null
  run.report = { stop: mission.kind, won, threat: { before, after: run.threat }, supplies: supplies - downed, key, soldiers, hired, rescued }

  if (mission.kind === 'final' || (mission.kind === 'escape' && !won)) {
    run.phase = won ? 'won' : 'lost'
    return
  }
  // A key mission lost is fought again; an escape stands in front of the stop it interrupted.
  if (key) {
    run.keys++
    run.stop = 0
    drawStops(run)
    onward(run)
  }
  if (mission.kind === 'battle') passStop(run)
  // A satellite, an escape, a hold or an Overrun battle won offers relics.
  if (won && (mission.kind !== 'battle' || mission.goal === 'hold' || mission.risk === 'dangerous')) {
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
