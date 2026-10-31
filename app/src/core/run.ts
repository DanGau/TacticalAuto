import { RARITY_CHANCE, type Lasting, type Rarity } from './base'
import { TUNING } from './tuning'
import { ALIENS, alienStats, muster, type AlienKind } from './aliens'
import { CIVILIAN_SUPPLIES, CIVILIANS, CIVILIANS_PER_THREAT, GOALS, type Goal } from './goals'
import { BASE_STATS, createBattle, holdCaptives, type Alien, type Battle, type Reserve, type Stats } from './battle'
import { CLASSES, type ClassId } from './classes'
import { CONSUMABLE_DROP, CONSUMABLE_IDS, KIT_SLOTS, SHOP_CONSUMABLES, type ConsumableId } from './consumables'
import { DOCTRINES, type Doctrine, type DoctrineId } from './doctrines'
import type { EventId } from './events'
import { FEATS, type FeatId, type Tally } from './feats'
import { EFFECTS, generateGear, SLOTS, starterRifle, type Gear, type Slot } from './gear'
import { MELEE_RANGE, WEAPONS } from './weapons'
import { RESISTS, type Keyword, type Resist } from './keywords'
import { offerable, RELIC_OFFERS, RELICS, type Relic, type RelicId } from './relics'
import { roots, SKILLS, TREES, type Role, type SkillId } from './skills'
import { ZONE_TERRAINS, type TerrainKind } from './terrain'
import { drawTwist, type Twist } from './twists'
import { random, randomInt } from './rng'
import { TRAITS, type Trait, type TraitId } from './traits'
import { REGION_IDS, REGIONS, type RegionId } from './regions'
import { TOWNS } from './towns'
import { along, arc, CONTINENT_IDS, CONTINENTS, HUB, type City, type ContinentId, type LonLat } from './world'

/** Access keys needed to find the alien source; each is won at a satellite, at the end of a leg. */
export const KEYS = 3
/** Stops on each leg before its satellite, whichever way the squad goes. */
export const LEG_STOPS = 9
/** Rows a leg's map spreads across, and trails that wander them from start to satellite. */
export const MAP_ROWS = 5
const TRAILS = 4
/** Threat at which the next stop becomes an ambush. */
export const THREAT_MAX = 24
/** Threat each stop adds, and what losing a battle adds on top. */
export const STOP_THREAT = 2
export const LOSS_THREAT = 1
export const START_SUPPLIES = 3
/** What an assassination's commander has over a trooper, its guards, and the depth from which it has one more. */
export const COMMANDER = { hp: 6, armor: 2, guards: 2, moreFrom: 3 }
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
 * A shop sells gear, relics and a bribe. At a medic the squad heals, or takes a bonus at full health. An unknown stop is revealed on arrival as a battle, a shop or an event.
 * A key mission, at a satellite, wins an access key; the final mission strikes the alien source. Both have a boss.
 */
export type StopKind = 'battle' | 'supply' | 'cache' | 'shop' | 'unknown' | 'medic' | 'key' | 'final'

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
  /** How the town it is fought in is built, and the place it is named for; drawn by the battle when absent. */
  region?: RegionId
  city?: string
}

/**
 * A stage of the journey across the globe: a leg crossing a continent from where the last ended to the city where an
 * elite hero waits to be extracted, or the last, from there to the alien hub.
 */
export interface Stage {
  continent: ContinentId | null
  from: LonLat
  to: City
  /** Who waits at the stage's end; none at the hub. */
  hero: Soldier | null
}

