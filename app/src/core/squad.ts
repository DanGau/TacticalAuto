// Soldiers: experience and levels, skills, stats and health, and hiring.
import type { SecondaryId } from './secondaries'
import type { Lasting } from './base'
import { type Battle, type Stats, BASE_STATS } from './battle'
import { CLASSES, type ClassId } from './classes'
import { type Doctrine, DOCTRINES } from './doctrines'
import { EFFECTS, plainGear } from './gear'
import { type Relic, RELICS } from './relics'
import { randomInt } from './rng'
import { type Run } from './run-state'
import { type Earned } from './run-state'
import { type Soldier } from './run-state'
import { capstones, depthOf, locked, opensOf, pathOf, powerOf, SKILLS, type SkillId, TREES, treeOf, unlocked } from './skills'
import { MELEE_RANGE, WEAPONS } from './weapons'
import { CONTINENT_IDS, type City, CONTINENTS } from './world'
import type { Keyword } from './keywords'
import { emptyTally, type FeatId, type Tally, FEATS } from './feats'

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

/** The levels at which a soldier earns a power: stats grow every level, powers only at these. A capstone is at most this many picks deep. */
export const PICK_LEVELS = [3, 5, 7, 11]

/** Skills a soldier knows at most: its class power and a pick per pick level. */
export const MAX_SKILLS = PICK_LEVELS.length + 1

/** Powers a soldier has earned by its level. */
export const picksEarned = (soldier: { xp: number }) => PICK_LEVELS.filter((at) => at <= level(soldier)).length

/** Skills offered at a pick, fewer only when fewer are left. */
export const OFFERS = { min: 3, max: 4 }

/** Skills a soldier chose, leaving out the class power it came with. */
export const picksMade = (soldier: Soldier) => soldier.skills.filter((id) => !soldier.cls || id !== powerOf(soldier.cls)).length

/**
 * The skills a soldier chooses the next from, drawn by its seed, or none if no choice is owed: first those its latest
 * pick opened, one of each path among them before the rest, then the rest its tree has open, topped up from the shallowest of the rest so it is never short. Known,
 * lost and locked skills never come, nor a capstone its path has not opened while anything else is left.
 */
export function skillOffers(soldier: Soldier): SkillId[] {
  const cls = soldier.cls
  if (!cls || picksMade(soldier) >= picksEarned(soldier)) return []
  const shut = locked(cls, soldier.skills)
  const left = (ids: SkillId[]) => ids.filter((id) => !soldier.skills.includes(id) && !soldier.lost.includes(id) && !shut.includes(id))
  const open = left(unlocked(cls, soldier.skills))
  const fresh = open.filter((id) => opensOf(cls, soldier.skills.at(-1)!).includes(id))
  const rest = left(treeOf(cls)).filter((id) => !open.includes(id) && !capstones(cls).includes(id))
  const depths = [...new Set(rest.map((id) => depthOf(cls, id)))].sort((a, b) => a - b)
  // One of each path the latest pick opens into comes first, so no path is shut before it is offered.
  const leads = TREES[cls].paths.map((p) => fresh.filter((id) => pathOf(cls, id) === p)).filter((ids) => ids.length > 0)
  const decks = [...leads, fresh, open.filter((id) => !fresh.includes(id)), ...depths.map((d) => rest.filter((id) => depthOf(cls, id) === d))]
  if (open.length + rest.length === 0) decks.push(left(capstones(cls)))
  const rng = { rng: soldier.seed ^ Math.imul(soldier.skills.length + 1, 0x9e3779b1) }
  // A fourth offer only while it leaves enough for the picks still to come.
  const later = PICK_LEVELS.length - picksMade(soldier) - 1
  const roomy = open.length + rest.length - OFFERS.max >= OFFERS.min * later
  const size = OFFERS.min + (roomy ? randomInt(rng, OFFERS.max - OFFERS.min + 1) : 0)
  const offers: SkillId[] = []
  for (const [i, deck] of decks.entries()) {
    const pool = deck.filter((id) => !offers.includes(id))
    for (let n = i < leads.length ? 1 : size; n > 0 && offers.length < size && pool.length > 0; n--) offers.push(pool.splice(randomInt(rng, pool.length), 1)[0])
  }
  return treeOf(cls).filter((id) => offers.includes(id))
}

/** The class ability a soldier has learned, if any. */
export const abilityOf = (soldier: Soldier) => (soldier.cls && soldier.skills.some((id) => SKILLS[id].teaches) ? CLASSES[soldier.cls].ability : null)

/** Uses of a soldier's class ability each battle: the class's once learned, plus what skills and relics add to an ability that has uses. */
export function charges(run: Run, soldier: Soldier): number {
  const base = abilityOf(soldier) ? CLASSES[soldier.cls!].charges : 0
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
    const fromGear = (soldier.gear?.stats[key] ?? 0) + (weapon?.stats[key] ?? 0)
    const fromSkills = soldier.skills.reduce((sum, id) => sum + (SKILLS[id].stats?.[key] ?? 0), 0)
    stats[key] += fromClass + fromGear + fromSkills + level(soldier) * (LEVEL_STATS[key] ?? 0) + total(run, (u) => u.stats?.[key])
  }
  if (weapon?.melee) stats.range = MELEE_RANGE
  // Class, weapon and mod can sum below walking, and a hero that cannot walk stalls a battle.
  stats.move = Math.max(MIN_MOVE, stats.move)
  for (const id of run.doctrines) Object.assign(stats, (DOCTRINES[id] as Doctrine).set)
  return stats
}

