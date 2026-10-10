import {
  blocked,
  BLAST_RADIUS,
  BURN_DAMAGE,
  BURN_TURNS,
  coverAt,
  CRIT_BONUS,
  distance,
  EXECUTE_BONUS,
  GRENADE_DAMAGE,
  GRID,
  MAX_BEATS,
  MEDIC_HEAL,
  MEDIC_REACH,
  MEDKIT_HEAL,
  NEIGHBORS,
  onGrid,
  passable,
  PATROL_MOVE,
  revealed,
  ROCKET_DAMAGE,
  STANDOFF,
  type Battle,
  type Effect,
  type Side,
  type Stance,
  type Tile,
  type Unit,
  wreck,
} from './battle'
import { random, randomInt } from './rng'
import { canShoot, coverAgainst, lineOfSight, odds, sees } from './sight'

export type GameEvent =
  /** `path` lists each tile entered, in order. */
  | { type: 'move'; id: number; path: Tile[] }
  /** A pod is sighted. `units` gives each member's tile at that moment; its moves to cover follow. */
  | { type: 'reveal'; units: { id: number; x: number; y: number }[] }
  /** `damage` is 0 for a miss. */
  | { type: 'shot'; id: number; target: number; hit: boolean; crit: boolean; damage: number }
  /** A rocket or grenade lands on a tile, damages every unit in `hits`, and wrecks the terrain around it. */
  | { type: 'rocket'; id: number; x: number; y: number; hits: { target: number; damage: number }[] }
  | { type: 'heal'; id: number; target: number; amount: number }
  /** A gear effect acts on the unit `id`. `amount` is the health it gained, or lost if negative; 0 when neither. */
  | { type: 'effect'; id: number; effect: Effect; amount: number }
  | { type: 'death'; id: number }
  | { type: 'end'; winner: Side | null }

/**
 * The enemies a unit acts against. Aliens know every soldier. Soldiers know the revealed aliens;
 * with none revealed they track every alien, which leads the squad to a contact.
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

const has = (unit: Unit, effect: Effect) => unit.effects.includes(effect)

/** Uses a once-per-battle effect. False if the unit lacks it or has used it. */
function spend(unit: Unit, effect: Effect): boolean {
  if (!has(unit, effect) || unit.spent.includes(effect)) return false
  unit.spent.push(effect)
  return true
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
      if (!onGrid(x, y) || coverAt(battle, x, y) > 0 || field[y * GRID + x] !== Infinity || !passable(battle, tile, { x, y })) continue
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
      if (blocked(battle, x, y) || seen.has(y * GRID + x) || !passable(battle, from, { x, y })) continue
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
  /** `theirs` weighted by the unit's health: halved at full health, tripled near death. */
  risk: number
  /** The share of its health the unit has lost, 0 to 1. */
  hurt: number
  /** Whether the unit is wary; see WARY. */
  wary: boolean
  /** Tiles the nearest squadmate is beyond a medic's reach. */
  apart: number
  /** Tiles the nearest enemy is inside STANDOFF. */
  crowded: number
  /** 0 with a clear line to some enemy, else 1. */
  blind: number
  /** The walk to the unit's goal: for a soldier the squad's, for an alien the nearest soldier. */
  toGoal: number
  /** Tiles the squad's centre is beyond COHESION. */
  stray: number
  /** The cover the tile gives against the goal. */
  shelter: number
  /** Whether the unit is a soldier. Soldiers pick their way forward; aliens press the attack. */
  careful: boolean
}

/**
 * How each stance ranks a tile it can shoot from, lowest first. Weighing `risk` makes a healthy unit bold
 * and a wounded one careful.
 */
const WITH_SHOT: Record<Stance, (spot: Spot) => number[]> = {
  // The exchange of fire that most favours the unit, short of straying from the squad.
  balanced: ({ mine, risk, stray }) => [risk - mine + STRAY_COST * stray],
  // The surest shot; what comes back counts only as wounds mount.
  rush: ({ mine, risk, hurt, stray }) => [Math.round(hurt * risk) - mine + STRAY_COST * stray],
  // The same exchange, with safety counted double.
  anchor: ({ mine, risk, stray }) => [2 * risk - mine + STRAY_COST * stray],
  // Out of every enemy's reach, then at a distance, then the best shot.
  standoff: ({ mine, theirs, crowded }) => [theirs, crowded, -mine],
  // A good exchange that keeps a squadmate within reach.
  escort: ({ mine, risk, apart, stray }) => [risk - mine + 10 * apart + STRAY_COST * stray],
}

/** Tiles a soldier may be from the squad's centre before it counts as straying. */
const COHESION = 4
/** What each tile of straying costs a firing position, in points of hit chance. */
const STRAY_COST = 8