/** A stop on a leg's map: its row, the stops in the next column it leads to, and the stop, null until its leg begins. */
export interface MapNode {
  row: number
  next: number[]
  stop: Stop | null
  /** The town the stop is at, and where it lies; set once the route is plotted. */
  town: string | null
  at: LonLat | null
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
 * A battle to fight. An ambush comes when threat is full, and a recovery when the aliens hold soldiers, in place of
 * the next stop; losing either loses the run, as does losing the final mission. `force` is what the aliens can muster: a trooper costs one, and some kinds
 * cost two or come in pairs.
 */
export interface Mission {
  kind: 'battle' | 'key' | 'final' | 'ambush' | 'recovery'
  goal: Goal
  risk: Risk
  force: number
}

export interface Soldier {
  id: number
  name: string
  xp: number
  /** Drawn at random when the soldier is made. */
  cls: ClassId | null
  /** In the order learned; the first, drawn at random when the soldier is made, sets the soldier's path. */
  skills: SkillId[]
  /** Feats it has pulled off, each paying experience only the first time. */
  feats: FeatId[]
  gear: Record<Slot, Gear | null>
  /** The quirk it was recruited with, if any. */
  trait: TraitId | null
  /** Where it comes from: a recruit's home, a hero's city; none for one who joined on the road. */
  home: City | null
  /** Health lost and not yet healed; it carries from battle to battle. */
  wounds: number
  /** Draws the skills it is offered at each level. */
  seed: number
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
   * Every soldier in the squad when a battle began, with the class each has after it; empty for an event. A taken
   * soldier was left downed on the field, and the aliens hold it. `earned` is what its experience came from; `feats`,
   * those first pulled off; `tally`, what it did in the battle.
   */
  soldiers: { id: number; name: string; cls: ClassId | null; xpBefore: number; xpAfter: number; taken: boolean; earned: Earned[]; feats: FeatId[]; hp: number; maxHp: number; tally: Tally }[]
  /** The name of the hero the stop added to the squad. */
  hired: string | null
  /** Civilians kept alive on a rescue; null on any other stop. */
  rescued: number | null
  /** A consumable the stop turned up, now in the kit. */
  found: ConsumableId | null
}

/** Experience from one source. */
export interface Earned {
  label: string
  xp: number
}

/** A shop's stock, each item staying in its place once sold, and whether its bribe is spent. */
export interface Shop {
  wares: { gear: Gear; sold: boolean }[]
  relics: { id: RelicId; sold: boolean }[]
  consumables: { id: ConsumableId; sold: boolean }[]
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
  /** Gear found and not yet put on a soldier the player picks, or sold. */
  finds: Gear[]
  nextGear: number
  relics: RelicId[]
  /** Consumables carried, at most KIT_SLOTS, each used once in a battle. */
  kit: ConsumableId[]
  /** Relics to choose from in the reward phase. */
  relicOffers: RelicId[]
  /** At the run's start, the recruits to choose the first soldier from. */
  recruits: Soldier[]
  /** The journey across the globe, a stage for each leg; set once the first soldier is chosen, from its home. */
  route: Stage[]
  /** What each leg's boss resists, by keys won; known from the start so the squad can build to beat it. */
  bosses: Resist[]
  /** Soldiers the aliens hold, by id: left downed on a field. The next stop is a recovery until they are back. */
  captives: number[]
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
export const XP = { fought: 1, won: 2, kill: 1, damage: 5, civilian: 1, feat: 2 }

/** The sum of one lasting effect over every relic and doctrine held. */
function total(run: Run, effect: (source: Lasting) => number | undefined): number {
  const sources: Lasting[] = [...run.relics.map((id): Relic => RELICS[id]), ...run.doctrines.map((id): Doctrine => DOCTRINES[id])]
  return sources.reduce((sum, source) => sum + (effect(source) ?? 0), 0)
}

/** Skills a soldier knows at most: a root, then one more at each level until it has this many. */
export const MAX_SKILLS = 4
/** Skills a level offers to choose from: one of each role while the tree has one open. */
export const OFFERS = 3
const ROLES: Role[] = ['guard', 'control', 'power']

/**
 * The skills a soldier chooses the next from, or none if no choice is owed: from those its class's tree has opened to
 * it, one of each role when one is open, filled from the rest, drawn by its own seed so the offer stays put until
 * chosen. A skill passed over may be offered again.
 */
export function skillOffers(soldier: Soldier): SkillId[] {
  if (!soldier.cls || soldier.skills.length >= Math.min(level(soldier), MAX_SKILLS)) return []
  const known = (id: string) => soldier.skills.includes(id as SkillId)
  const open = TREES[soldier.cls].filter((id) => !known(id) && (SKILLS[id].after?.some(known) ?? true))
  const rng = { rng: soldier.seed + soldier.skills.length }
  const drawn = open.map((id) => ({ id, at: random(rng) })).sort((a, b) => a.at - b.at).map((d) => d.id)
  const offers = ROLES.flatMap((role) => drawn.find((id) => SKILLS[id].role === role) ?? [])
  return [...offers, ...drawn.filter((id) => !offers.includes(id))].slice(0, OFFERS)
}

/** Learns the offered skill at `index`. */
export function takeSkill(run: Run, soldier: Soldier, index: number): void {
  soldier.skills.push(skillOffers(soldier)[index])
  settle(run)
}

export function equipped(soldier: Soldier): Gear[] {
  return SLOTS.flatMap((slot) => soldier.gear[slot] ?? [])
}

/** Puts `gear` on `soldier`, selling what it had in the slot: gear is never taken off, only replaced. */
function wear(run: Run, soldier: Soldier, gear: Gear): void {
  const old = soldier.gear[gear.slot]
  if (old) run.supplies += SELL[old.rarity]
  soldier.gear[gear.slot] = gear
}

/** Equips the find at `index` on `soldier`. */
export function equipFind(run: Run, index: number, soldier: Soldier): void {
  wear(run, soldier, run.finds.splice(index, 1)[0])
  settle(run)
}

/** What gear costs in a shop, by rarity. */
export const GEAR_PRICE: Record<Exclude<Rarity, 'common'>, number> = { rare: 5, epic: 8 }
/** Pieces of gear and relics a shop stocks. */
export const SHOP_WARES = 5
export const SHOP_RELICS = 4
/** Chance a piece of shop gear is epic rather than rare. */
const SHOP_EPIC = 0.3

/** Stocks a shop: gear, each piece with an effect no other piece there has; relics the squad lacks; and a bribe. */
export function stockShop(run: Run): Shop {
  const wares: Gear[] = []
  for (let tries = 0; wares.length < SHOP_WARES && tries < 50; tries++) {
    const gear = generateGear(run, run.nextGear, random(run) < SHOP_EPIC ? 'epic' : 'rare')
    if (wares.some((w) => w.effect === gear.effect)) continue
    run.nextGear++
    wares.push(gear)
  }
  const relics = offerable(run.relics)
  const stocked: RelicId[] = []
  while (stocked.length < SHOP_RELICS && relics.length > 0) stocked.push(relics.splice(randomInt(run, relics.length), 1)[0])
  const kinds = [...CONSUMABLE_IDS]
  const consumables = Array.from({ length: SHOP_CONSUMABLES }, () => ({ id: kinds.splice(randomInt(run, kinds.length), 1)[0], sold: false }))
  return { wares: wares.map((gear) => ({ gear, sold: false })), relics: stocked.map((id) => ({ id, sold: false })), consumables, bribed: false }
}

/** Buys the ware at `index` for `soldier` to wear. The caller checks it is affordable. */
export function buyWare(run: Run, index: number, soldier: Soldier): void {
  const ware = run.shop!.wares[index]
  ware.sold = true
  const { gear } = ware
  run.supplies -= GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
  wear(run, soldier, gear)
}

/** Sells the find at `index`. */
export function sellFind(run: Run, index: number): void {
  run.supplies += SELL[run.finds.splice(index, 1)[0].rarity]
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

/** Health every soldier heals for each stop travelled to. */
export const TRAVEL_HEAL = 2

/** A soldier's health now: its most less its wounds, never below 1. */
export const health = (run: Run, soldier: Soldier) => Math.max(1, soldierStats(run, soldier).hp - soldier.wounds)

/** Heals every soldier `amount`; Infinity heals fully. */
export function mend(run: Run, amount: number): void {
  for (const s of run.soldiers) s.wounds = Math.max(0, Math.min(s.wounds, soldierStats(run, s).hp - 1) - amount)
}

/** Whether any soldier is below full health. */
export const wounded = (run: Run) => run.soldiers.some((s) => health(run, s) < soldierStats(run, s).hp)

/** A soldier's stats in battle: base, plus class, level, skills, gear and its weapon, plus relics. A melee weapon reaches the next tile. */
export function soldierStats(run: Run, soldier: Soldier): Stats {
  const stats = { ...BASE_STATS }
  const weapon = weaponOf(soldier)
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const fromClass = soldier.cls ? (CLASSES[soldier.cls].stats[key] ?? 0) : 0
    const fromGear = equipped(soldier).reduce((sum, gear) => sum + (gear.stats[key] ?? 0), 0) + (weapon?.stats[key] ?? 0)
    const fromSkills = soldier.skills.reduce((sum, id) => sum + (SKILLS[id].stats?.[key] ?? 0), 0)
    const fromTrait = soldier.trait ? ((TRAITS[soldier.trait] as Trait).stats?.[key] ?? 0) : 0
    stats[key] += fromClass + fromGear + fromSkills + fromTrait + level(soldier) * (LEVEL_STATS[key] ?? 0) + total(run, (u) => u.stats?.[key])
  }
  if (weapon?.melee) stats.range = MELEE_RANGE
  for (const id of run.doctrines) Object.assign(stats, (DOCTRINES[id] as Doctrine).set)
  return stats
}

/** The weapon a soldier wields, if any. */
export const weaponOf = (soldier: Soldier) => (soldier.gear.weapon?.weapon ? WEAPONS[soldier.gear.weapon.weapon] : null)

/**
 * Adds a recruit to the squad and returns it: a level 1 recruit set on one of its class's paths at random. Under a
 * doctrine of unique classes it takes a class no squadmate has, while one is left.
 */
export function hire(run: Run): Soldier {
  return join(run, draft(run, []))
}

/** Adds `soldier` to the squad, with what its trait brings, and returns it. */
function join(run: Run, soldier: Soldier): Soldier {
  soldier.id = run.nextSoldier++
  run.soldiers.push(soldier)
  const trait: Trait | null = soldier.trait ? TRAITS[soldier.trait] : null
  run.supplies += trait?.supplies ?? 0
  run.threat = Math.min(run.threat + (trait?.threat ?? 0), THREAT_MAX)
  if (trait?.relic) {
    const unheld = offerable(run.relics)
    if (unheld.length > 0) run.relics.push(unheld[randomInt(run, unheld.length)])
  }
  return soldier
}

/** A level 1 soldier of a class none of `taken` has, if one is left, not yet in the squad. */
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
    skills: [roots(cls)[randomInt(run, roots(cls).length)]],
    // Read, not drawn: the seed costs the run no draw.
    seed: run.rng,
    feats: [],
    gear: { weapon: starterRifle(run.nextGear++), armor: null, utility: null },
    trait: null,
    home: null,
    wounds: 0,
  }
  return soldier
}

