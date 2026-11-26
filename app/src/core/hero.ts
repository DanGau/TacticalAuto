// The hero: stats and health, and the candidates a run starts from.
import type { Lasting } from './base'
import { type Stats, BASE_STATS } from './battle'
import { CARDS } from './cards'
import { CLASSES, type ClassId } from './classes'
import { EFFECTS, plainGear } from './gear'
import { type Relic, RELICS } from './relics'
import { randomInt } from './rng'
import { type Run } from './run-state'
import { type Soldier } from './run-state'
import { MELEE_RANGE, WEAPONS } from './weapons'
import { CONTINENT_IDS, type City, CONTINENTS } from './world'
import type { Flow, Quantity } from './quantities'

/** The hero's max HP before relics and events add to it. */
export const HERO_HP = 40

/** The sum of one lasting effect over every relic held. */
export function total(run: Run, effect: (source: Lasting) => number | undefined): number {
  return run.relics.reduce((sum, id) => sum + (effect(RELICS[id] as Relic) ?? 0), 0)
}

/** A soldier's health now: its most less its wounds, never below 1. */
export const health = (run: Run, soldier: Soldier) => Math.max(1, soldierStats(run, soldier).hp - soldier.wounds)

/** Heals the hero `amount`; Infinity heals fully. */
export function mend(run: Run, amount: number): void {
  run.hero.wounds = Math.max(0, Math.min(run.hero.wounds, soldierStats(run, run.hero).hp - 1) - amount)
}

/** Whether the hero is below full health. */
export const wounded = (run: Run) => health(run, run.hero) < soldierStats(run, run.hero).hp

/** A soldier's stats in battle: base, plus class, gear and its weapon, plus relics. A melee weapon reaches the next tile. */
export function soldierStats(run: Run, soldier: Soldier): Stats {
  const stats = { ...BASE_STATS, hp: HERO_HP + run.maxHp }
  const weapon = weaponOf(soldier)
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const fromClass = soldier.cls ? (CLASSES[soldier.cls].stats[key] ?? 0) : 0
    const fromGear = (soldier.gear?.stats[key] ?? 0) + (weapon?.stats[key] ?? 0)
    stats[key] += fromClass + fromGear + total(run, (u) => u.stats?.[key])
  }
  if (weapon?.melee) stats.range = MELEE_RANGE
  // Class, weapon and mod can sum below walking, and a hero that cannot walk stalls a battle.
  stats.move = Math.max(MIN_MOVE, stats.move)
  return stats
}

/** The weapon a soldier wields, if any. */
export const weaponOf = (soldier: Soldier) => (soldier.gear ? WEAPONS[soldier.gear.weapon] : null)

/** The least move a soldier has. */
const MIN_MOVE = 2

/** A plain hero of a class none of `taken` has, from `home`. */
export function draft(run: Run, taken: ClassId[], home: City): Soldier {
  const all = (Object.keys(CLASSES) as ClassId[]).filter((id) => !taken.includes(id))
  const free = NAMES.filter((name) => !run.candidates.some((s) => s.name === name))
  const name = free[randomInt(run, free.length)]
  const cls = all[randomInt(run, all.length)]
  return {
    id: HERO_ID,
    name,
    cls,
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

/** Everything the run has that makes or reads: its cards, the hero's gear and its relics. */
const flows = (run: Run): Flow[] => [...run.deck.map((c) => CARDS[c.id]), ...(run.hero.gear?.effect ? [EFFECTS[run.hero.gear.effect]] : []), ...run.relics.map((id) => RELICS[id])]

/** The quantities the run makes. */
export const makes = (run: Run): Quantity[] => [...new Set(flows(run).flatMap((f) => f.makes ?? []))]

/** The quantities the run reads. */
export const reads = (run: Run): Quantity[] => [...new Set(flows(run).flatMap((f) => f.reads ?? []))]
