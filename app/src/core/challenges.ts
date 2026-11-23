// Challenge encounters: what each tests, its tiers by leg, and the force each sends.
import type { AlienKind } from './aliens'
import type { Stats } from './battle'
import type { Goal } from './goals'
import { randomInt } from './rng'
import { MIRE_COST } from './grid'

/** What a battle tests. It shapes the ground and the aliens, and shows on the Flight map and the deploy screen. */
export type ChallengeId = 'slog' | 'firingLine' | 'ironWall' | 'swarm' | 'scattered' | 'bigOne' | 'killBox'

/**
 * `volley`: every alien fires from the start, across the ground it holds.
 * `grim`: the alien force, by leg and then by rung, each rung harder; the hub reads the last leg's.
 */
export const CHALLENGES: Record<ChallengeId, { name: string; icon: string; test: string; volley?: true; grim: number[][] }> = {
  slog: { name: 'Slog', icon: '🌿', test: `Small groups of shooters across a swamp fire from the start. Mire costs ${MIRE_COST + 1}× move.`, volley: true, grim: [[2, 3, 4], [3, 4, 6], [5, 7, 8]] },
  firingLine: { name: 'Firing Line', icon: '🎯', test: 'Long-range shooters on a ridge fire from the start.', volley: true, grim: [[2, 3, 4], [3, 4, 5], [4, 6, 7]] },
  ironWall: { name: 'Iron Wall', icon: '🧱', test: 'Heavy Armor shrugs off small hits.', grim: [[2, 3, 4], [4, 6, 8], [7, 9, 11]] },
  swarm: { name: 'Swarm', icon: '🐜', test: 'Aliens flood in from every side.', grim: [[8, 12, 16], [14, 18, 22], [20, 24, 30]] },
  scattered: { name: 'Scattered', icon: '🗺️', test: 'Sentries stand far apart. When the clock runs out, reinforcements arrive.', grim: [[8, 12, 16], [12, 16, 20], [16, 20, 24]] },
  bigOne: { name: 'Big One', icon: '👹', test: 'A huge alien with heavy Armor, and escorts.', grim: [[1, 1, 2], [2, 3, 3], [3, 4, 5]] },
  killBox: { name: 'Kill Box', icon: '💥', test: 'Land adjacent to a packed cluster that strikes first.', grim: [[3, 5, 6], [6, 8, 10], [9, 12, 15]] },
}

/** The challenges the hero meets, by leg and rung: harder ones arrive up each tier. */
export const TIERS: ChallengeId[][][] = [
  [['scattered', 'swarm', 'ironWall'], ['scattered', 'swarm', 'ironWall', 'slog', 'killBox'], ['swarm', 'ironWall', 'slog', 'killBox', 'firingLine', 'bigOne']],
  [['swarm', 'ironWall', 'slog', 'killBox'], ['scattered', 'swarm', 'ironWall', 'slog', 'killBox', 'firingLine'], ['scattered', 'slog', 'killBox', 'firingLine', 'bigOne']],
  [['scattered', 'swarm', 'ironWall', 'slog', 'killBox', 'firingLine'], ['scattered', 'swarm', 'ironWall', 'slog', 'firingLine', 'bigOne'], ['swarm', 'ironWall', 'killBox', 'firingLine', 'bigOne']],
]

/** Which challenges fit a goal: a flood's aliens come to the hero, so it meets nothing it must cross, nor a swarm, a second flood. */
const FLOOD_GOALS: Goal[] = ['hold', 'rescue']
const FITS_FLOOD: ChallengeId[] = ['ironWall', 'bigOne']

/** How far along a leg each rung starts, in columns. */
const RUNG_EVERY = 3
export const rungOf = (column: number) => Math.min(2, Math.floor(column / RUNG_EVERY))

/** A row of a table by leg: the hub reads the last. */
const byLeg = <T>(rows: T[], leg: number): T => rows[Math.min(leg, rows.length - 1)]

/** A challenge for a battle of `goal`, none of `taken` if it can be, on `leg` at `rung`. */
export function drawChallenge(rng: { rng: number }, leg: number, rung: number, goal: Goal, taken: ChallengeId[]): ChallengeId {
  const tier = byLeg(TIERS, leg)[rung]
  const fit = FLOOD_GOALS.includes(goal) ? tier.filter((id) => FITS_FLOOD.includes(id)) : tier
  const open = (fit.length > 0 ? fit : FITS_FLOOD).filter((id) => !taken.includes(id))
  const pool = open.length > 0 ? open : fit.length > 0 ? fit : FITS_FLOOD
  return pool[randomInt(rng, pool.length)]
}

/** Kinds in turn for each challenge's force; the first alien of `bigOne` is added by the mission as its boss. */
const FORCES: Record<ChallengeId, AlienKind[]> = {
  slog: ['trooper', 'trooper', 'spitter'],
  firingLine: ['trooper'],
  ironWall: ['aegis', 'trooper', 'brute', 'vise'],
  swarm: ['swarmling', 'swarmling', 'kinhound', 'burster', 'swarmling', 'brute'],
  scattered: ['zealot', 'trooper', 'vise'],
  bigOne: ['dreadhorn', 'zealot', 'brute', 'trooper'],
  killBox: ['brute', 'kinhound', 'vise', 'trooper'],
}

/** What comes when a Scattered's clock runs out. */
const REINFORCEMENTS: AlienKind[] = ['brute', 'brute', 'sprinter']

/** The aliens of a challenge at `rung`: its grim count moved by what the risk and the goal add. */
export function forceOf(id: ChallengeId, leg: number, rung: number, more: number): AlienKind[] {
  const count = Math.max(1, byLeg(CHALLENGES[id].grim, leg)[rung] + more)
  return Array.from({ length: count }, (_, i) => (id === 'scattered' && i >= sentries(count) ? REINFORCEMENTS[i % REINFORCEMENTS.length] : FORCES[id][i % FORCES[id].length]))
}

/** What a challenge's ground does to its aliens' stats, armor by leg. */
export const STIFFEN: Partial<Record<ChallengeId, { range?: number; armor?: number[] }>> = {
  slog: { range: 3 },
  firingLine: { range: 4 },
  ironWall: { armor: [5, 12, 16] },
}

/** A big one's boss: its health over a hero's base, its armor and its damage, by leg and rung. */
export function bigOneStats(leg: number, rung: number, base: Stats): Stats {
  const size = Math.min(leg, 2)
  return { ...base, hp: [10, 30, 60][size] + [3, 6, 10][size] * rung, armor: [7, 10, 16][size] + [1, 2, 3][size] * rung, damage: base.damage + 2 + 2 * size + Math.floor(rung / 2) }
}

/** Of a Scattered's force of `count`, the sentries posted; the rest are the reinforcements. */
export const sentries = (count: number) => Math.ceil(count * 0.3)
/** The move Afterburners lend at their first level. */
export const SPRINT = 2
/** The round a Scattered's reinforcements start: what walking and dashing the route's `tour` tiles takes a hero of `move` with Afterburners on, and a round for each pair of its `posted` sentries to fall. */
export const deadlineFor = (tour: number, move: number, posted: number) => 1 + Math.ceil(posted / 2) + Math.ceil(tour / (1.6 * (move + SPRINT)))