/** Recruits offered at a run's start. */
export const RECRUITS = 3

/**
 * Offers the run's first soldier: recruits of different classes from different continents, one plain and the rest
 * each with a different trait.
 */
function offerRecruits(run: Run): void {
  const traits = Object.keys(TRAITS) as TraitId[]
  const continents = [...CONTINENT_IDS]
  const plain = randomInt(run, RECRUITS)
  for (let i = 0; i < RECRUITS; i++) {
    const recruit = draft(run, run.recruits.map((r) => r.cls!))
    const cities: City[] = CONTINENTS[continents.splice(randomInt(run, continents.length), 1)[0]].cities
    recruit.home = cities[randomInt(run, cities.length)]
    if (i !== plain) recruit.trait = traits.splice(randomInt(run, traits.length), 1)[0]
    // A recruit joining above level 1 has already learned a skill for each level.
    const joins = recruit.trait ? (TRAITS[recruit.trait] as Trait).level : undefined
    if (joins) recruit.xp = xpFor(joins)
    for (let offers = skillOffers(recruit); offers.length > 0; offers = skillOffers(recruit)) recruit.skills.push(offers[randomInt(run, offers.length)])
    run.recruits.push(recruit)
  }
}

/** Takes the recruit at `index` as the run's first soldier, with what its trait brings, and sets out from its home. */
export function recruit(run: Run, index: number): void {
  const soldier = run.recruits[index]
  run.recruits = []
  run.route = plotRoute(run, soldier.home!)
  run.route.forEach((stage, l) => placeLeg(run, run.legs[l], stage))
  drawStops(run)
  join(run, soldier)
  settle(run)
}

