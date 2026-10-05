import { blocked, coverAt, CRIT_BONUS, distance, GRID, MAX_BEATS, NEIGHBORS, onGrid, PATROL_MOVE, revealed, type Battle, type Side, type Tile, type Unit } from './battle'
import { random, randomInt } from './rng'
import { canShoot, coverAgainst, odds, sees } from './sight'

export type GameEvent =
  /** `path` lists each tile entered, in order. */
  | { type: 'move'; id: number; path: Tile[] }
  /** A pod is sighted. `units` gives each member's tile at that moment; its moves to cover follow. */
  | { type: 'reveal'; units: { id: number; x: number; y: number }[] }
  | { type: 'shot'; id: number; target: number; hit: boolean; crit: boolean }
  | { type: 'death'; id: number }
  | { type: 'end'; winner: Side | null }

/**
 * The enemies a unit acts against. Aliens know every soldier. Soldiers know the revealed aliens;
 * with none revealed they track every alien, which leads the squad to the nearest contact.
 */
function enemiesOf(battle: Battle, unit: Unit): Unit[] {
  const others = battle.units.filter((u) => u.side !== unit.side)
  const known = others.filter((u) => revealed(battle, u))
  return known.length > 0 ? known : others
}

/** The unit in `units` nearest to `from`; the lowest id wins a tie. */
function nearest(units: Unit[], from: Tile): Unit | undefined {
  let best: Unit | undefined
  for (const unit of units) if (!best || distance(from, unit) < distance(from, best)) best = unit
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
      if (!onGrid(x, y) || coverAt(battle, x, y) > 0 || field[y * GRID + x] !== Infinity) continue
      field[y * GRID + x] = field[tile.y * GRID + tile.x] + 1
      queue.push({ x, y })
    }
  }
  return field
}

/** Every path of at most `move` tiles the unit can walk, shortest first, starting with the empty path. */
function paths(battle: Battle, unit: Unit, move: number): Tile[][] {
  const found: Tile[][] = [[]]
  const seen = new Set([unit.y * GRID + unit.x])
  for (const path of found) {
    if (path.length === move) break
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

/** The path whose end `score` ranks lowest, comparing scores entry by entry; the shortest wins a tie. */
function bestPath(candidates: Tile[][], unit: Unit, score: (end: Tile, steps: number) => number[]): Tile[] {
  let best: Tile[] = []
  let bestScore = [Infinity]
  for (const path of candidates) {
    const value = score(path.at(-1) ?? unit, path.length)
    const differs = value.findIndex((entry, i) => entry !== bestScore[i])
    if (differs >= 0 && value[differs] < bestScore[differs]) {
      best = path
      bestScore = value
    }
  }
  return best
}

/**
 * The path a fighting unit takes in its move stage. It ends on the tile that, in order of preference:
 * has a shot at an enemy, gives the best cover against the nearest such enemy, and is the fewest steps away.
 * With no shot reachable, it ends as close to the nearest enemy as it can walk.
 */
function fightPath(battle: Battle, unit: Unit): Tile[] {
  const enemies = enemiesOf(battle, unit)
  const goal = nearest(enemies, unit)
  if (!goal) return []
  const toGoal = walkingDistances(battle, goal)
  return bestPath(paths(battle, unit, unit.stats.move), unit, (end, steps) => {
    const target = nearest(
      enemies.filter((enemy) => canShoot(battle, end, enemy, unit.stats.range)),
      end,
    )
    return target ? [0, -coverAgainst(battle, end, target), steps] : [1, toGoal[end.y * GRID + end.x], -coverAgainst(battle, end, goal)]
  })
}

/** The path an alien takes while its pod is unseen: toward the pod's waypoint, slowly. */
function patrolPath(battle: Battle, unit: Unit): Tile[] {
  const toWaypoint = walkingDistances(battle, battle.pods[unit.pod!].waypoint)
  return bestPath(paths(battle, unit, PATROL_MOVE), unit, (end) => [toWaypoint[end.y * GRID + end.x]])
}

function walk(unit: Unit, path: Tile[], events: GameEvent[]): void {
  const end = path.at(-1)
  if (!end) return
  unit.x = end.x
  unit.y = end.y
  events.push({ type: 'move', id: unit.id, path })
}

/** Reveals each unseen pod a soldier now sights. A revealed pod at once moves to fighting positions. */
function sight(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter((u) => u.side === 'human')
  battle.pods.forEach((pod, index) => {
    if (pod.revealed) return
    const members = battle.units.filter((u) => u.pod === index)
    const seen = members.some((m) => soldiers.some((s) => sees(battle, s, m)))
    if (!seen) return
    pod.revealed = true
    pod.surprised = battle.turn === 'alien'
    events.push({ type: 'reveal', units: members.map(({ id, x, y }) => ({ id, x, y })) })
    for (const member of members) walk(member, fightPath(battle, member), events)
  })
  return events
}

/** Every unit of the side on turn walks its path, lowest id first; then newly sighted pods are revealed. */
function moveSide(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  if (battle.turn === 'alien') {
    for (const pod of battle.pods) {
      pod.surprised = false
      // A pod that has reached its waypoint picks the next.
      const arrived = battle.units.some((u) => battle.pods[u.pod ?? -1] === pod && distance(u, pod.waypoint) <= PATROL_MOVE)
      if (!pod.revealed && arrived) pod.waypoint = { x: randomInt(battle, GRID), y: randomInt(battle, GRID) }
    }
  }
  for (const unit of battle.units) {
    if (unit.side !== battle.turn) continue
    walk(unit, revealed(battle, unit) ? fightPath(battle, unit) : patrolPath(battle, unit), events)
  }
  return [...events, ...sight(battle)]
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

/** Whether the unit may shoot this turn: an alien may not while its pod is unseen or surprised. */
function armed(battle: Battle, unit: Unit): boolean {
  return unit.pod === null || (battle.pods[unit.pod].revealed && !battle.pods[unit.pod].surprised)
}

/** The next unit of the side on turn that can shoot an enemy does. Empty when none is left. */
function shootNext(battle: Battle): GameEvent[] {
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.id <= battle.shooter || !armed(battle, unit)) continue
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
