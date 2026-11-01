// Challenge encounters: what each tests, what answers it, its tiers by party size, and the force each sends.
import type { AlienKind } from './aliens'
import type { Stats } from './battle'
import type { Goal } from './goals'
import { randomInt } from './rng'
import type { UtilityId } from './utilities'

/** What a battle tests. It shapes the ground and the aliens, and shows on the Flight map and the deploy screen. */
export type ChallengeId = 'slog' | 'firingLine' | 'ironWall' | 'swarm' | 'scattered' | 'bigOne' | 'killBox'

/**
 * `answers`: the utilities that meet it. `volley`: every alien fires from the start, across the ground it holds.
 * `grim`: the alien force, by party size less one and then by rung, each rung harder.
 */
export const CHALLENGES: Record<ChallengeId, { name: string; icon: string; test: string; answers: UtilityId[]; volley?: true; grim: number[][] }> = {
  slog: { name: 'Slog', icon: '🌿', test: 'Shooters behind a band of mire that takes three times the move to cross', answers: ['hover', 'thrusters', 'rangedShield'], volley: true, grim: [[2, 3, 4], [5, 6, 8], [7, 9, 11]] },
  firingLine: { name: 'Firing line', icon: '🎯', test: 'Long-range shooters along a ridge, firing from the moment the squad lands', answers: ['rangedShield', 'smoke'], volley: true, grim: [[2, 3, 4], [5, 7, 9], [8, 10, 12]] },
  ironWall: { name: 'Iron wall', icon: '🧱', test: 'Heavily armored aliens that shrug off small hits', answers: ['crack', 'overcharge'], grim: [[2, 3, 5], [6, 9, 12], [10, 13, 16]] },
  swarm: { name: 'Swarm', icon: '🐜', test: 'Bodies flood in from every side, and keep coming', answers: ['meleeShield', 'tank'], grim: [[6, 10, 14], [20, 26, 32], [28, 34, 40]] },
  scattered: { name: 'Scattered', icon: '🗺️', test: 'Sentries spread far apart: clear them before the clock runs out and reinforcements pour in', answers: ['thrusters'], grim: [[5, 8, 11], [14, 19, 24], [18, 22, 26]] },
  bigOne: { name: 'Big one', icon: '👹', test: 'One huge, armored alien and its escort', answers: ['overcharge', 'crack'], grim: [[1, 1, 2], [3, 5, 6], [5, 7, 9]] },
  killBox: { name: 'Kill box', icon: '💥', test: 'The way in lands right beside a packed cluster that hits first', answers: ['flashbang', 'meleeShield', 'smoke'], grim: [[3, 5, 7], [10, 13, 17], [15, 20, 25]] },
}

/** The challenges a party meets, by its size less one and the rung of the leg: harder ones arrive up each tier. */
export const TIERS: ChallengeId[][][] = [
  [['scattered', 'swarm', 'ironWall'], ['scattered', 'swarm', 'ironWall', 'slog', 'killBox'], ['swarm', 'ironWall', 'slog', 'killBox', 'firingLine', 'bigOne']],
  [['swarm', 'ironWall', 'slog', 'killBox'], ['scattered', 'swarm', 'ironWall', 'slog', 'killBox', 'firingLine'], ['scattered', 'slog', 'killBox', 'firingLine', 'bigOne']],
  [['scattered', 'swarm', 'ironWall', 'slog', 'killBox', 'firingLine'], ['scattered', 'swarm', 'ironWall', 'slog', 'firingLine', 'bigOne'], ['swarm', 'ironWall', 'killBox', 'firingLine', 'bigOne']],
]

/** Which challenges fit a goal: a flood's aliens come to the squad, so it meets nothing it must cross. */
const FLOOD_GOALS: Goal[] = ['hold', 'rescue']
const FITS_FLOOD: ChallengeId[] = ['swarm', 'ironWall', 'bigOne']

/** How far along a leg each rung starts, in columns. */
const RUNG_EVERY = 3
export const rungOf = (column: number) => Math.min(2, Math.floor(column / RUNG_EVERY))

/** A challenge for a battle of `goal`, none of `taken` if it can be, for a party of `party` at `rung`. */
export function drawChallenge(rng: { rng: number }, party: number, rung: number, goal: Goal, taken: ChallengeId[]): ChallengeId {
  const tier = TIERS[Math.min(party, TIERS.length) - 1][rung]
  const fit = FLOOD_GOALS.includes(goal) ? tier.filter((id) => FITS_FLOOD.includes(id)) : tier
  const open = (fit.length > 0 ? fit : FITS_FLOOD).filter((id) => !taken.includes(id))
  const pool = open.length > 0 ? open : fit.length > 0 ? fit : FITS_FLOOD
  return pool[randomInt(rng, pool.length)]
}

/** Kinds in turn for each challenge's force; the first alien of `bigOne` is added by the mission as its boss. */
const FORCES: Record<ChallengeId, AlienKind[]> = {
  slog: ['trooper', 'trooper', 'spitter'],
  firingLine: ['trooper'],
  ironWall: ['trooper', 'trooper', 'brute'],
  swarm: ['swarmling', 'swarmling', 'swarmling', 'burster', 'swarmling', 'brute'],
  scattered: ['trooper'],
  bigOne: ['brute', 'trooper'],
  killBox: ['brute', 'trooper', 'brute'],
}

/** What comes when a Scattered's clock runs out. */
const REINFORCEMENTS: AlienKind[] = ['brute', 'brute', 'sprinter']

/** The aliens of a challenge at `rung`: its grim count moved by what the risk and the goal add. */
export function forceOf(id: ChallengeId, party: number, rung: number, more: number): AlienKind[] {
  const { grim } = CHALLENGES[id]
  const count = Math.max(1, grim[Math.min(party, grim.length) - 1][rung] + more)
  return Array.from({ length: count }, (_, i) => (id === 'scattered' && i >= sentries(count) ? REINFORCEMENTS[i % REINFORCEMENTS.length] : FORCES[id][i % FORCES[id].length]))
}

/** What a challenge's ground does to its aliens' stats, by party size less one. */
export const STIFFEN: Partial<Record<ChallengeId, { range?: number; armor?: number[] }>> = {
  slog: { range: 3 },
  firingLine: { range: 4 },
  ironWall: { armor: [4, 8, 10] },
}

/** A big one's boss: its health over a soldier's base, its armor and its damage, by party size less one and rung. */
export function bigOneStats(party: number, rung: number, base: Stats): Stats {
  const size = Math.min(party, 3) - 1
  return { ...base, hp: [12, 60, 110][size] + [4, 10, 15][size] * rung, armor: [5, 25, 50][size] + [2, 4, 5][size] * rung, damage: base.damage + 2 * size + 1 + rung }
}

/** Of a Scattered's force of `count`, the sentries posted; the rest are the reinforcements. */
export const sentries = (count: number) => Math.ceil(count * 0.3)
/** The round a Scattered's reinforcements start, by its sentries: about what it takes a party moving at its best. */
export const deadlineFor = (posted: number) => 3 + Math.ceil(posted * 0.5)