/** A hero's level: elite, it joins seasoned, its skills learned. */
const HERO_LEVEL = 2

/**
 * The journey from `home`: across its own continent to a hero in another of its cities, then on to the nearest
 * continent not yet crossed, a leg each, and at last to the alien hub. A hero waits at each leg's end.
 */
function plotRoute(run: Run, home: City): Stage[] {
  const route: Stage[] = []
  const left = [...CONTINENT_IDS]
  let from = home
  for (let leg = 0; leg < KEYS; leg++) {
    const continent = leg === 0 ? left.find((id) => CONTINENTS[id].cities.some((c) => c.name === home.name))! : left.reduce((a, b) => (nearest(b, from.at) < nearest(a, from.at) ? b : a))
    left.splice(left.indexOf(continent), 1)
    const cities: City[] = CONTINENTS[continent].cities.filter((c) => c.name !== from.name)
    const to = cities[randomInt(run, cities.length)]
    const hero = draft(run, [])
    hero.home = to
    hero.xp = xpFor(HERO_LEVEL)
    // A hero has a quirk of its own, as a recruit does, though never one that sets its level.
    const quirks = (Object.keys(TRAITS) as TraitId[]).filter((id) => !(TRAITS[id] as Trait).level)
    hero.trait = quirks[randomInt(run, quirks.length)]
    for (let offers = skillOffers(hero); offers.length > 0; offers = skillOffers(hero)) hero.skills.push(offers[randomInt(run, offers.length)])
    route.push({ continent, from: from.at, to, hero })
    from = to
  }
  route.push({ continent: null, from: from.at, to: HUB, hero: null })
  return route
}

