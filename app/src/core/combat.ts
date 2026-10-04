import { random } from './rng'
import { canShoot, coverAgainst, distance, odds } from './sight'
import { blocked, coverAt, CRIT_BONUS, GRID, MAX_BEATS, type Battle, type Side, type Tile, type Unit } from './battle'

export type GameEvent =
  /** `path` lists each tile entered, in order. */
  | { type: 'move'; id: number; path: Tile[] }
  | { type: 'shot'; id: number; target: number; hit: boolean; crit: boolean }
  | { type: 'death'; id: number }
  | { type: 'end'; winner: Side | null }

const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]

/** The enemy of `side` nearest to `from` among those `include` accepts; the lowest id wins a tie. */
function nearestEnemy(battle: Battle, side: Side, from: Tile, include: (enemy: Unit) => boolean = () => true): Unit | undefined {
  let best: Unit | undefined
  for (const other of battle.units) {
    if (other.side === side || !include(other)) continue
    if (!best || distance(from, other) < distance(from, best)) best = other
  }
  return best
}

/** Walking distance from every tile to `goal`, row by row, ignoring units. Infinity where no path exists. */
function walkingDistances(battle: Battle, goal: Tile): number[] {
  const field = Array<number>(GRID * GRID).fill(Infinity)
  field[goal.y * GRID + goal.x] = 0
  const queue = [goal]
  for (const tile of queue) {
    for (const [dx, dy] of NEIGHBORS) {
      const x = tile.x + dx
      const y = tile.y + dy
      if (x < 0 || y < 0 || x >= GRID || y >= GRID || coverAt(battle, x, y) > 0 || field[y * GRID + x] !== Infinity) continue
      field[y * GRID + x] = field[tile.y * GRID + tile.x] + 1
      queue.push({ x, y })
    }
  }
  return field
}

/** Every path the unit can walk within its move, shortest first, starting with the empty path. */
function paths(battle: Battle, unit: Unit): Tile[][] {
  const found: Tile[][] = [[]]
  const seen = new Set([unit.y * GRID + unit.x])
  for (const path of found) {
    if (path.length === unit.stats.move) break
    const from = path.at(-1) ?? unit
    for (const [dx, dy] of NEIGHBORS) {
      const x = from.x + dx
      const y = from.y + dy
      if (blocked(battle, x, y) || seen.has(y * GRID + x)) continue
      seen.add(y * GRID + x)
      found.push([...path, { x, y }])
    }
  }
  return found
}

/**
 * The path a unit takes in its move stage. It ends on the tile that, in order of preference:
 * has a shot at an enemy, gives the best cover against the nearest such enemy, and is the fewest steps away.
 * With no shot reachable, it ends as close to the nearest enemy as it can walk.
 */
function choosePath(battle: Battle, unit: Unit): Tile[] {
  const goal = nearestEnemy(battle, unit.side, unit)
  if (!goal) return []
  const toGoal = walkingDistances(battle, goal)
  let best: Tile[] = []
  let bestScore = [Infinity]
  for (const path of paths(battle, unit)) {
    const end = path.at(-1) ?? unit
    const target = nearestEnemy(battle, unit.side, end, (enemy) => canShoot(battle, end, enemy, unit.stats.range))
    const score = target
      ? [0, -coverAgainst(battle, end, target), path.length]
      : [1, toGoal[end.y * GRID + end.x], -coverAgainst(battle, end, goal)]
    const differs = score.findIndex((value, i) => value !== bestScore[i])
    if (differs >= 0 && score[differs] < bestScore[differs]) {
      best = path
      bestScore = score
    }
  }
  return best
}

/** Every unit of the side on turn walks its chosen path, lowest id first. */
function moveSide(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of battle.units) {
    if (unit.side !== battle.turn) continue
    const path = choosePath(battle, unit)
    const end = path.at(-1)
    if (!end) continue
    unit.x = end.x
    unit.y = end.y
    events.push({ type: 'move', id: unit.id, path })
  }
  return events
}

/** The enemy the unit can shoot and is likeliest to hit; the nearest, then the lowest id, wins a tie. */
function chooseTarget(battle: Battle, unit: Unit): Unit | undefined {
  let best: Unit | undefined
  for (const other of battle.units) {
    if (other.side === unit.side || !canShoot(battle, unit, other, unit.stats.range)) continue
    const gain = best ? odds(battle, unit, other, unit.stats).hit - odds(battle, unit, best, unit.stats).hit : 1
    if (gain > 0 || (gain === 0 && distance(unit, other) < distance(unit, best!))) best = other
  }
  return best
}

/** The next unit of the side on turn that can shoot an enemy does. Empty when none is left. */
function shootNext(battle: Battle): GameEvent[] {
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.id <= battle.shooter) continue
    const enemy = chooseTarget(battle, unit)
    if (!enemy) continue
    battle.shooter = unit.id
    const chance = odds(battle, unit, enemy, unit.stats)
    const hit = random(battle) < chance.hit
    const crit = hit && random(battle) < chance.crit
    const events: GameEvent[] = [{ type: 'shot', id: unit.id, target: enemy.id, hit, crit }]
    if (hit) {
      enemy.hp -= unit.stats.damage + (crit ? CRIT_BONUS : 0)
      if (enemy.hp <= 0) {
        battle.units = battle.units.filter((u) => u !== enemy)
        events.push({ type: 'death', id: enemy.id })
      }
    }
    return events
  }
  return []
}

/** The next move stage or shot, passing the turn when a side has nothing left to do. */
function act(battle: Battle): GameEvent[] {
  // After each side has passed once, nobody can act this beat.
  for (let passes = 0; passes < 2; passes++) {
    if (battle.stage === 'move') {
      const moves = moveSide(battle)
      battle.stage = 'shoot'
      battle.shooter = 0
      if (moves.length > 0) return moves
    }
    const shot = shootNext(battle)
    if (shot.length > 0) return shot
    battle.turn = battle.turn === 'human' ? 'alien' : 'human'
    battle.stage = 'move'
  }
  return []
}

/** Advances a battle one beat: a side's simultaneous move, or one unit's shot. Does nothing outside the battle phase. */
export function stepBattle(battle: Battle): GameEvent[] {
  if (battle.phase !== 'battle') return []
  battle.beat++
  const events = act(battle)
  const humans = battle.units.some((u) => u.side === 'human')
  const aliens = battle.units.some((u) => u.side === 'alien')
  if (!humans || !aliens || battle.beat >= MAX_BEATS) {
    battle.phase = 'over'
    battle.winner = humans === aliens ? null : humans ? 'human' : 'alien'
    events.push({ type: 'end', winner: battle.winner })
  }
  return events
}