/**
 * Tiles a standoff soldier keeps behind the foremost squadmate while no soldier sees an alien, so the squad's
 * front line meets the enemy first.
 */
const REAR_GAP = 2

/**
 * A soldier that has lost this share of its health is wary while a healthier squadmate fights on: it gives up a shot
 * for a tile where less comes back, and stops advancing through tiles an enemy can shoot. With no healthier
 * squadmate it fights as normal, so a battle always ends. Aliens are never wary; they press the attack.
 */
const WARY = 0.5

/**
 * Closing on the goal with no shot to take. An alien takes the shortest walk. A soldier gives up some of the walk to
 * stay with the squad, to stay out of an enemy's sights, and to end behind cover facing the goal; a wary one walks
 * only through tiles no enemy can shoot. A soldier's costs are in tenths of a tile: a tile of straying costs two
 * tiles of progress, a certain hit coming back five, and high cover is worth one.
 */
const advance = ({ toGoal, theirs, wary, stray, shelter, careful }: Spot) => {
  if (!careful) return [toGoal, theirs]
  const cost = 10 * toGoal + 20 * stray + Math.round(theirs / 2) - 5 * shelter
  return wary ? [theirs, cost] : [cost]
}

/** How each stance ranks a tile with no shot, lowest first. */
const NO_SHOT: Record<Stance, (spot: Spot) => number[]> = {
  balanced: advance,
  rush: advance,
  anchor: advance,
  // Holds at a distance, out of reach, and from there looks for a clear line before walking nearer.
  standoff: ({ toGoal, theirs, crowded, blind, stray }) => [theirs, crowded, blind, toGoal + 2 * stray],
  escort: (spot) => advance({ ...spot, toGoal: spot.toGoal + spot.apart }),
}

/**
 * The enemy a side's units close on when they have no shot. Soldiers share one, so the squad moves together:
 * the revealed alien nearest the squad's centre, or with none revealed, the nearest alien of any pod.
 * An alien closes on the soldier nearest itself.
 */
function goalOf(battle: Battle, unit: Unit, enemies: Unit[]): Unit | undefined {
  return nearest(enemies, unit.side === 'human' ? centreOf(battle.units.filter((u) => u.side === 'human')) : unit)
}

/** The tile at the middle of some units. */
function centreOf(units: Unit[]): Tile {
  const mean = (pick: (unit: Unit) => number) => Math.round(units.reduce((sum, unit) => sum + pick(unit), 0) / units.length)
  return { x: mean((u) => u.x), y: mean((u) => u.y) }
}

/**
 * The path a fighting unit takes in its move stage: to the tile its stance ranks best, preferring any tile with a
 * shot over any without; the fewest steps wins a tie. Run and Gun doubles the move when the normal move reaches no shot.
 * While some soldier has an alien in sight, a soldier first avoids any tile from which it would sight another pod,
 * so one engagement ends before the next begins.
 */