/** The attack a soldier follows its weapon with: by its class, a sidearm without one. */
export const secondaryOf = (soldier: Soldier): SecondaryId => (soldier.cls ? CLASSES[soldier.cls].secondary : 'sidearm')

/** The weapon a soldier wields, if any. */
export const weaponOf = (soldier: Soldier) => (soldier.gear ? WEAPONS[soldier.gear.weapon] : null)

/** The least move a soldier has. */
const MIN_MOVE = 2

/** What each level adds to a soldier's stats. */
export const LEVEL_STATS: Partial<Stats> = { hp: 2, crit: 0.03 }

/**
 * Adds a recruit the player has not seen to the squad, while it has room, and tells the player. Under a
 * doctrine of unique classes it takes a class no squadmate has, while one is left.
 */
export function hire(run: Run): void {
  if (run.soldiers.length < MAX_SQUAD) run.gains.push({ kind: 'hero', soldier: join(run, draft(run, [])).id })
}

/** The most heroes a party has. */
export const MAX_SQUAD = 3

/** Adds `soldier` to the squad and returns it. */
export function join(run: Run, soldier: Soldier): Soldier {
  soldier.id = run.nextSoldier++
  run.soldiers.push(soldier)
  return soldier
}

/** A plain level 1 soldier of a class none of `taken` has, if one is left, not yet in the squad. */
export function draft(run: Run, taken: ClassId[]): Soldier {
  const unused = (Object.keys(CLASSES) as ClassId[]).filter((id) => !run.soldiers.some((s) => s.cls === id))
  const unique = run.doctrines.some((id) => (DOCTRINES[id] as Doctrine).uniqueClasses) && unused.length > 0
  const all = (unique ? unused : (Object.keys(CLASSES) as ClassId[])).filter((id) => !taken.includes(id))
  const fresh = all.filter((id) => !run.passed.classes.includes(id))
  const classes = fresh.length > 0 ? fresh : all.length > 0 ? all : (Object.keys(CLASSES) as ClassId[])
  const gear = plainGear(run, run.nextGear++)
  const free = NAMES.filter((name) => ![...run.soldiers, ...run.recruits].some((s) => s.name === name))
  const name = free[randomInt(run, free.length)]
  const cls = classes[randomInt(run, classes.length)]
  const soldier: Soldier = {
    id: 0,
    name,
    xp: xpFor(1),
    cls,
    skills: [powerOf(cls)],
    lost: [],
    // Read, not drawn: the seed costs the run no draw.
    seed: run.rng,
    feats: [],
    gear,
    home: null,
    wounds: 0,
  }
  return soldier
}

export const NAMES = ['Vega', 'Okafor', 'Lindqvist', 'Tanaka', 'Reyes', 'Novak', 'Haddad', 'Brandt', 'Silva', 'Kowalski', 'Mbeki', 'Dufour', 'Ivanov', 'Castillo', 'Ng', 'Shaw']

/** Recruits offered at a run's start. */
export const RECRUITS = 3

/** Offers the run's first soldier: recruits of different classes from different continents. */
export function offerRecruits(run: Run): void {
  const continents = [...CONTINENT_IDS]
  for (let i = 0; i < RECRUITS; i++) {
    const recruit = draft(run, run.recruits.map((r) => r.cls!))
    const cities: City[] = CONTINENTS[continents.splice(randomInt(run, continents.length), 1)[0]].cities
    recruit.home = cities[randomInt(run, cities.length)]
    run.recruits.push(recruit)
  }
}

/** The keywords of everything the squad has: its soldiers' skills and gear, and its relics. */
export function squadKeywords(run: Run): Keyword[] {
  const tags = [
    ...run.soldiers.flatMap((s) => [...s.skills.map((id) => SKILLS[id].tags ?? []), (s.gear?.effect && EFFECTS[s.gear.effect].tags) || []]),
    ...run.relics.map((id) => RELICS[id].tags ?? []),
  ].flat()
  return [...new Set(tags)]
}

/** What a soldier earns from a battle, after the feats it ends the battle with are recorded. */
export function earn(battle: Battle, soldier: Soldier, won: boolean, rescued: number | null): { earned: Earned[]; feats: FeatId[]; tally: Tally } {
  const tally = battle.tally[soldier.id] ?? emptyTally()
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
    { label: `${tally.kills} kill${tally.kills === 1 ? '' : 's'}`, xp: battle.rules.includes('reckoning') ? 0 : tally.kills * XP.kill },
    { label: `${tally.dealt} damage`, xp: Math.floor(tally.dealt / XP.damage) },
    { label: `${saved} civilians saved`, xp: saved * XP.civilian },
    ...feats.map((id) => ({ label: FEATS[id].name, xp: XP.feat })),
  ]
  return { earned: earned.filter((e) => e.xp > 0), feats, tally }
}
