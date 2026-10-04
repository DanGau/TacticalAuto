import { randomInt } from './rng'

export const GRID = 20
/** Rows at each edge where a side places its squad: aliens at low y, humans at high y. */
export const DEPLOY_DEPTH = 3
export const SQUAD = 4
export const TICK_MS = 100
/** A battle still running at this tick ends as a draw. */
export const MAX_TICKS = 3000
export const UNIT_HP = 10
export const DAMAGE = 3
export const HIT_CHANCE = 0.75
export const MOVE_TICKS = 3
export const ATTACK_TICKS = 5

export type Side = 'human' | 'alien'

export interface Unit {
  id: number
  side: Side
  x: number
  y: number
  hp: number
  /** Ticks until the unit can act. */
  wait: number
}

export interface State {
  seed: number
  rng: number
  tick: number
  phase: 'deploy' | 'battle' | 'over'
  /** Set when phase is 'over'; null is a draw. */
  winner: Side | null
  units: Unit[]
  nextId: number
}

export function unitAt(state: State, x: number, y: number): Unit | undefined {
  return state.units.find((u) => u.x === x && u.y === y)
}

export function addUnit(state: State, side: Side, x: number, y: number): void {
  state.units.push({ id: state.nextId++, side, x, y, hp: UNIT_HP, wait: 0 })
}

/** A battle awaiting human deployment, with the alien squad already placed. */
export function createState(seed: number): State {
  const state: State = { seed, rng: seed, tick: 0, phase: 'deploy', winner: null, units: [], nextId: 1 }
  while (state.units.length < SQUAD) {
    const x = randomInt(state, GRID)
    const y = randomInt(state, DEPLOY_DEPTH)
    if (!unitAt(state, x, y)) addUnit(state, 'alien', x, y)
  }
  return state
}