function fightPath(battle: Battle, unit: Unit): Tile[] {
  const enemies = enemiesOf(battle, unit)
  const goal = goalOf(battle, unit, enemies)
  if (!goal) return []
  const toGoal = walkingDistances(battle, goal)
  const seen = spotted(battle)
  /** The best hit chance from `end`, in whole percent; 0 with no shot. */
  const mine = (end: Tile) => {
    const chances = enemies.filter((enemy) => shootable(battle, unit, end, enemy, seen)).map((enemy) => odds(battle, end, enemy, unit.stats, has(unit, 'piercing')).hit)
    return Math.round(100 * Math.max(0, ...chances))
  }
  /** The best hit chance any enemy has on `end` from where it stands, in whole percent. */
  const theirs = (end: Tile) => {
    const chances = enemies.filter((enemy) => canShoot(battle, enemy, end, enemy.stats.range)).map((enemy) => odds(battle, enemy, end, enemy.stats).hit)
    return Math.round(100 * Math.max(0, ...chances))
  }
  const squadmates = battle.units.filter((u) => u.side === unit.side && u !== unit)
  const hurt = 1 - unit.hp / unit.stats.hp
  const wary = unit.side === 'human' && hurt >= WARY && squadmates.some((u) => u.hp / u.stats.hp > 1 - WARY)
  const apart = (end: Tile) => Math.max(0, Math.min(MEDIC_REACH, ...squadmates.map((u) => distance(end, u) - MEDIC_REACH)))
  const centre = squadmates.length > 0 ? centreOf(squadmates) : unit
  /** Tiles `end` is beyond COHESION from the middle of the unit's squadmates. Aliens fight as they find themselves. */
  const stray = (end: Tile) => (unit.side === 'human' ? Math.max(0, distance(end, centre) - COHESION) : 0)
  const unseen = battle.units.filter((u) => u.side !== unit.side && !revealed(battle, u))
  // The squad is in a fight while some soldier has an alien in sight.
  const engaged = unit.side === 'human' && seen.size > 0
  /** Whether a soldier on `end` would sight a pod not yet revealed, while the squad is in a fight. */
  const provokes = (end: Tile) => (engaged && unseen.some((alien) => sees(battle, end, alien)) ? 1 : 0)
  const marching = unit.side === 'human' && seen.size === 0
  const leaders = unit.stance === 'standoff' ? squadmates.filter((u) => u.stance !== 'standoff') : []
  /** The nearest to the enemy this unit may walk while marching: REAR_GAP behind the foremost leader. */
  const slot = marching && leaders.length > 0 ? Math.min(...leaders.map((u) => toGoal[u.y * GRID + u.x])) + REAR_GAP : 0
  /** Tiles `end` is ahead of the unit's place in the formation. */
  const ahead = (end: Tile) => Math.max(0, slot - toGoal[end.y * GRID + end.x])
  const choose = (move: number) => {
    const reach = paths(battle, unit, move)
    /** Whether some tile in reach has a shot; out of contact, even a wary unit keeps advancing. */
    const inContact = reach.some((path) => mine(path.at(-1) ?? unit) > 0)
    return bestPath(reach, unit, (end, steps) => {
      const spot: Spot = {
        mine: mine(end),
        theirs: theirs(end),
        risk: Math.round(theirs(end) * (0.5 + 2.5 * hurt)),
        hurt,
        wary,
        apart: apart(end),
        crowded: Math.max(0, STANDOFF - Math.min(...enemies.map((enemy) => distance(end, enemy)))),
        blind: enemies.some((enemy) => lineOfSight(battle, end, enemy)) ? 0 : 1,
        toGoal: toGoal[end.y * GRID + end.x],
        stray: stray(end),
        shelter: coverAgainst(battle, end, goal),
        careful: unit.side === 'human',
      }
      // A wary unit ranks every tile by the exchange of fire, so one with no shot and no risk can win.
      if (wary && unit.stance !== 'standoff' && inContact) return [provokes(end), 0, ...WITH_SHOT[unit.stance](spot), spot.toGoal]
      return spot.mine > 0 ? [provokes(end), 0, ...WITH_SHOT[unit.stance](spot), steps] : [provokes(end), 1, ahead(end), ...NO_SHOT[unit.stance](spot)]
    })
  }
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

/** What happens to each unit of the side on turn as its turn begins: burning hurts, mending armor heals. */
function upkeep(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    if (unit.burning > 0) {
      unit.burning--
      events.push({ type: 'effect', id: unit.id, effect: 'incendiary', amount: -BURN_DAMAGE })
      wound(battle, unit, BURN_DAMAGE, events)
    }
    if (unit.hp > 0 && unit.hp < unit.stats.hp && has(unit, 'regen')) {
      unit.hp++
      events.push({ type: 'effect', id: unit.id, effect: 'regen', amount: 1 })
    }
  }
  return events
}

