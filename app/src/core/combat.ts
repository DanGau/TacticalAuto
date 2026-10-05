import {
  blocked,
  BLAST_RADIUS,
  coverAt,
  CRIT_BONUS,
  distance,
  GRID,
  MAX_BEATS,
  MEDIC_HEAL,
  MEDIC_REACH,
  NEIGHBORS,
  onGrid,
  PATROL_MOVE,
  revealed,
  ROCKET_DAMAGE,
  STANDOFF,
  type Battle,
  type Side,
  type Stance,
  type Tile,
  type Unit,
} from './battle'
import { random, randomInt } from './rng'
import { canShoot, lineOfSight, odds, sees } from './sight'

export type GameEvent =
  /** `path` lists each tile entered, in order. */
  | { type: 'move'; id: number; path: Tile[] }
  /** A pod is sighted. `units` gives each member's tile at that moment; its moves to cover follow. */
  | { type: 'reveal'; units: { id: number; x: number; y: number }[] }
  /** `damage` is 0 for a miss. */
  | { type: 'shot'; id: number; target: number; hit: boolean; crit: boolean; damage: number }
  /** A rocket lands on a tile and damages every unit in `hits`. */
  | { type: 'rocket'; id: number; x: number; y: number; hits: { target: number; damage: number }[] }
  | { type: 'heal'; id: number; target: number; amount: number }
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

/** Ids of the aliens some soldier sees now. */
function spotted(battle: Battle): Set<number> {
  const soldiers = battle.units.filter((u) => u.side === 'human')
  return new Set(battle.units.filter((u) => u.side === 'alien' && soldiers.some((s) => sees(battle, s, u))).map((u) => u.id))
}

