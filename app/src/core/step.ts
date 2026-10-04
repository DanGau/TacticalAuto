import { random } from './rng'
import {
  blocked,
  COVER_DEFENSE,
  coverAt,
  CRIT_DAMAGE,
  DAMAGE,
  FLANK_CRIT,
  GRID,
  HIT_CHANCE,
  MAX_BEATS,
  MOVE,
  RANGE,
  type Cover,
  type Side,
  type State,
  type Tile,
  type Unit,
} from './state'

export type GameEvent =
  /** `path` lists each tile entered, in order. */
  | { type: 'move'; id: number; path: Tile[] }
  | { type: 'shot'; id: number; target: number; hit: boolean; crit: boolean }
  | { type: 'death'; id: number }
  | { type: 'end'; winner: Side | null }

/** Tiles between two points, counting a diagonal as one. */
const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]
const NEIGHBORS = [...SIDES, [1, -1], [1, 1], [-1, 1], [-1, -1]]

/**
 * The best cover a unit standing on `at` has against a shot from `from`.
 * Cover on an adjacent tile counts only if the shooter is on that side of the unit; otherwise the unit is flanked.
 */
export function coverAgainst(state: State, at: Tile, from: Tile): Cover {
  let best: Cover = 0
  for (const [dx, dy] of SIDES) {
    const x = at.x + dx
    const y = at.y + dy
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue
    if ((from.x - at.x) * dx + (from.y - at.y) * dy > 0 && coverAt(state, x, y) > best) best = coverAt(state, x, y)
  }
  return best
}

/** Chances for a shot between two tiles: to hit, and for a hit to crit. */
export function odds(state: State, shooter: Tile, target: Tile): { hit: number; crit: number } {
  const cover = coverAgainst(state, target, shooter)
  return { hit: HIT_CHANCE - COVER_DEFENSE[cover], crit: cover === 0 ? FLANK_CRIT : 0 }
}

/** The enemy nearest to `from`; the lowest id wins a tie. */
function nearestEnemy(state: State, side: Side, from: Tile): Unit | undefined {
  let best: Unit | undefined
  for (const other of state.units) {
    if (other.side === side) continue
    if (!best || distance(from, other) < distance(from, best)) best = other
  }
  return best
}

/** Walking distance from every tile to `goal`, row by row, ignoring units. Infinity where no path exists. */
function walkingDistances(state: State, goal: Tile): number[] {
  const field = Array<number>(GRID * GRID).fill(Infinity)
  field[goal.y * GRID + goal.x] = 0
  const queue = [goal]
  for (const tile of queue) {
    for (const [dx, dy] of NEIGHBORS) {
      const x = tile.x + dx
      const y = tile.y + dy
      if (x < 0 || y < 0 || x >= GRID || y >= GRID || coverAt(state, x, y) > 0 || field[y * GRID + x] !== Infinity) continue
      field[y * GRID + x] = field[tile.y * GRID + tile.x] + 1
      queue.push({ x, y })
    }
  }
  return field
}

/** Every path of at most MOVE tiles the unit can walk, shortest first, starting with the empty path. */
function paths(state: State, unit: Unit): Tile[][] {
  const found: Tile[][] = [[]]
  const seen = new Set([unit.y * GRID + unit.x])
  for (const path of found) {
    if (path.length === MOVE) break
    const from = path.at(-1) ?? unit
    for (const [dx, dy] of NEIGHBORS) {
      const x = from.x + dx
      const y = from.y + dy
      if (blocked(state, x, y) || seen.has(y * GRID + x)) continue
      seen.add(y * GRID + x)
      found.push([...path, { x, y }])
    }
  }
  return found
}

/**
 * The path a unit takes in its move stage. It ends on the tile that, in order of preference:
 * has an enemy in range, gives the best cover against the nearest enemy, and is the fewest steps away.
 * With no enemy reachable, it ends as close to the nearest enemy as it can walk.
 */
function choosePath(state: State, unit: Unit): Tile[] {
  const goal = nearestEnemy(state, unit.side, unit)
  if (!goal) return []
  const toGoal = walkingDistances(state, goal)
  let best: Tile[] = []
  let bestScore = [Infinity]
  for (const path of paths(state, unit)) {
    const end = path.at(-1) ?? unit
    const enemy = nearestEnemy(state, unit.side, end)!
    const cover = coverAgainst(state, end, enemy)
    const score = distance(end, enemy) <= RANGE ? [0, -cover, path.length] : [1, toGoal[end.y * GRID + end.x], -cover]
    const differs = score.findIndex((value, i) => value !== bestScore[i])
    if (differs >= 0 && score[differs] < bestScore[differs]) {
      best = path
      bestScore = score
    }
  }
  return best
}

/** Every unit of the side on turn walks its chosen path, lowest id first. */
function moveSide(state: State): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of state.units) {
    if (unit.side !== state.turn) continue
    const path = choosePath(state, unit)
    const end = path.at(-1)
    if (!end) continue
    unit.x = end.x
    unit.y = end.y
    events.push({ type: 'move', id: unit.id, path })
  }
  return events
}

/** The enemy in range the unit is likeliest to hit; the nearest, then the lowest id, wins a tie. */
function chooseTarget(state: State, unit: Unit): Unit | undefined {
  let best: Unit | undefined
  for (const other of state.units) {
    if (other.side === unit.side || distance(unit, other) > RANGE) continue
    const gain = best ? odds(state, unit, other).hit - odds(state, unit, best).hit : 1
    if (gain > 0 || (gain === 0 && distance(unit, other) < distance(unit, best!))) best = other
  }
  return best
}

/** The next unit of the side on turn with an enemy in range shoots. Empty when none is left. */
function shootNext(state: State): GameEvent[] {
  for (const unit of state.units) {
    if (unit.side !== state.turn || unit.id <= state.shooter) continue
    const enemy = chooseTarget(state, unit)
    if (!enemy) continue
    state.shooter = unit.id
    const chance = odds(state, unit, enemy)
    const hit = random(state) < chance.hit
    const crit = hit && random(state) < chance.crit
    const events: GameEvent[] = [{ type: 'shot', id: unit.id, target: enemy.id, hit, crit }]
    if (hit) {
      enemy.hp -= crit ? CRIT_DAMAGE : DAMAGE
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