/** The side on turn has its upkeep; each of its units walks its path, lowest id first; then newly sighted pods are revealed. */
function moveSide(battle: Battle): GameEvent[] {
  const events = upkeep(battle)
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
  // A patrolling pod that could not move, hemmed in by others, tries for somewhere else next turn.
  if (battle.turn === 'alien') {
    battle.pods.forEach((pod, index) => {
      const members = battle.units.filter((u) => u.pod === index)
      const moved = events.some((e) => e.type === 'move' && members.some((u) => u.id === e.id))
      if (!pod.revealed && members.length > 0 && !moved) pod.waypoint = { x: randomInt(battle, GRID), y: randomInt(battle, GRID) }
    })
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

/** Medic: heals the most wounded other soldier at half health or less within reach. It does not cost the medic's shot. */
function heal(battle: Battle, unit: Unit): GameEvent[] {
  const wounded = battle.units
    .filter((u) => u.side === unit.side && u !== unit && u.hp <= u.stats.hp / 2 && distance(unit, u) <= MEDIC_REACH)
    .reduce<Unit | undefined>((worst, u) => (!worst || u.hp < worst.hp ? u : worst), undefined)
  if (!wounded) return []
  const amount = Math.min(MEDIC_HEAL, wounded.stats.hp - wounded.hp)
  wounded.hp += amount
  return [{ type: 'heal', id: unit.id, target: wounded.id, amount }]
}

/**
 * A blast on the shootable enemy with the most enemies around it, if at least two are caught and no ally is.
 * It wrecks the props and walls it catches. A rocket replaces the shot; a grenade does not.
 */
function blast(battle: Battle, unit: Unit, seen: Set<number>, damage: number): GameEvent[] {
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
  const events: GameEvent[] = [{ type: 'rocket', id: unit.id, x: centre.x, y: centre.y, hits: best.map((u) => ({ target: u.id, damage })) }]
  for (const target of best) wound(battle, target, damage, events)
  wreck(battle, centre)
  return events
}

/**
 * A shot at the enemy the unit can shoot and is likeliest to hit; the nearest, then the lowest id, wins a tie.
 * Gear effects of both units apply. `chained` marks the extra shot a kill grants, which grants no further one.
 */
function shoot(battle: Battle, unit: Unit, seen: Set<number>, chained = false): GameEvent[] {
  const chanceAt = (target: Unit) => odds(battle, unit, target, unit.stats, has(unit, 'piercing'))
  let enemy: Unit | undefined
  for (const other of battle.units) {
    if (other.side === unit.side || !shootable(battle, unit, unit, other, seen)) continue
    const gain = enemy ? chanceAt(other).hit - chanceAt(enemy).hit : 1
    if (gain > 0 || (gain === 0 && distance(unit, other) < distance(unit, enemy!))) enemy = other
  }
  if (!enemy) return []
  const chance = chanceAt(enemy)
  const hit = random(battle) < chance.hit
  const crit = hit && random(battle) < chance.crit
  const events: GameEvent[] = []
  if (!hit) return [{ type: 'shot', id: unit.id, target: enemy.id, hit, crit, damage: 0 }]

  const executes = has(unit, 'executioner') && enemy.hp <= enemy.stats.hp / 2
  let damage = unit.stats.damage + (crit ? CRIT_BONUS : 0) + (executes ? EXECUTE_BONUS : 0)
  const after: GameEvent[] = []
  if (spend(enemy, 'shield')) {
    damage = 0
    after.push({ type: 'effect', id: enemy.id, effect: 'shield', amount: 0 })
  } else if (damage >= enemy.hp && spend(enemy, 'lastStand')) {
    damage = enemy.hp - 1
    after.push({ type: 'effect', id: enemy.id, effect: 'lastStand', amount: 0 })
  }
  events.push({ type: 'shot', id: unit.id, target: enemy.id, hit, crit, damage }, ...after)
  wound(battle, enemy, damage, events)
  if (enemy.hp > 0 && damage > 0 && has(unit, 'incendiary')) {
    enemy.burning = BURN_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: 'incendiary', amount: 0 })
  }
  if (damage > 0 && has(unit, 'vampiric') && unit.hp < unit.stats.hp) {
    unit.hp++
    events.push({ type: 'effect', id: unit.id, effect: 'vampiric', amount: 1 })
  }
  if (has(enemy, 'thorns')) {
    events.push({ type: 'effect', id: unit.id, effect: 'thorns', amount: -1 })
    wound(battle, unit, 1, events)
  }
  if (enemy.hp <= 0 && unit.hp > 0 && has(unit, 'chain') && !chained) events.push(...shoot(battle, unit, seen, true))
  return events
}

/** Medkit: heals its carrier at half health or less. */
function medkit(unit: Unit): GameEvent[] {
  if (unit.hp > unit.stats.hp / 2 || !spend(unit, 'medkit')) return []
  const amount = Math.min(MEDKIT_HEAL, unit.stats.hp - unit.hp)
  unit.hp += amount
  return [{ type: 'effect', id: unit.id, effect: 'medkit', amount }]
}

/** Whether the unit may act this turn: an alien may not while its pod is unseen or surprised. */
function armed(battle: Battle, unit: Unit): boolean {
  return unit.pod === null || (battle.pods[unit.pod].revealed && !battle.pods[unit.pod].surprised)
}

/**
 * The next unit of the side on turn with something to do acts once. First come what does not cost the shot:
 * a medkit, a medic's heal, a grenade. Then a rocket, when its moment has come, or else a shot.
 * Empty when no unit is left.
 */
function actNext(battle: Battle): GameEvent[] {
  const seen = spotted(battle)
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.id <= battle.shooter || !armed(battle, unit)) continue
    const healed = unit.charges > 0 && unit.ability === 'medic' ? heal(battle, unit) : []
    const thrown = has(unit, 'grenade') && !unit.spent.includes('grenade') ? blast(battle, unit, seen, GRENADE_DAMAGE) : []
    if (thrown.length > 0) unit.spent.push('grenade')
    const fired = unit.charges > 0 && unit.ability === 'rocket' ? blast(battle, unit, seen, ROCKET_DAMAGE) : []
    if (healed.length + fired.length > 0) unit.charges--
    const events = [...medkit(unit), ...healed, ...thrown, ...(fired.length > 0 ? fired : shoot(battle, unit, seen))]
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
