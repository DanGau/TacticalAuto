import { random } from './rng'
import { DAMAGE, GRID, HIT_CHANCE, MAX_BEATS, MOVE, RANGE, unitAt, type Side, type State, type Unit } from './state'

export type Tile = { x: number; y: number }

export type GameEvent =
  /** `path` lists each tile entered, in order. */
  | { type: 'move'; id: number; path: Tile[] }
  | { type: 'shot'; id: number; target: number; hit: boolean }
  | { type: 'death'; id: number }
  | { type: 'end'; winner: Side | null }

/** Tiles between two points, counting a diagonal as one. */
const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** Nearest enemy; the lowest id wins a tie. */
function nearestEnemy(state: State, unit: Unit): Unit | undefined {
  let best: Unit | undefined
  for (const other of state.units) {
    if (other.side === unit.side) continue
    if (!best || distance(unit, other) < distance(unit, best)) best = other
  }
  return best
}

const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]

/** Moves one tile closer to `to`, or stays if every closer tile is blocked. */
function moveToward(state: State, unit: Unit, to: Tile): boolean {
  // Axis distance breaks ties so units close in rather than slide sideways.
  const cost = (x: number, y: number) => distance({ x, y }, to) * 1000 + Math.abs(x - to.x) + Math.abs(y - to.y)
  let best = cost(unit.x, unit.y)
  let move: Tile | undefined
  for (const [dx, dy] of NEIGHBORS) {
    const x = unit.x + dx
    const y = unit.y + dy
    if (x < 0 || y < 0 || x >= GRID || y >= GRID || unitAt(state, x, y)) continue
    if (cost(x, y) < best) {
      best = cost(x, y)
      move = { x, y }
    }
  }
  if (!move) return false
  unit.x = move.x
  unit.y = move.y
  return true
}

/** Every unit of the side on turn walks toward its nearest enemy until in range or out of movement. */
function moveSide(state: State): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of state.units) {
    if (unit.side !== state.turn) continue
    const path: Tile[] = []
    while (path.length < MOVE) {
      const enemy = nearestEnemy(state, unit)
      if (!enemy || distance(unit, enemy) <= RANGE || !moveToward(state, unit, enemy)) break
      path.push({ x: unit.x, y: unit.y })
    }
    if (path.length > 0) events.push({ type: 'move', id: unit.id, path })
  }
  return events
}

/** The next unit of the side on turn with an enemy in range shoots it. Empty when none is left. */
function shootNext(state: State): GameEvent[] {
  for (const unit of state.units) {
    if (unit.side !== state.turn || unit.id <= state.shooter) continue
    const enemy = nearestEnemy(state, unit)
    if (!enemy || distance(unit, enemy) > RANGE) continue
    state.shooter = unit.id
    const hit = random(state) < HIT_CHANCE
    const events: GameEvent[] = [{ type: 'shot', id: unit.id, target: enemy.id, hit }]
    if (hit) {
      enemy.hp -= DAMAGE
      if (enemy.hp <= 0) {
        state.units = state.units.filter((u) => u !== enemy)
        events.push({ type: 'death', id: enemy.id })
      }
    }
    return events
  }
  return []
}

/** The next move stage or shot, passing the turn when a side has nothing left to do. */
function act(state: State): GameEvent[] {
  // After each side has passed once, nobody can act this beat.
  for (let passes = 0; passes < 2; passes++) {
    if (state.stage === 'move') {
      const moves = moveSide(state)
      state.stage = 'shoot'
      state.shooter = 0
      if (moves.length > 0) return moves
    }
    const shot = shootNext(state)
    if (shot.length > 0) return shot
    state.turn = state.turn === 'human' ? 'alien' : 'human'
    state.stage = 'move'
  }
  return []
}

/** Advances a battle one beat: a side's simultaneous move, or one unit's shot. Does nothing outside the battle phase. */
export function step(state: State): GameEvent[] {
  if (state.phase !== 'battle') return []
  state.beat++
  const events = act(state)
  const humans = state.units.some((u) => u.side === 'human')
  const aliens = state.units.some((u) => u.side === 'alien')
  if (!humans || !aliens || state.beat >= MAX_BEATS) {
    state.phase = 'over'
    state.winner = humans === aliens ? null : humans ? 'human' : 'alien'
    events.push({ type: 'end', winner: state.winner })
  }
  return events
}