/**
 * Sets each stop of a leg on the way across its continent, as a traveller would plan the trip: each column of stops
 * a step along the way from where the leg begins to its hero's city, the steps of uneven length, each row to one
 * side or the other in order, so no two trails cross. Each stop is at a real town: the nearest one unused within its
 * step, the step widened until one is found. The leg ends at the hero's city; the hub's leg at the hub.
 */
function placeLeg(run: Run, leg: Leg, stage: Stage): void {
  const end = leg.columns.length - 1
  leg.columns[end][0].at = stage.to.at
  leg.columns[end][0].town = stage.to.name
  if (!stage.continent) return
  // A flat map of the way, x along it from start to end and y across it, in degrees.
  const scale = Math.cos(((stage.from[1] + stage.to.at[1]) / 2) * (Math.PI / 180))
  const flat = ([lon, lat]: LonLat) => {
    let dlon = lon - stage.from[0]
    if (dlon > 180) dlon -= 360
    if (dlon < -180) dlon += 360
    return { x: dlon * scale, y: lat - stage.from[1] }
  }
  const goal = flat(stage.to.at)
  const length = Math.hypot(goal.x, goal.y) || 1
  const towns = TOWNS[stage.continent]
    .filter(([name]) => name !== stage.to.name)
    .map(([name, at]) => {
      const p = flat(at)
      return { name, at, t: (p.x * goal.x + p.y * goal.y) / length / length, d: (p.y * goal.x - p.x * goal.y) / length }
    })
  const used = new Set<string>()
  const step = 1 / (end + 1)
  const gap = Math.max(MIN_ROW_GAP, length * ROW_SPREAD)
  leg.columns.slice(0, end).forEach((column, c) => {
    // Each column a step along the way, some steps longer than others.
    const t = (c + 1 + (random(run) - 0.5) * 0.6) * step
    const picks = column.map((node) => {
      const d = (node.row - (MAP_ROWS - 1) / 2 + (random(run) - 0.5) * 0.4) * gap
      const far = (town: (typeof towns)[number]) => Math.hypot((town.t - t) * length, town.d - d)
      const free = towns.filter((town) => !used.has(town.name))
      for (let window = step / 2; free.length > 0; window += step / 2) {
        const near = free.filter((town) => Math.abs(town.t - t) <= window).sort((a, b) => far(a) - far(b))[0]
        if (near) {
          used.add(near.name)
          return near
        }
      }
      // A continent out of towns: the stop stands where it falls.
      return { name: null, at: offset(stage, t, d), d }
    })
    // Rows take their towns in order across the way, so no two trails cross.
    picks.sort((a, b) => a.d - b.d)
    column.forEach((node, i) => {
      node.town = picks[i].name
      node.at = picks[i].at
    })
  })
}

/** The least gap between rows, in degrees. */
const MIN_ROW_GAP = 1.2

/** The place a share `t` of the way along a stage, `d` degrees to its left. */
function offset(stage: Stage, t: number, d: number): LonLat {
  const at = along(stage.from, stage.to.at, t)
  const ahead = along(stage.from, stage.to.at, Math.min(1, t + 0.01))
  const scale = Math.cos(at[1] * (Math.PI / 180))
  const dx = (ahead[0] - at[0]) * scale
  const dy = ahead[1] - at[1]
  const len = Math.hypot(dx, dy) || 1
  return [at[0] + ((-dy / len) * d) / scale, at[1] + (dx / len) * d]
}

/** How far apart a leg's rows of stops lie across its way, as a share of its length. */
const ROW_SPREAD = 0.07

/** How near a continent's nearest city lies to `at`, in degrees round the globe. */
const nearest = (id: ContinentId, at: LonLat) => Math.min(...CONTINENTS[id].cities.map((c) => arc(c.at, at)))

/** Whether the squad is in the second half of its leg, where aliens are stronger. */
const late = (run: Run) => run.stop >= LEG_STOPS / 2

/** How far along the road the squad is, which sets which packs appear and how much armor aliens wear: two steps a leg, the second halfway. */
function depth(run: Run): number {
  return run.keys * 2 + (late(run) ? 1 : 0)
}

