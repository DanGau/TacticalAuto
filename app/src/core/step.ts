import { random } from './rng'
import { ATTACK_TICKS, DAMAGE, GRID, HIT_CHANCE, MAX_TICKS, MOVE_TICKS, unitAt, type Side, type State, type Unit } from './state'

export type GameEvent =
  | { type: 'move'; id: number; x: number; y: number }
  | { type: 'attack'; id: number; target: number; hit: boolean }
  | { type: 'death'; id: number }
  | { type: 'end'; winner: Side | null }

type Tile = { x: number; y: number }

/** Tiles between two points, counting a diagonal as one. */
const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** Nearest living enemy; the lowest id wins a tie. */
function nearestEnemy(state: State, unit: Unit): Unit | undefined {
  let best: Unit | undefined
  for (const other of state.units) {
    if (other.side === unit.side || other.hp <= 0) continue
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

/** Advances a battle one tick. Does nothing outside the battle phase. */
export function step(state: State): GameEvent[] {
  if (state.phase !== 'battle') return []
  const events: GameEvent[] = []
  state.tick++
  for (const unit of state.units) {
    if (unit.hp <= 0) continue
    if (unit.wait > 0) {
      unit.wait--
      continue
    }
    const enemy = nearestEnemy(state, unit)
    if (!enemy) break
    if (distance(unit, enemy) <= 1) {
      const hit = random(state) < HIT_CHANCE
      events.push({ type: 'attack', id: unit.id, target: enemy.id, hit })
      unit.wait = ATTACK_TICKS
      if (hit) {
        enemy.hp -= DAMAGE
        if (enemy.hp <= 0) events.push({ type: 'death', id: enemy.id })
      }
    } else if (moveToward(state, unit, enemy)) {
      events.push({ type: 'move', id: unit.id, x: unit.x, y: unit.y })
      unit.wait = MOVE_TICKS
    }
  }
  state.units = state.units.filter((u) => u.hp > 0)

  const humans = state.units.some((u) => u.side === 'human')
  const aliens = state.units.some((u) => u.side === 'alien')
  if (!humans || !aliens || state.tick >= MAX_TICKS) {
    state.phase = 'over'
    state.winner = humans === aliens ? null : humans ? 'human' : 'alien'
    events.push({ type: 'end', winner: state.winner })
  }
  return events
}
