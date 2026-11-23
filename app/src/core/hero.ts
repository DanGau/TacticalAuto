// The hero: experience and levels, skills, stats and health, and the candidates a run starts from.
import { CIVILIAN_XP } from './goals'
import type { SecondaryId } from './secondaries'
import type { Lasting } from './base'
import { type Battle, type Stats, BASE_STATS } from './battle'
import { CLASSES, type ClassId } from './classes'
import { type Doctrine, DOCTRINES } from './doctrines'
import { EFFECTS, plainGear } from './gear'
import { type Relic, RELICS } from './relics'
import { randomInt } from './rng'
import { PERK_LEVELS, perkOffers, PERKS } from './perks'
import { type Run } from './run-state'
import { type Earned } from './run-state'
import { type Soldier } from './run-state'
import { committed, powerOf, SKILLS, type SkillId, TREES } from './skills'
import { MELEE_RANGE, WEAPONS } from './weapons'
import { CONTINENT_IDS, type City, CONTINENTS } from './world'
import type { Flow, Quantity } from './quantities'
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
export const XP = { fought: 1, won: 2, kill: 1, damage: 5, civilian: CIVILIAN_XP, feat: 2 }

/** The sum of one lasting effect over every relic and doctrine held. */
export function total(run: Run, effect: (source: Lasting) => number | undefined): number {
  const sources: Lasting[] = [...run.relics.map((id): Relic => RELICS[id]), ...run.doctrines.map((id): Doctrine => DOCTRINES[id])]
  return sources.reduce((sum, source) => sum + (effect(source) ?? 0), 0)
}

/** The levels at which a soldier earns a power: stats grow every level, powers only at these, one per row of a path. */
export const PICK_LEVELS = [3, 5, 7, 11]

/** Skills a soldier knows at most: its class power and a pick per pick level. */
export const MAX_SKILLS = PICK_LEVELS.length + 1

/** Powers a soldier has earned by its level. */
export const picksEarned = (soldier: { xp: number }) => PICK_LEVELS.filter((at) => at <= level(soldier)).length

/** Skills a soldier chose, leaving out the class power it came with. */
export const picksMade = (soldier: Soldier) => soldier.skills.filter((id) => !soldier.cls || id !== powerOf(soldier.cls)).length

/** What a soldier chooses its next skill from, or nothing if no choice is owed: at its first pick each path's entry, then the row of the path it took for that pick. */
export function skillOffers(soldier: Soldier): SkillId[] {
  const cls = soldier.cls
  const made = picksMade(soldier)
  if (!cls || made >= picksEarned(soldier)) return []
  const path = committed(cls, soldier.skills)
  return path ? path.rows[made] : TREES[cls].paths.map((p) => p.rows[0][0])
}

/** The perks a soldier chooses from now, or none if no perk is owed. */
export const minorOffers = (soldier: Soldier) => (PERK_LEVELS.filter((at) => at <= level(soldier)).length > soldier.perks.length ? perkOffers(soldier) : [])

/** Whether a soldier owes a choice: a power or a perk. */
export const owesPick = (soldier: Soldier) => skillOffers(soldier).length > 0 || minorOffers(soldier).length > 0

/** The class ability a soldier has learned, if any. */
export const abilityOf = (soldier: Soldier) => (soldier.cls && soldier.skills.some((id) => SKILLS[id].teaches) ? CLASSES[soldier.cls].ability : null)

/** Uses of a soldier's class ability each battle: the class's once learned, plus what skills, perks and relics add to an ability that has uses. */
export function charges(run: Run, soldier: Soldier): number {
  const base = abilityOf(soldier) ? CLASSES[soldier.cls!].charges : 0
  if (base === 0) return 0
  return base + [...soldier.skills.map((id) => SKILLS[id]), ...soldier.perks.map((id) => PERKS[id])].reduce((sum, p) => sum + (p.charges ?? 0), 0) + run.relics.reduce((sum, id) => sum + ((RELICS[id] as Relic).charges ?? 0), 0)
}

/** A soldier's health now: its most less its wounds, never below 1. */
export const health = (run: Run, soldier: Soldier) => Math.max(1, soldierStats(run, soldier).hp - soldier.wounds)

