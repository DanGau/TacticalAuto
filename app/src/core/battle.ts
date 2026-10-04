import { randomInt } from './rng'

export const GRID = 20
/** Rows at each edge where a side places its squad: aliens at low y, humans at high y. */
export const DEPLOY_DEPTH = 3
/** A battle still running at this beat ends as a draw. */
export const MAX_BEATS = 1000
/** Damage a crit adds. */
export const CRIT_BONUS = 2
/** Hit chance a target's cover removes, indexed by Cover. */
export const COVER_DEFENSE = [0, 0.2, 0.4]
/** Cover tiles scattered on the map. */
export const COVER_TILES = 40

export type Side = 'human' | 'alien'

/** What stands on a tile: 0 nothing, 1 low cover, 2 high cover. Cover blocks movement. */
export type Cover = 0 | 1 | 2

export type Tile = { x: number; y: number }

export interface Stats {
  hp: number
  /** Chance to hit a target with no cover against the shooter. */
  aim: number
  damage: number
  /** Tiles a shot reaches, counting a diagonal as one. */
  range: number
  /** Tiles the unit may move in its side's turn. */
  move: number
  /** Chance a hit crits when the target has no cover against the shooter. */
  crit: number
}

export const BASE_STATS: Stats = { hp: 10, aim: 0.75, damage: 3, range: 5, move: 4, crit: 0.5 }

/** A soldier waiting to be deployed. */
export interface Reserve {
  soldier: number
  stats: Stats
}

export interface Unit {
  id: number
  side: Side
  x: number
  y: number
  hp: number
  stats: Stats
  /** The soldier this unit is; null for aliens. */
  soldier: number | null
}

export interface Battle {
  rng: number
  /** Calls to stepBattle so far. */
  beat: number
  phase: 'deploy' | 'battle' | 'over'
  /** The side whose turn it is. A turn is one move stage, then one shot per unit. */
  turn: Side
  stage: 'move' | 'shoot'
  /** Id of the last unit to shoot this turn; 0 before the first shot. */
  shooter: number
  /** Set when phase is 'over'; null is a draw. */
  winner: Side | null
  units: Unit[]
  nextId: number
  /** One entry per tile, row by row; read it with coverAt. */
  cover: Cover[]
  /** Soldiers not yet deployed; the first deploys next. */
  reserve: Reserve[]
}

export function coverAt(battle: Battle, x: number, y: number): Cover {
  return battle.cover[y * GRID + x]
}

export function unitAt(battle: Battle, x: number, y: number): Unit | undefined {
  return battle.units.find((u) => u.x === x && u.y === y)
}

/** Whether nothing may stand on the tile: it is off the grid, cover, or occupied. */
export function blocked(battle: Battle, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= GRID || y >= GRID || coverAt(battle, x, y) > 0 || unitAt(battle, x, y) !== undefined
}

export function addUnit(battle: Battle, side: Side, x: number, y: number, stats: Stats, soldier: number | null): void {
  battle.units.push({ id: battle.nextId++, side, x, y, hp: stats.hp, stats, soldier })
}

/** A battle awaiting human deployment, with cover and the aliens already placed. */
export function createBattle(seed: number, aliens: Stats[], reserve: Reserve[]): Battle {
  const battle: Battle = {
    rng: seed,
    beat: 0,
    phase: 'deploy',
    turn: 'human',
    stage: 'move',
    shooter: 0,
    winner: null,
    units: [],
    nextId: 1,
    cover: Array<Cover>(GRID * GRID).fill(0),
    reserve,
  }
  for (let i = 0; i < COVER_TILES; i++) {
    battle.cover[randomInt(battle, GRID * GRID)] = randomInt(battle, 2) === 0 ? 1 : 2
  }
  for (const stats of aliens) {
    for (;;) {
      const x = randomInt(battle, GRID)
      const y = randomInt(battle, DEPLOY_DEPTH)
      if (blocked(battle, x, y)) continue
      addUnit(battle, 'alien', x, y, stats, null)
      break
    }
  }
  return battle
}