/** Whether `unit`, standing on `from`, may shoot `target`. Squadsight reaches any spotted alien in a clear line. */
function shootable(battle: Battle, unit: Unit, from: Tile, target: Unit, seen: Set<number>): boolean {
  if (canShoot(battle, from, target, unit.stats.range)) return true
  return unit.ability === 'squadsight' && seen.has(target.id) && lineOfSight(battle, from, target)
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

/** What a stance weighs about a tile a unit could end its move on. */
interface Spot {
  /** The unit's best hit chance from the tile, in percent; 0 with no shot. */
  mine: number
  /** The best hit chance any enemy has on the tile from where it stands, in percent. */
  theirs: number
  /** Tiles the nearest squadmate is beyond a medic's reach. */
  apart: number
  /** Tiles the nearest enemy is inside STANDOFF. */
  crowded: number
  /** 0 with a clear line to some enemy, else 1. */
  blind: number
  /** The walk to the nearest enemy. */
  toGoal: number
}

/** How each stance ranks a tile it can shoot from, lowest first. */
const WITH_SHOT: Record<Stance, (spot: Spot) => number[]> = {
  // The exchange of fire that most favours the unit.
  balanced: ({ mine, theirs }) => [theirs - mine],
  // The surest shot, whatever comes back.
  rush: ({ mine, theirs }) => [-mine, theirs],
  // The same exchange, with safety counted double.
  anchor: ({ mine, theirs }) => [2 * theirs - mine],
  // Out of every enemy's reach, then at a distance, then the best shot.
  standoff: ({ mine, theirs, crowded }) => [theirs, crowded, -mine],
  // A good exchange that keeps a squadmate within reach.
  escort: ({ mine, theirs, apart }) => [theirs - mine + 10 * apart],
}

/** How each stance ranks a tile with no shot, lowest first. */
const NO_SHOT: Record<Stance, (spot: Spot) => number[]> = {
  balanced: ({ toGoal, theirs }) => [toGoal, theirs],
  rush: ({ toGoal, theirs }) => [toGoal, theirs],
  anchor: ({ toGoal, theirs }) => [toGoal, theirs],
  // Holds at a distance, out of reach, and from there looks for a clear line before walking nearer.
  standoff: ({ toGoal, theirs, crowded, blind }) => [theirs, crowded, blind, toGoal],
  escort: ({ toGoal, theirs, apart }) => [toGoal + apart, theirs],
}

/**
 * The path a fighting unit takes in its move stage: to the tile its stance ranks best, preferring any tile with a
 * shot over any without; the fewest steps wins a tie. Run and Gun doubles the move when the normal move reaches no shot.
 */
function fightPath(battle: Battle, unit: Unit): Tile[] {
  const enemies = enemiesOf(battle, unit)
  const goal = nearest(enemies, unit)
  if (!goal) return []
  const toGoal = walkingDistances(battle, goal)
  const seen = spotted(battle)
  /** The best hit chance from `end`, in whole percent; 0 with no shot. */
  const mine = (end: Tile) => {
    const chances = enemies.filter((enemy) => shootable(battle, unit, end, enemy, seen)).map((enemy) => odds(battle, end, enemy, unit.stats).hit)
    return Math.round(100 * Math.max(0, ...chances))
  }
  /** The best hit chance any enemy has on `end` from where it stands, in whole percent. */
  const theirs = (end: Tile) => {
    const chances = enemies.filter((enemy) => canShoot(battle, enemy, end, enemy.stats.range)).map((enemy) => odds(battle, enemy, end, enemy.stats).hit)
    return Math.round(100 * Math.max(0, ...chances))
  }
  const squadmates = battle.units.filter((u) => u.side === unit.side && u !== unit)
  const apart = (end: Tile) => Math.max(0, Math.min(MEDIC_REACH, ...squadmates.map((u) => distance(end, u) - MEDIC_REACH)))
  const choose = (move: number) =>
    bestPath(paths(battle, unit, move), unit, (end, steps) => {
      const spot: Spot = {
        mine: mine(end),
        theirs: theirs(end),
        apart: apart(end),
        crowded: Math.max(0, STANDOFF - Math.min(...enemies.map((enemy) => distance(end, enemy)))),
        blind: enemies.some((enemy) => lineOfSight(battle, end, enemy)) ? 0 : 1,
        toGoal: toGoal[end.y * GRID + end.x],
      }
      return spot.mine > 0 ? [0, ...WITH_SHOT[unit.stance](spot), steps] : [1, ...NO_SHOT[unit.stance](spot)]
    })
  const path = choose(unit.stats.move)
  if (unit.ability === 'runAndGun' && mine(path.at(-1) ?? unit) === 0) return choose(2 * unit.stats.move)
  return path
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

/** Removes `damage` health from a unit, removing the unit and reporting its death at zero. */
function wound(battle: Battle, target: Unit, damage: number, events: GameEvent[]): void {
  target.hp -= damage
  if (target.hp > 0) return
  battle.units = battle.units.filter((u) => u !== target)
  events.push({ type: 'death', id: target.id })
}

/** Medic: heals the most wounded other soldier at half health or less within reach. */
function heal(battle: Battle, unit: Unit): GameEvent[] {
  const wounded = battle.units
    .filter((u) => u.side === unit.side && u !== unit && u.hp <= u.stats.hp / 2 && distance(unit, u) <= MEDIC_REACH)
    .reduce<Unit | undefined>((worst, u) => (!worst || u.hp < worst.hp ? u : worst), undefined)
  if (!wounded) return []
  const amount = Math.min(MEDIC_HEAL, wounded.stats.hp - wounded.hp)
  wounded.hp += amount
  return [{ type: 'heal', id: unit.id, target: wounded.id, amount }]
}

/** Rocket: blasts the shootable enemy with the most enemies around it, if at least two are caught and no ally is. */
function rocket(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  const inBlast = (centre: Tile) => battle.units.filter((u) => distance(centre, u) <= BLAST_RADIUS)
  let best: Unit[] = []
  let centre: Unit | undefined
  for (const enemy of battle.units) {
    if (enemy.side === unit.side || !shootable(battle, unit, unit, enemy, seen)) continue
    const caught = inBlast(enemy)
    if (caught.every((u) => u.side !== unit.side) && caught.length > Math.max(1, best.length)) {
      best = caught
      centre = enemy
    }
  }
  if (!centre) return []
  const events: GameEvent[] = [{ type: 'rocket', id: unit.id, x: centre.x, y: centre.y, hits: best.map((u) => ({ target: u.id, damage: ROCKET_DAMAGE })) }]
  for (const target of best) wound(battle, target, ROCKET_DAMAGE, events)
  return events
}

/** A shot at the enemy the unit can shoot and is likeliest to hit; the nearest, then the lowest id, wins a tie. */
function shoot(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  let enemy: Unit | undefined
  for (const other of battle.units) {
    if (other.side === unit.side || !shootable(battle, unit, unit, other, seen)) continue
    const gain = enemy ? odds(battle, unit, other, unit.stats).hit - odds(battle, unit, enemy, unit.stats).hit : 1
    if (gain > 0 || (gain === 0 && distance(unit, other) < distance(unit, enemy!))) enemy = other
  }
  if (!enemy) return []
  const chance = odds(battle, unit, enemy, unit.stats)
  const hit = random(battle) < chance.hit
  const crit = hit && random(battle) < chance.crit
  const damage = hit ? unit.stats.damage + (crit ? CRIT_BONUS : 0) : 0
  const events: GameEvent[] = [{ type: 'shot', id: unit.id, target: enemy.id, hit, crit, damage }]
  if (hit) wound(battle, enemy, damage, events)
  return events
}

/** Whether the unit may act this turn: an alien may not while its pod is unseen or surprised. */
function armed(battle: Battle, unit: Unit): boolean {
  return unit.pod === null || (battle.pods[unit.pod].revealed && !battle.pods[unit.pod].surprised)
}

/**
 * The next unit of the side on turn with something to do acts once: a charged ability if its moment has come,
 * otherwise a shot. Empty when no unit is left.
 */
function actNext(battle: Battle): GameEvent[] {
  const seen = spotted(battle)
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.id <= battle.shooter || !armed(battle, unit)) continue
    let events: GameEvent[] = []
    if (unit.charges > 0 && unit.ability === 'medic') events = heal(battle, unit)
    if (unit.charges > 0 && unit.ability === 'rocket') events = rocket(battle, unit, seen)
    if (events.length > 0) unit.charges--
    else events = shoot(battle, unit, seen)
    if (events.length === 0) continue
    battle.shooter = unit.id
    return events
  }
  return []
}

/** The next move stage or action, passing the turn when a side has nothing left to do. */
function act(battle: Battle): GameEvent[] {
  // After each side has passed once, nobody can act this beat.
  for (let passes = 0; passes < 2; passes++) {
    if (battle.stage === 'move') {
      const moves = moveSide(battle)
      battle.stage = 'shoot'
      battle.shooter = 0
      if (moves.length > 0) return moves
    }
    const action = actNext(battle)
    if (action.length > 0) return action
    battle.turn = battle.turn === 'human' ? 'alien' : 'human'
    battle.stage = 'move'
  }
  return []
}

/** Advances a battle one beat: a side's simultaneous move, or one unit's action. Does nothing outside the battle phase. */
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
