import { randomInt } from './rng'

export const GRID = 20
/** Rows at each edge where a side places its squad: aliens at low y, humans at high y. */
export const DEPLOY_DEPTH = 3
export const SQUAD = 4
/** A battle still running at this beat ends as a draw. */
export const MAX_BEATS = 1000
export const UNIT_HP = 10
export const DAMAGE = 3
export const CRIT_DAMAGE = 5
/** Chance to hit a target with no cover against the shooter. */
export const HIT_CHANCE = 0.75
/** Hit chance a target's cover removes, indexed by Cover. */
export const COVER_DEFENSE = [0, 0.2, 0.4]
/** Chance a hit crits when the target has no cover against the shooter. */
export const FLANK_CRIT = 0.5
/** Cover tiles scattered on the map. */
export const COVER_TILES = 40
/** Tiles a unit may move in its side's turn. */
export const MOVE = 4
/** Tiles a shot reaches, counting a diagonal as one. */
export const RANGE = 5

export type Side = 'human' | 'alien'

/** What stands on a tile: 0 nothing, 1 low cover, 2 high cover. Cover blocks movement. */
export type Cover = 0 | 1 | 2

export type Tile = { x: number; y: number }

export interface Unit {
  id: number
  side: Side
  x: number
  y: number
  hp: number
}

export interface State {
  seed: number
  rng: number
  /** Calls to step so far. */
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
}

export function coverAt(state: State, x: number, y: number): Cover {
  return state.cover[y * GRID + x]
}

/** Whether nothing may stand on the tile: it is off the grid, cover, or occupied. */
export function blocked(state: State, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= GRID || y >= GRID || coverAt(state, x, y) > 0 || unitAt(state, x, y) !== undefined
}

export function unitAt(state: State, x: number, y: number): Unit | undefined {
  return state.units.find((u) => u.x === x && u.y === y)
}

export function addUnit(state: State, side: Side, x: number, y: number): void {
  state.units.push({ id: state.nextId++, side, x, y, hp: UNIT_HP })
}

/** A battle awaiting human deployment, with cover and the alien squad already placed. */
export function createState(seed: number): State {
  const state: State = {
    seed,
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
  }
  for (let i = 0; i < COVER_TILES; i++) {
    state.cover[randomInt(state, GRID * GRID)] = randomInt(state, 2) === 0 ? 1 : 2
  }
  while (state.units.length < SQUAD) {
    const x = randomInt(state, GRID)
    const y = randomInt(state, DEPLOY_DEPTH)
    if (!blocked(state, x, y)) addUnit(state, 'alien', x, y)
  }
  return state
}