/** The force the hunt adds to a mission: at full threat, TUNING.hunt of its own. */
export const huntForce = (run: Run, mission: Mission) => Math.round((mission.force * TUNING.hunt * run.threat) / THREAT_MAX)

/** The mission the squad would fight at a stop of the given kind now. Its force follows the leg, and so the size of the squad. */
export function missionAt(run: Run, kind: Mission['kind'], risk: Risk, goal: Goal = 'exterminate'): Mission {
  // A recovery's aliens come at a third of their strength, but keep coming.
  const extra = { battle: 0, key: 1, final: 0, ambush: run.keys, recovery: -Math.ceil((2 * TUNING.legForce[run.keys]) / 3) }[kind]
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
const HARVESTERS_MORE_FROM = 2

/** What an ambush's Hunter multiplies the strongest soldier's health and damage by. */
const HUNTER = { hp: 1.3, damage: 1.2 }

/** A goal drawn by GOALS' weights, among those the leg of `when` has. */
function drawGoal(run: Run, when: Run): Goal {
  const goals = (Object.keys(GOALS) as Goal[]).filter((goal) => GOALS[goal].from <= when.keys)
  let roll = random(run) * goals.reduce((sum, goal) => sum + GOALS[goal].weight, 0)
  return goals.find((goal) => (roll -= GOALS[goal].weight) < 0) ?? 'exterminate'
}

/** How likely a stop past a leg's first column is to be each kind other than a battle; the rest are battles. */
export const STOP_CHANCE = { unknown: 0.25, shop: 0.1, medic: 0.1, supply: 0.08, cache: 0.08 }

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
    column.map((row): MapNode => ({ row, stop: null, town: null, at: null, next: c === LEG_STOPS - 1 ? [0] : [...edges[c].get(row)!].sort((a, b) => a - b).map((r) => rows[c + 1].indexOf(r)) })),
  )
  return [...nodes, [{ row: Math.floor(MAP_ROWS / 2), next: [], stop: null, town: null, at: null }]]
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
      node.stop = c === LEG_STOPS ? { ...fixed('key', 'compound'), ...placed(run, 'compound'), city: run.route[run.keys].to.name } : kind ? fixed(kind, 'town') : drawBattle(run, risks[randomInt(run, risks.length)], { ...run, stop: c })
      // A stop is named for the town it is at.
      if (node.town) node.stop.city = node.town
    }
  })
}

/** Where on the continent under way a battle of `kind` is fought: a region it is built like there, and a city of it. */
function placed(run: Run, kind: TerrainKind): { region: RegionId; city: string } {
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
    nextGear: 1,
    relics: [],
    kit: [],
    relicOffers: [],
    recruits: [],
    route: [],
    bosses: [],
    shop: null,
    event: null,
    met: [],
    doctrines: [],
    captives: [],
  }
  offerRecruits(run)
  run.legs = Array.from({ length: KEYS + 1 }, (_, k) => ({ columns: k === KEYS ? [[{ row: Math.floor(MAP_ROWS / 2), next: [], stop: null, town: null, at: null }]] : drawShape(run), path: [] }))
  run.phase = 'recruit'
  const resists = Object.keys(RESISTS) as Resist[]
  run.bosses = Array.from({ length: KEYS + 1 }, () => resists[randomInt(run, resists.length)])
  return run
}

/**
 * The stop the squad travels to next: a recovery if the aliens hold soldiers, an ambush if threat is full, else the
 * stop it has entered. Null while it chooses.
 */
export function nextStop(run: Run): StopKind | 'ambush' | 'recovery' | null {
  const node = current(run)
  if (!node) return null
  return run.captives.length > 0 ? 'recovery' : run.threat >= THREAT_MAX ? 'ambush' : node.stop!.kind
}

/** A random rarity; `lucky` rules out common. */
function rollRarity(run: Run, lucky: boolean): Rarity {
  let roll = random(run)
  if (lucky) roll = RARITY_CHANCE.common + roll * (1 - RARITY_CHANCE.common)
  return roll < RARITY_CHANCE.common ? 'common' : roll < RARITY_CHANCE.common + RARITY_CHANCE.rare ? 'rare' : 'epic'
}

