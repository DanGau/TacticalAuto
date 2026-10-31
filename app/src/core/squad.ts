// Soldiers: experience and levels, skills, stats and health, and hiring.
import type { Lasting } from './base'
import { type Battle, type Stats, BASE_STATS } from './battle'
import { CLASSES, type ClassId } from './classes'
import { type Doctrine, DOCTRINES } from './doctrines'
import { EFFECTS, type Gear, SLOTS, starterRifle } from './gear'
import { offerable, type Relic, RELICS } from './relics'
import { random, randomInt } from './rng'
import { type Run } from './run-state'
import { type Earned } from './run-state'
import { type Soldier } from './run-state'
import { TREES, SKILLS, type Role, type SkillId, roots } from './skills'
import { MELEE_RANGE, WEAPONS } from './weapons'
import { TRAITS, type Trait, type TraitId } from './traits'
import { THREAT_MAX } from './progress'
import { CONTINENT_IDS, type City, CONTINENTS } from './world'
import type { Keyword } from './keywords'
import { type FeatId, type Tally, FEATS } from './feats'

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
export function total(run: Run, effect: (source: Lasting) => number | undefined): number {
  const sources: Lasting[] = [...run.relics.map((id): Relic => RELICS[id]), ...run.doctrines.map((id): Doctrine => DOCTRINES[id])]
  return sources.reduce((sum, source) => sum + (effect(source) ?? 0), 0)
}

/** Skills a soldier knows at most: a root, then one more at each level until it has this many. */
export const MAX_SKILLS = 4

/** Skills a level offers to choose from: one of each role while the tree has one open. */
export const OFFERS = 3

export const ROLES: Role[] = ['guard', 'control', 'power']

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

export function equipped(soldier: Soldier): Gear[] {
  return SLOTS.flatMap((slot) => soldier.gear[slot] ?? [])
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

/** What each level adds to a soldier's stats. */
export const LEVEL_STATS: Partial<Stats> = { hp: 2, crit: 0.03 }

/**
 * Adds a recruit to the squad and returns it: a level 1 recruit set on one of its class's paths at random. Under a
 * doctrine of unique classes it takes a class no squadmate has, while one is left.
 */
export function hire(run: Run): Soldier {
  return join(run, draft(run, []))
}

/** Adds `soldier` to the squad, with what its trait brings, and returns it. */
export function join(run: Run, soldier: Soldier): Soldier {
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
export function draft(run: Run, taken: ClassId[]): Soldier {
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

export const NAMES = ['Vega', 'Okafor', 'Lindqvist', 'Tanaka', 'Reyes', 'Novak', 'Haddad', 'Brandt', 'Silva', 'Kowalski', 'Mbeki', 'Dufour', 'Ivanov', 'Castillo', 'Ng', 'Shaw']

/** Recruits offered at a run's start. */
export const RECRUITS = 3

/**
 * Offers the run's first soldier: recruits of different classes from different continents, one plain and the rest
 * each with a different trait.
 */
export function offerRecruits(run: Run): void {
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

/** The keywords of everything the squad has: its soldiers' skills and gear, and its relics. */
export function squadKeywords(run: Run): Keyword[] {
  const tags = [
    ...run.soldiers.flatMap((s) => [...s.skills.map((id) => SKILLS[id].tags ?? []), ...equipped(s).map((gear) => (gear.effect && EFFECTS[gear.effect].tags) || [])]),
    ...run.relics.map((id) => RELICS[id].tags ?? []),
  ].flat()
  return [...new Set(tags)]
}

/** What a soldier earns from a battle, after the feats it ends the battle with are recorded. */
export function earn(battle: Battle, soldier: Soldier, won: boolean, rescued: number | null): { earned: Earned[]; feats: FeatId[]; tally: Tally } {
  const tally = battle.tally[soldier.id] ?? { dealt: 0, kills: 0, taken: 0, feats: [] }
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