/** Heals the hero `amount`; Infinity heals fully. */
export function mend(run: Run, amount: number): void {
  run.hero.wounds = Math.max(0, Math.min(run.hero.wounds, soldierStats(run, run.hero).hp - 1) - amount)
}

/** Whether the hero is below full health. */
export const wounded = (run: Run) => health(run, run.hero) < soldierStats(run, run.hero).hp

/** A soldier's stats in battle: base, plus class, level, skills, perks, gear and its weapon, plus relics. A melee weapon reaches the next tile. */
export function soldierStats(run: Run, soldier: Soldier): Stats {
  const stats = { ...BASE_STATS }
  const weapon = weaponOf(soldier)
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const fromClass = soldier.cls ? (CLASSES[soldier.cls].stats[key] ?? 0) : 0
    const fromGear = (soldier.gear?.stats[key] ?? 0) + (weapon?.stats[key] ?? 0)
    const fromSkills = [...soldier.skills.map((id) => SKILLS[id]), ...soldier.perks.map((id) => PERKS[id])].reduce((sum, p) => sum + (p.stats?.[key] ?? 0), 0)
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

/** A plain level 1 hero of a class none of `taken` has, from `home`. */
export function draft(run: Run, taken: ClassId[], home: City): Soldier {
  const all = (Object.keys(CLASSES) as ClassId[]).filter((id) => !taken.includes(id))
  const free = NAMES.filter((name) => !run.candidates.some((s) => s.name === name))
  const name = free[randomInt(run, free.length)]
  const cls = all[randomInt(run, all.length)]
  return {
    id: HERO_ID,
    name,
    xp: xpFor(1),
    cls,
    skills: [powerOf(cls)],
    lost: [],
    perks: [],
    // Read, not drawn: the seed costs the run no draw.
    seed: run.rng,
    feats: [],
    gear: plainGear(run, run.nextGear++),
    home,
    wounds: 0,
  }
}

/** The id the hero fights under in a battle. */
export const HERO_ID = 1

export const NAMES = ['Vega', 'Okafor', 'Lindqvist', 'Tanaka', 'Reyes', 'Novak', 'Haddad', 'Brandt', 'Silva', 'Kowalski', 'Mbeki', 'Dufour', 'Ivanov', 'Castillo', 'Ng', 'Shaw']

/** Heroes offered at a run's start. */
export const CANDIDATES = 3

/** Offers the run's hero: candidates of different classes from different continents. */
export function offerCandidates(run: Run): void {
  const continents = [...CONTINENT_IDS]
  for (let i = 0; i < CANDIDATES; i++) {
    const cities: City[] = CONTINENTS[continents.splice(randomInt(run, continents.length), 1)[0]].cities
    run.candidates.push(draft(run, run.candidates.map((c) => c.cls!), cities[randomInt(run, cities.length)]))
  }
}

/** What a hero's class ability makes. */
const ABILITY_MAKES: Partial<Record<string, Quantity[]>> = { napalm: ['burn'], cryo: ['chill'], rocket: ['impact'] }

/** What `soldier` has that makes or reads: skills, gear effect, weapon, class ability. */
export function heroFlows(soldier: Soldier): Flow[] {
  const weapon = soldier.gear && WEAPONS[soldier.gear.weapon]
  return [
    ...soldier.skills.map((id) => SKILLS[id]),
    ...(soldier.gear?.effect ? [EFFECTS[soldier.gear.effect]] : []),
    { makes: [...(weapon?.effect === 'thunder' ? (['moved', 'impact'] as const) : []), ...(weapon && weapon.attack.shots >= 2 ? (['shots'] as const) : [])] },
    { makes: ABILITY_MAKES[CLASSES[soldier.cls!].ability] ?? [] },
  ]
}

/** Everything the run has that makes or reads: the hero's and its relics'. */
const flows = (run: Run): Flow[] => [...heroFlows(run.hero), ...run.relics.map((id) => RELICS[id])]

/** The quantities the run makes. */
export const makes = (run: Run): Quantity[] => [...new Set(flows(run).flatMap((f) => f.makes ?? []))]

/** The quantities the run reads. */
export const reads = (run: Run): Quantity[] => [...new Set(flows(run).flatMap((f) => f.reads ?? []))]

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