/** A piece of gear found, for the player to put on a soldier or sell. */
export function dropGear(run: Run, lucky: boolean): void {
  run.finds.push(generateGear(run, run.nextGear++, rollRarity(run, lucky)))
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
  if (stop === 'shop' || stop === 'unknown' || stop === 'medic') throw new Error('a shop, medic or unknown stop is arrived at, not advanced to')
  if (stop === 'supply' || stop === 'cache') {
    const before = run.threat
    run.threat = Math.min(run.threat + STOP_THREAT, THREAT_MAX)
    const supplies = stop === 'supply' ? DROP_SUPPLIES : 0
    run.supplies += supplies
    if (stop === 'cache') dropGear(run, run.relics.some((id) => (RELICS[id] as Relic).rareGear))
    run.report = { stop, won: true, threat: { before, after: run.threat }, supplies, key: false, soldiers: [], hired: null, rescued: null, found: null }
    passStop(run)
    settle(run)
    return
  }
  const goal = stop === 'battle' ? here.goal : stop === 'ambush' ? 'ambush' : stop === 'recovery' ? 'recover' : 'exterminate'
  const mission = missionAt(run, stop, stop === 'recovery' ? 'standard' : here.risk, goal)
  run.mission = mission
  run.phase = 'battle'
  const doctrines = run.doctrines.map((id): Doctrine => DOCTRINES[id])
  const reserve = run.soldiers.map((s): Reserve => ({
    soldier: s.id,
    stats: soldierStats(run, s),
    hp: health(run, s),
    ability: s.cls && CLASSES[s.cls].ability,
    charges: charges(run, s),
    stance: doctrines.find((d) => d.stance)?.stance ?? weaponOf(s)?.stance ?? (s.cls ? CLASSES[s.cls].stance : ('balanced' as const)),
    effects: [...doctrines.flatMap((d) => d.effect ?? []), ...[weaponOf(s)].flatMap((w) => w?.effect ?? []),...equipped(s).flatMap((gear) => gear.effect ?? []), ...s.skills.flatMap((id) => SKILLS[id].effect ?? []), ...run.relics.flatMap((id): Relic['effect'][] => [RELICS[id].effect]).flatMap((effect) => effect ?? [])],
  }))
  const rules = doctrines.flatMap((d) => d.rule ?? [])
  const held = (r: Reserve) => run.captives.includes(r.soldier)
  run.battle = createBattle(randomInt(run, 2 ** 31), here.terrain, packsOf(run, mission, stop === 'battle' ? here.packs : undefined), reserve.filter((r) => !held(r)), mission.goal, rules, here.twist, here.region && here.city ? { region: here.region, city: here.city } : undefined)
  holdCaptives(run.battle, reserve.filter(held))
}

/** What a soldier earns from a battle, after the feats it ends the battle with are recorded. */
function earn(battle: Battle, soldier: Soldier, won: boolean, rescued: number | null): { earned: Earned[]; feats: FeatId[]; tally: Tally } {
  const tally = battle.tally[soldier.id] ?? { dealt: 0, kills: 0, taken: 0, shots: 0, hits: 0, feats: [] }
  // A soldier lifted off has left the field.
  const unit = battle.units.find((u) => u.soldier === soldier.id)
  if (won && tally.taken === 0) tally.feats.push('untouched')
  if (won && unit && unit.hp <= 2) tally.feats.push('lastLegs')
  const feats = tally.feats.filter((id) => !soldier.feats.includes(id))
  soldier.feats.push(...feats)
  const saved = won ? (rescued ?? 0) : 0
  const earned: Earned[] = [
    { label: 'fought', xp: XP.fought },
    { label: 'won', xp: won ? XP.won : 0 },
    { label: `${tally.kills} kill${tally.kills === 1 ? '' : 's'}`, xp: tally.kills * XP.kill },
    { label: `${tally.dealt} damage`, xp: Math.floor(tally.dealt / XP.damage) },
    { label: `${saved} civilians saved`, xp: saved * XP.civilian },
    ...feats.map((id) => ({ label: FEATS[id].name, xp: XP.feat })),
  ]
  return { earned: earned.filter((e) => e.xp > 0), feats, tally }
}

/**
 * Settles a finished battle: experience, threat, rewards, and where the squad stands on the road. Every soldier earns
 * experience. A soldier downed comes home if the squad won with a soldier standing on the field. Otherwise only
 * those carried out do, and the aliens take the rest. A wipe, with none standing or lifted off, loses the run.
 */
