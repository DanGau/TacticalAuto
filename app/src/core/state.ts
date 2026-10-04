import { randomInt } from './rng'

export const GRID = 20
/** Rows at each edge where a side places its squad: aliens at low y, humans at high y. */
export const DEPLOY_DEPTH = 3
export const SQUAD = 4
/** A battle still running at this beat ends as a draw. */
export const MAX_BEATS = 1000
export const UNIT_HP = 10
export const DAMAGE = 3
export const HIT_CHANCE = 0.75
/** Tiles a unit may move in its side's turn. */
export const MOVE = 4
/** Tiles a shot reaches, counting a diagonal as one. */
export const RANGE = 5

export type Side = 'human' | 'alien'

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
}

export function unitAt(state: State, x: number, y: number): Unit | undefined {
  return state.units.find((u) => u.x === x && u.y === y)
}

export function addUnit(state: State, side: Side, x: number, y: number): void {
  state.units.push({ id: state.nextId++, side, x, y, hp: UNIT_HP })
}

/** A battle awaiting human deployment, with the alien squad already placed. */
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
  }
  while (state.units.length < SQUAD) {
    const x = randomInt(state, GRID)
    const y = randomInt(state, DEPLOY_DEPTH)
    if (!unitAt(state, x, y)) addUnit(state, 'alien', x, y)
  }
  return state
}