export function endBattle(run: Run): void {
  const battle = run.battle!
  const mission = run.mission!
  const won = battle.winner === 'human'
  // A wipe, every soldier downed and none lifted off, loses the run.
  const standing = battle.units.some((u) => u.side === 'human' && u.soldier !== null)
  const wiped = !standing && battle.escaped.length === 0
  const field = won && standing
  const taken = new Set(field ? [] : battle.downed.map((d) => d.soldier))
  // A recovery won brings every captive home.
  run.captives = mission.kind === 'recovery' && won ? [] : [...new Set([...run.captives, ...taken])]
  const rescued = mission.goal === 'rescue' ? battle.saved + battle.units.filter((u) => u.civilian).length : null
  const soldiers = run.soldiers.map((s) => {
    const xpBefore = s.xp
    const { earned, feats, tally } = earn(battle, s, won, rescued)
    s.xp += earned.reduce((sum, e) => sum + e.xp, 0)
    // Health carries on: what it ends standing or lifted off with; downed, it comes back at 1.
    const maxHp = soldierStats(run, s).hp
    const hp = Math.max(1, Math.min(maxHp, battle.units.find((u) => u.soldier === s.id)?.hp ?? battle.lifted[s.id] ?? 0))
    s.wounds = maxHp - hp
    return { id: s.id, name: s.name, cls: s.cls, xpBefore, xpAfter: s.xp, taken: run.captives.includes(s.id), earned, feats, hp, maxHp, tally }
  })

  const before = run.threat
  const risk = RISKS[mission.risk]
  // An ambush won empties the threat; any other battle is a stop, and adds to it.
  if (mission.kind === 'ambush') run.threat = won ? 0 : run.threat
  else if (mission.kind !== 'recovery') run.threat = Math.min(run.threat + STOP_THREAT + (won ? 0 : LOSS_THREAT) + (mission.goal === 'raid' ? Math.max(0, battle.greed - 1) : 0) + (rescued === null ? 0 : Math.floor((CIVILIANS - (won ? rescued : 0)) / CIVILIANS_PER_THREAT)), THREAT_MAX)
  const held = run.relics.map((id): Relic => RELICS[id])
  const supplies = won ? risk.supplies * (mission.goal === 'raid' ? battle.grabbed : 1) + (rescued ?? 0) * (CIVILIAN_SUPPLIES + held.reduce((sum, relic) => sum + (relic.civilianSupplies ?? 0), 0)) + held.reduce((sum, relic) => sum + (relic.supplies ?? 0), 0) : 0
  run.supplies += supplies
  // A won battle drops gear by its goal; a key mission's, an ambush's, and the first of an Overrun battle's is rare or better.
  const byGoal = { exterminate: risk.drops, assassinate: Math.max(1, risk.drops), hold: 0, rescue: 0, vip: 0, raid: 0, ambush: 0, recover: 0 }[mission.goal]
  const drops = won && mission.kind !== 'final' && mission.kind !== 'recovery' ? (mission.kind === 'battle' ? byGoal : 1) : 0
  for (let i = 0; i < drops; i++) dropGear(run, (risk.rareGear && i === 0) || mission.kind !== 'battle' || held.some((relic) => relic.rareGear))
  const found = won && mission.kind !== 'final' && run.kit.length < KIT_SLOTS && random(run) < CONSUMABLE_DROP ? CONSUMABLE_IDS[randomInt(run, CONSUMABLE_IDS.length)] : null
  if (found) run.kit.push(found)
  const key = won && mission.kind === 'key'
  // Each hero extracted joins the squad.
  const hero = run.route[run.keys]?.hero
  const hired = key && hero && !run.doctrines.some((id) => (DOCTRINES[id] as Doctrine).noRecruits) ? join(run, hero).name : null
  run.report = { stop: mission.kind, won, threat: { before, after: run.threat }, supplies, key, soldiers, hired, rescued, found }

  // Losing the hero's extraction, an ambush, a recovery or the hub loses the run, as does a wipe.
  if (mission.kind === 'final' || (mission.kind !== 'battle' && !won) || wiped) {
    run.phase = mission.kind === 'final' && won ? 'won' : 'lost'
    return
  }
  // An ambush stands in front of the stop it interrupted.
  if (key) {
    run.keys++
    run.stop = 0
    drawStops(run)
    onward(run)
  }
  if (mission.kind === 'battle') passStop(run)
  // A satellite, an ambush, a hold, a VIP rescue or an Overrun battle won offers relics.
  if (won && (mission.kind === 'key' || mission.kind === 'ambush' || (mission.kind === 'battle' && (mission.goal === 'hold' || mission.goal === 'vip' || mission.risk === 'dangerous')))) {
    const pool = offerable(run.relics)
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
