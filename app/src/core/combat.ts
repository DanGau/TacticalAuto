import { ALIENS, alienStats } from './aliens'
import {
  ACID_DAMAGE,
  ACID_TURNS,
  alienUnit,
  AMBUSH_AIM,
  AMBUSH_CRIT,
  AURA_REACH,
  BACKSTAB_DAMAGE,
  BANE_AIM,
  BANE_REACH,
  BIG_BLAST_RADIUS,
  BULWARK_DEFENSE,
  DODGE_CHANCE,
  DRONE_DAMAGE,
  DRONE_REACH,
  FEAST_HEAL,
  GHOST_REACH,
  HASTE_MOVE,
  HEADSHOT_DAMAGE,
  INSPIRE_AIM,
  MARK_DAMAGE,
  PHOENIX_HEALTH,
  RAGE_DAMAGE,
  RECKLESS_AIM,
  REVIVE_HEALTH,
  REVIVE_REACH,
  SECOND_WIND_HEAL,
  SKIRMISH_MOVE,
  SLAYER_DAMAGE,
  SUPPRESS_AIM,
  SURGEON_HEAL,
  THICK_ARMOR,
  blocked,
  BLAST_RADIUS,
  BURST_DAMAGE,
  CLEAVE_DAMAGE,
  CHILL_AIM,
  CHILL_MOVE,
  CHILL_TURNS,
  SHATTER_DAMAGE,
  SPOTTER_AIM,
  THERMAL_DAMAGE,
  BURN_DAMAGE,
  BURN_TURNS,
  coverAt,
  CRIT_BONUS,
  distance,
  EXECUTE_BONUS,
  freeTilesNear,
  GRENADE_DAMAGE,
  GRID,
  isSoldier,
  placePod,
  spacedTile,
  ZONE_CLEARANCE,
  MAX_BEATS,
  MEDIC_HEAL,
  MEDIC_REACH,
  MEDKIT_HEAL,
  NEIGHBORS,
  onGrid,
  passable,
  PATROL_MOVE,
  PSI_BACKLASH,
  PSI_COOLDOWN,
  PSI_RANGE,
  revealed,
  ROCKET_DAMAGE,
  SPAWN_EVERY,
  SPIT_DAMAGE,
  STANDOFF,
  type Battle,
  type Effect,
  type Side,
  type Stance,
  type Tile,
  type Unit,
  wreck,
} from './battle'
import { HOLD_ROUNDS, WAVE_EVERY } from './goals'
import { random, randomInt } from './rng'
import { canShoot, coverAgainst, lineOfSight, odds, sees } from './sight'

export type GameEvent =
  /** `path` lists each tile entered, in order. `with` names a skill that granted the move. */
  | { type: 'move'; id: number; path: Tile[]; with?: Effect }
  /** A pod is sighted. `units` gives each member's tile at that moment. Unless it is ambushed, its moves to cover follow. */
  | { type: 'reveal'; ambush: boolean; units: { id: number; x: number; y: number }[] }
  /** `damage` is 0 for a miss. `with` lists the skills, gear and relics of the shooter that shaped the shot or granted it. */
  | { type: 'shot'; id: number; target: number; hit: boolean; crit: boolean; damage: number; with: Effect[] }
  /** A rocket or grenade lands on a tile, or a burster explodes on it; every unit in `hits` is damaged and the terrain around is wrecked. */
  | { type: 'rocket'; id: number; x: number; y: number; hits: { target: number; damage: number }[] }
  | { type: 'heal'; id: number; target: number; amount: number }
  /** An effect of gear, a skill or a relic acts on the unit `id`. `amount` is the health it gained, or lost if negative; 0 when neither. */
  | { type: 'effect'; id: number; effect: Effect; amount: number }
  /** A spitter's spit lands on its target, which takes `damage`, and leaves acid on the tile. */
  | { type: 'spit'; id: number; target: number; damage: number }
  /** A psion panics a soldier, who loses its next action. */
  | { type: 'panic'; id: number; target: number }
  /** A panicked soldier loses its action. */
  | { type: 'frozen'; id: number }
  /** A unit is hurt by acid underfoot, or by the death of the psion of its pod. */
  | { type: 'hurt'; id: number; amount: number; cause: 'acid' | 'backlash' }
  /** A wave arrives on a hold, already in the fight. */
  | { type: 'wave'; units: { id: number; x: number; y: number }[] }
  /** A boss spawns a swarmling. */
  | { type: 'spawn'; id: number; unit: { id: number; x: number; y: number } }
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
  const soldiers = battle.units.filter(isSoldier)
  return new Set(battle.units.filter((u) => u.side === 'alien' && soldiers.some((s) => sees(battle, s, u))).map((u) => u.id))
}

/** Whether `unit`, standing on `from`, may shoot `target`. Squadsight reaches any spotted alien in a clear line; a ghost is safe from far off. */
function shootable(battle: Battle, unit: Unit, from: Tile, target: Unit, seen: Set<number>): boolean {
  if (has(target, 'ghost') && distance(from, target) > GHOST_REACH) return false
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
  // A soldier holds at a distance, out of reach, and from there looks for a clear line before walking nearer.
  // An alien closes like any other, so that two sides hanging back cannot stall a battle.
  standoff: (spot) => (spot.careful ? [spot.theirs, spot.crowded, spot.blind, spot.toGoal + 2 * spot.stray] : advance(spot)),
  escort: (spot) => advance({ ...spot, toGoal: spot.toGoal + spot.apart }),
}

/** The best hit chance any of `enemies` has on a tile from where it stands, in whole percent. */
function exposure(battle: Battle, enemies: Unit[], tile: Tile): number {
  const chances = enemies.filter((enemy) => canShoot(battle, enemy, tile, enemy.stats.range)).map((enemy) => odds(battle, enemy, tile, enemy.stats).hit)
  return Math.round(100 * Math.max(0, ...chances))
}

/**
 * The enemy a side's units close on when they have no shot. Soldiers share one, so the squad moves together:
 * a revealed commander to assassinate, else the revealed alien nearest the squad's centre, or with none revealed,
 * the nearest alien of any pod. An alien closes on the human nearest itself.
 */
function goalOf(battle: Battle, unit: Unit, enemies: Unit[]): Unit | undefined {
  if (unit.side === 'alien') return nearest(enemies, unit)
  return enemies.find((u) => u.target && revealed(battle, u)) ?? nearest(enemies, centreOf(battle.units.filter(isSoldier)))
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
  const theirs = (end: Tile) => exposure(battle, enemies, end)
  const squadmates = battle.units.filter((u) => u.side === unit.side && u !== unit && !u.civilian)
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
  const acid = (end: Tile) => (battle.acid.some((pool) => pool.x === end.x && pool.y === end.y) ? 1 : 0)
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
      // No unit ends its move in acid if it can help it.
      const first = [acid(end), provokes(end)]
      if (wary && unit.stance !== 'standoff' && inContact) return [...first, 0, ...WITH_SHOT[unit.stance](spot), spot.toGoal]
      return spot.mine > 0 ? [...first, 0, ...WITH_SHOT[unit.stance](spot), steps] : [...first, 1, ahead(end), ...NO_SHOT[unit.stance](spot)]
    })
  }
  const move = Math.max(0, unit.stats.move + (inAura(battle, unit, 'haste') ? HASTE_MOVE : 0) - (unit.chilled > 0 ? CHILL_MOVE : 0))
  const path = choose(move)
  if (unit.ability === 'runAndGun' && mine(path.at(-1) ?? unit) === 0) return choose(2 * move)
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
  unit.moved = true
  events.push({ type: 'move', id: unit.id, path })
}

/**
 * Reveals each unseen pod a soldier now sights. A revealed pod at once moves to fighting positions, unless the squad
 * was concealed: then the pod is ambushed, caught where it stands, and the squad's concealment is over.
 */
function sight(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  const ambush = battle.concealed
  battle.pods.forEach((pod, index) => {
    if (pod.revealed) return
    const members = battle.units.filter((u) => u.pod === index)
    const seen = members.some((m) => soldiers.some((s) => sees(battle, s, m)))
    if (!seen) return
    pod.revealed = true
    pod.surprised = battle.turn === 'alien'
    pod.ambushed = ambush
    battle.concealed = false
    events.push({ type: 'reveal', ambush, units: members.map(({ id, x, y }) => ({ id, x, y })) })
    if (!ambush) for (const member of members) walk(member, fightPath(battle, member), events)
  })
  return events
}

/**
 * What happens as a side's turn begins: burning hurts and mending armor heals. On the aliens' turn acid wears off,
 * cooldowns run down, and a boss whose spawn is ready spawns a swarmling.
 */
function upkeep(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    // An explosion earlier in this upkeep may have killed it.
    if (unit.hp <= 0) continue
    unit.moved = false
    if (unit.suppressed > 0) unit.suppressed--
    if (unit.chilled > 0) unit.chilled--
    if (has(unit, 'vitality')) {
      for (const mate of battle.units.filter((u) => u.side === unit.side && u !== unit && u.hp < u.stats.hp && distance(u, unit) <= AURA_REACH)) {
        mate.hp++
        events.push({ type: 'effect', id: mate.id, effect: 'vitality', amount: 1 })
      }
    }
    if (has(unit, 'rearm') && unit.armor < unit.stats.armor) {
      unit.armor++
      events.push({ type: 'effect', id: unit.id, effect: 'rearm', amount: 0 })
    }
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
  if (battle.turn !== 'alien') return events
  battle.round++
  if (battle.waves.length > 0 && battle.round % WAVE_EVERY === 0) {
    const centre = spacedTile(battle, battle.units.filter(isSoldier), ZONE_CLEARANCE)
    const units = placePod(battle, battle.waves.shift()!, centre, true)
    events.push({ type: 'wave', units: units.map(({ id, x, y }) => ({ id, x, y })) })
  }
  battle.acid = battle.acid.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  for (const unit of battle.units.filter((u) => u.side === 'alien')) {
    if (unit.cooldown > 0) unit.cooldown--
    if (!unit.spawns || unit.cooldown > 0 || !revealed(battle, unit)) continue
    const [tile] = freeTilesNear(battle, unit, 1)
    if (!tile) continue
    unit.cooldown = SPAWN_EVERY
    const spawn = alienUnit(battle, { kind: 'swarmling', stats: alienStats('swarmling', 0, 0), stance: ALIENS.swarmling.stance, boss: false, spawns: false, target: false, resists: [] }, tile, unit.pod!)
    battle.units.push(spawn)
    events.push({ type: 'spawn', id: unit.id, unit: { id: spawn.id, x: spawn.x, y: spawn.y } })
  }
  return events
}

/** The side on turn has its upkeep; each of its units walks its path, lowest id first; acid burns those still in it; then newly sighted pods are revealed. */
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
    if (unit.side !== battle.turn || unit.civilian) continue
    walk(unit, revealed(battle, unit) ? fightPath(battle, unit) : patrolPath(battle, unit), events)
  }
  // Acid burns each unit of the side still standing in it once the side has moved, so a unit free to move can step out.
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    if (!battle.acid.some((pool) => pool.x === unit.x && pool.y === unit.y) || immune(battle, unit, 'acid')) continue
    events.push({ type: 'hurt', id: unit.id, amount: ACID_DAMAGE, cause: 'acid' })
    wound(battle, unit, ACID_DAMAGE, events)
  }
  const sighted = sight(battle)
  // Soldiers on overwatch fire once the aliens have moved and any pod sighted has taken its place.
  if (battle.turn === 'alien') sighted.push(...overwatch(battle, [...events, ...sighted].flatMap((e) => (e.type === 'move' ? [e.id] : []))))
  // A patrolling pod that could not move, hemmed in by others, tries for somewhere else next turn.
  if (battle.turn === 'alien') {
    battle.pods.forEach((pod, index) => {
      const members = battle.units.filter((u) => u.pod === index)
      const moved = events.some((e) => e.type === 'move' && members.some((u) => u.id === e.id))
      if (!pod.revealed && members.length > 0 && !moved) pod.waypoint = { x: randomInt(battle, GRID), y: randomInt(battle, GRID) }
    })
  }
  return [...events, ...sighted]
}

/**
 * Deals `damage` to a unit: its armor takes it first, then its health. At zero health the unit is removed and its
 * death reported. A burster that dies explodes, and a psion that dies hurts the other aliens of its pod.
 */
function wound(battle: Battle, target: Unit, damage: number, events: GameEvent[], pierce = false): void {
  if (target.hp <= 0) return
  const absorbed = pierce ? 0 : Math.min(target.armor, damage)
  target.armor -= absorbed
  target.hp -= damage - absorbed
  if (target.hp > 0) return
  // An alien that dies burning spreads the fire, if the squad carries wildfire.
  if (target.burning > 0 && battle.units.some((u) => u.side !== target.side && has(u, 'wildfire'))) {
    for (const other of battle.units.filter((u) => u.side === target.side && u !== target && distance(u, target) <= 1 && !u.resists.includes('burn'))) {
      other.burning = BURN_TURNS
      events.push({ type: 'effect', id: other.id, effect: 'wildfire', amount: 0 })
    }
  }
  // A soldier who would fall may be got back up: by a squadmate's revive, or once by the squad's phoenix protocol.
  const reviver = battle.units.find((u) => u.side === target.side && u !== target && u.hp > 0 && distance(u, target) <= REVIVE_REACH && has(u, 'revive') && !u.spent.includes('revive'))
  const rises = reviver ? 'revive' : has(target, 'phoenix') && !battle.used.includes('phoenix') ? 'phoenix' : null
  if (rises) {
    if (reviver) reviver.spent.push('revive')
    else battle.used.push('phoenix')
    target.hp = rises === 'revive' ? REVIVE_HEALTH : PHOENIX_HEALTH
    events.push({ type: 'effect', id: target.id, effect: rises, amount: target.hp })
    return
  }
  battle.units = battle.units.filter((u) => u !== target)
  events.push({ type: 'death', id: target.id })
  if (target.kind === 'burster') {
    const caught = battle.units.filter((u) => distance(target, u) <= BLAST_RADIUS && !immune(battle, u, 'blast'))
    events.push({ type: 'rocket', id: target.id, x: target.x, y: target.y, hits: caught.map((u) => ({ target: u.id, damage: BURST_DAMAGE })) })
    wreck(battle, target)
    for (const unit of caught) wound(battle, unit, BURST_DAMAGE, events)
  }
  if (target.kind === 'psion') {
    for (const unit of battle.units.filter((u) => u.pod === target.pod)) {
      events.push({ type: 'hurt', id: unit.id, amount: PSI_BACKLASH, cause: 'backlash' })
      wound(battle, unit, PSI_BACKLASH, events)
    }
  }
}

/** A brute that survives a hit charges: it moves at once as near the shooter as its move allows. */
function charge(battle: Battle, brute: Unit, shooter: Unit, events: GameEvent[]): void {
  const toShooter = walkingDistances(battle, shooter)
  walk(brute, bestPath(paths(battle, brute, brute.stats.move), brute, (end) => [toShooter[end.y * GRID + end.x]]), events)
}

/** Spit: the nearest soldier the spitter can shoot is hit without a roll, and acid is left on its tile. */
function spit(battle: Battle, unit: Unit): GameEvent[] {
  const target = nearest(
    battle.units.filter((u) => u.side !== unit.side && canShoot(battle, unit, u, unit.stats.range)),
    unit,
  )
  if (!target) return []
  const events: GameEvent[] = [{ type: 'spit', id: unit.id, target: target.id, damage: SPIT_DAMAGE }]
  battle.acid = [...battle.acid.filter((pool) => pool.x !== target.x || pool.y !== target.y), { x: target.x, y: target.y, turns: ACID_TURNS }]
  wound(battle, target, SPIT_DAMAGE, events, unit.resists.includes('ward'))
  return events
}

/** Panic: when ready, the psion panics the soldier in reach and sight with the best aim not already panicked. */
function panic(battle: Battle, unit: Unit): GameEvent[] {
  if (unit.cooldown > 0) return []
  const targets = battle.units.filter((u) => u.side !== unit.side && !u.panicked && !immune(battle, u, 'panic') && distance(unit, u) <= PSI_RANGE && lineOfSight(battle, unit, u))
  const target = targets.reduce<Unit | undefined>((best, u) => (!best || u.stats.aim > best.stats.aim ? u : best), undefined)
  if (!target) return []
  target.panicked = true
  unit.cooldown = PSI_COOLDOWN
  return [{ type: 'panic', id: unit.id, target: target.id }]
}

/** What an alien does in place of a shot, by its kind; empty if it shoots, or has nothing to do. */
function alienAction(battle: Battle, unit: Unit): GameEvent[] | null {
  if (unit.kind === 'spitter') return spit(battle, unit)
  if (unit.kind === 'psion') {
    const events = panic(battle, unit)
    return events.length > 0 ? events : null
  }
  if (unit.kind !== 'burster') return null
  // A burster beside a soldier blows itself up.
  const events: GameEvent[] = []
  if (battle.units.some((u) => u.side !== unit.side && distance(unit, u) <= 1)) wound(battle, unit, unit.hp, events)
  return events
}

/** Medic: heals the most wounded other soldier at half health or less within reach. It does not cost the medic's shot. */
function heal(battle: Battle, unit: Unit): GameEvent[] {
  const wounded = battle.units
    .filter((u) => u.side === unit.side && u !== unit && u.hp <= u.stats.hp / 2 && distance(unit, u) <= MEDIC_REACH)
    .reduce<Unit | undefined>((worst, u) => (!worst || u.hp < worst.hp ? u : worst), undefined)
  if (!wounded) return []
  const amount = Math.min(MEDIC_HEAL + (has(unit, 'surgeon') ? SURGEON_HEAL : 0), wounded.stats.hp - wounded.hp)
  wounded.hp += amount
  return [{ type: 'heal', id: unit.id, target: wounded.id, amount }]
}

/**
 * A blast on the shootable enemy with the most enemies around it, if at least two are caught and no ally is.
 * It wrecks the props and walls it catches. A rocket replaces the shot; a grenade does not.
 */
function blast(battle: Battle, unit: Unit, seen: Set<number>, damage: number, radius = BLAST_RADIUS): GameEvent[] {
  const inBlast = (centre: Tile) => battle.units.filter((u) => distance(centre, u) <= radius)
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
  wreck(battle, centre, radius)
  return events
}

/** Whether a unit is proof against panic, acid, or a blast: by its own steadfastness, or for panic and acid, by a ward on it or near it. */
function immune(battle: Battle, unit: Unit, to: 'panic' | 'acid' | 'blast'): boolean {
  return has(unit, 'steadfast') || (to !== 'blast' && (has(unit, 'ward') || inAura(battle, unit, 'ward')))
}

/** Second wind: once per battle, a soldier at half health or less heals. */
function secondWind(unit: Unit): GameEvent[] {
  if (unit.hp > unit.stats.hp / 2 || !spend(unit, 'secondWind')) return []
  const amount = Math.min(SECOND_WIND_HEAL, unit.stats.hp - unit.hp)
  unit.hp += amount
  return [{ type: 'effect', id: unit.id, effect: 'secondWind', amount }]
}

/** A combat drone hits the nearest revealed alien its soldier has in sight within reach, without a roll. */
function drone(battle: Battle, unit: Unit): GameEvent[] {
  if (!has(unit, 'drone')) return []
  const target = nearest(
    battle.units.filter((u) => u.side !== unit.side && revealed(battle, u) && distance(unit, u) <= DRONE_REACH && lineOfSight(battle, unit, u)),
    unit,
  )
  if (!target) return []
  const events: GameEvent[] = [{ type: 'shot', id: unit.id, target: target.id, hit: true, crit: false, damage: DRONE_DAMAGE, with: ['drone'] }]
  wound(battle, target, DRONE_DAMAGE, events)
  return events
}

/** A skirmisher steps to the tile in reach where the enemy's best shot at it is worst; it stays if no tile is better. */
function skirmish(battle: Battle, unit: Unit): GameEvent[] {
  if (!has(unit, 'skirmish')) return []
  const enemies = enemiesOf(battle, unit)
  const events: GameEvent[] = []
  walk(unit, bestPath(paths(battle, unit, SKIRMISH_MOVE), unit, (end) => [exposure(battle, enemies, end)]), events)
  return events.map((e) => (e.type === 'move' ? { ...e, with: 'skirmish' as const } : e))
}

/** Whether a squadmate of `unit` with the aura `effect` stands within its reach. */
function inAura(battle: Battle, unit: Unit, effect: Effect): boolean {
  return battle.units.some((u) => u.side === unit.side && u !== unit && has(u, effect) && distance(u, unit) <= AURA_REACH)
}

/**
 * A shot at the enemy the unit can shoot and is likeliest to hit; the nearest, then the lowest id, wins a tie.
 * An alien that can shoot a taunting soldier must. With `only`, the shot is at that enemy or not at all.
 * The effects of both units' gear and skills, and of relics, apply. `granted` names the effect that gave a shot
 * beyond the unit's own; such a shot grants no further one.
 */
function shoot(battle: Battle, unit: Unit, seen: Set<number>, granted?: Effect, only?: Unit): GameEvent[] {
  const piercing = has(unit, 'piercing') || has(unit, 'pierce')
  const chanceAt = (target: Unit) => odds(battle, unit, target, unit.stats, piercing)
  const inReach = (only ? [only] : battle.units).filter((other) => other.side !== unit.side && shootable(battle, unit, unit, other, seen))
  const taunting = inReach.filter((other) => has(other, 'taunt'))
  let enemy: Unit | undefined
  for (const other of taunting.length > 0 ? taunting : inReach) {
    const gain = enemy ? chanceAt(other).hit - chanceAt(enemy).hit : 1
    if (gain > 0 || (gain === 0 && distance(unit, other) < distance(unit, enemy!))) enemy = other
  }
  if (!enemy) return []
  /** The effects of the shooter that shaped this shot, for the player to see. */
  const used: Effect[] = granted ? [granted] : []
  const when = (applies: boolean, effect: Effect, worth: number) => {
    if (!applies || !has(unit, effect)) return 0
    used.push(effect)
    return worth
  }
  const events: GameEvent[] = []
  if (taunting.length > 0 && taunting.length < inReach.length) events.push({ type: 'effect', id: enemy.id, effect: 'taunt', amount: 0 })
  const chance = chanceAt(enemy)
  const ambushed = enemy.pod !== null && battle.pods[enemy.pod].ambushed
  const baned = battle.units.some((u) => u.side !== unit.side && has(u, 'bane') && distance(u, unit) <= BANE_REACH)
  const toHit =
    chance.hit +
    (ambushed ? AMBUSH_AIM : 0) +
    (inAura(battle, unit, 'inspire') ? INSPIRE_AIM : 0) +
    when(true, 'reckless', RECKLESS_AIM) +
    (has(enemy, 'reckless') ? RECKLESS_AIM : 0) +
    when(enemy.marked, 'spotter', SPOTTER_AIM) -
    (unit.chilled > 0 ? CHILL_AIM : 0) -
    (inAura(battle, enemy, 'bulwark') ? BULWARK_DEFENSE : 0) -
    (baned ? BANE_AIM : 0) -
    (unit.suppressed > 0 ? SUPPRESS_AIM : 0)
  // Steady aim rolls twice and takes the better.
  const rolls = 1 + when(!unit.moved, 'steady', 1)
  let hit = Array.from({ length: rolls }, () => random(battle) < toHit).some(Boolean)
  if (hit && has(enemy, 'dodge') && random(battle) < DODGE_CHANCE) {
    hit = false
    events.push({ type: 'effect', id: enemy.id, effect: 'dodge', amount: 0 })
  }
  if (!hit) return [{ type: 'shot', id: unit.id, target: enemy.id, hit, crit: false, damage: 0, with: used }, ...events, ...again(battle, unit, seen, granted, false)]

  const sure = when(spend(unit, 'opener'), 'opener', 1) + when(enemy.hp === enemy.stats.hp, 'assassinate', 1) > 0
  const crit = !enemy.resists.includes('crit') && (sure || random(battle) < chance.crit + (ambushed ? AMBUSH_CRIT : 0))
  let damage =
    unit.stats.damage +
    (crit ? CRIT_BONUS + when(true, 'headshot', HEADSHOT_DAMAGE) : 0) +
    when(enemy.hp <= enemy.stats.hp / 2, 'executioner', EXECUTE_BONUS) +
    when(coverAgainst(battle, enemy, unit) === 0, 'backstab', BACKSTAB_DAMAGE) +
    when(unit.hp <= unit.stats.hp / 2, 'rage', RAGE_DAMAGE) +
    when(enemy.hp < enemy.stats.hp, 'slayer', SLAYER_DAMAGE) +
    (enemy.marked ? MARK_DAMAGE : 0) +
    when(enemy.burning > 0, 'accelerant', 1) +
    when(enemy.chilled > 0, 'shatter', SHATTER_DAMAGE) +
    when(enemy.burning > 0 && enemy.chilled > 0, 'thermal', THERMAL_DAMAGE) +
    when(unit.armor > 0, 'armored', 1) +
    when(unit.fury > 0, 'bloodRite', unit.fury) -
    (has(enemy, 'thick') ? THICK_ARMOR : 0)
  if (when(enemy.armor > 0, 'shred', 1)) enemy.armor = 0
  if (spend(enemy, 'shield')) {
    damage = 0
    events.push({ type: 'effect', id: enemy.id, effect: 'shield', amount: 0 })
  } else if (damage >= enemy.hp + enemy.armor && spend(enemy, 'lastStand')) {
    damage = enemy.hp + enemy.armor - 1
    events.push({ type: 'effect', id: enemy.id, effect: 'lastStand', amount: 0 })
  }
  // Those beside the target, for a volley or a cleave, as they stand before the hit.
  const beside = battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1)
  events.unshift({ type: 'shot', id: unit.id, target: enemy.id, hit, crit, damage, with: used })
  wound(battle, enemy, damage, events, unit.resists.includes('ward'))
  const splash = when(damage > 0, 'volley', Math.ceil(damage / 2)) || when(enemy.hp <= 0, 'cleave', CLEAVE_DAMAGE)
  for (const other of splash > 0 ? beside : []) {
    events.push({ type: 'effect', id: other.id, effect: has(unit, 'volley') ? 'volley' : 'cleave', amount: -splash })
    wound(battle, other, splash, events)
  }
  if (enemy.hp > 0 && !enemy.resists.includes('mark') && (when(true, 'mark', 1) || when(true, 'tracer', 1) || when(crit, 'exploit', 1))) enemy.marked = true
  if (enemy.hp > 0 && !enemy.resists.includes('frost') && (when(damage > 0, 'frostbite', 1) || when(crit, 'freeze', 1))) {
    enemy.chilled = CHILL_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: has(unit, 'frostbite') ? 'frostbite' : 'freeze', amount: 0 })
  }
  if (enemy.hp <= 0 && when(true, 'momentum', 1)) unit.armor++
  if (enemy.hp <= 0 && when(true, 'bloodRite', 1)) unit.fury++
  if (enemy.hp > 0 && when(true, 'suppress', 1)) enemy.suppressed = 2
  if (enemy.hp > 0 && crit && has(unit, 'concussion')) {
    enemy.panicked = true
    events.push({ type: 'effect', id: enemy.id, effect: 'concussion', amount: 0 })
  }
  if (enemy.hp > 0 && !enemy.resists.includes('burn') && ((damage > 0 && has(unit, 'incendiary')) || when(crit, 'ignite', 1))) {
    enemy.burning = BURN_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: has(unit, 'incendiary') ? 'incendiary' : 'ignite', amount: 0 })
  }
  const healing = (damage > 0 && has(unit, 'vampiric') ? 1 : 0) + (enemy.hp <= 0 && has(unit, 'feast') ? FEAST_HEAL : 0)
  const healed = Math.min(healing, unit.stats.hp - unit.hp)
  if (healed > 0) {
    unit.hp += healed
    events.push({ type: 'effect', id: unit.id, effect: enemy.hp <= 0 && has(unit, 'feast') ? 'feast' : 'vampiric', amount: healed })
  }
  if (has(enemy, 'rime')) {
    unit.chilled = CHILL_TURNS
    events.push({ type: 'effect', id: unit.id, effect: 'rime', amount: 0 })
  }
  if (has(enemy, 'thorns')) {
    events.push({ type: 'effect', id: unit.id, effect: 'thorns', amount: -1 })
    wound(battle, unit, 1, events)
  }
  if (enemy.kind === 'brute' && enemy.hp > 0 && unit.hp > 0) charge(battle, enemy, unit, events)
  return [...events, ...again(battle, unit, seen, granted, enemy.hp <= 0)]
}

/**
 * The one more shot a shot may grant: after a kill, to a soldier with frenzy or a frenzied weapon; else to one with
 * double tap who did not move; else, once per battle, to one with action surge.
 */
function again(battle: Battle, unit: Unit, seen: Set<number>, granted: Effect | undefined, killed: boolean): GameEvent[] {
  if (granted || unit.hp <= 0) return []
  const by: Effect | null =
    killed && has(unit, 'frenzy') ? 'frenzy' : killed && has(unit, 'chain') ? 'chain' : has(unit, 'doubleTap') && !unit.moved ? 'doubleTap' : has(unit, 'surge') && !unit.spent.includes('surge') ? 'surge' : null
  if (!by) return []
  const shots = shoot(battle, unit, seen, by)
  if (by === 'surge' && shots.length > 0) unit.spent.push('surge')
  return shots
}

/** Overwatch: each soldier with it shoots at the first alien that moved this turn and that it can now shoot. */
function overwatch(battle: Battle, moved: number[]): GameEvent[] {
  const events: GameEvent[] = []
  for (const unit of battle.units.filter((u) => u.side === 'human' && has(u, 'overwatch'))) {
    const seen = spotted(battle)
    for (const id of moved) {
      const alien = battle.units.find((u) => u.id === id && revealed(battle, u))
      const shot = alien && unit.hp > 0 ? shoot(battle, unit, seen, 'overwatch', alien) : []
      if (shot.length === 0) continue
      events.push(...shot)
      break
    }
  }
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
 * The next unit of the side on turn with something to do acts once. A panicked soldier loses the action.
 * An alien does what its kind does in place of a shot, if anything. Otherwise, first come what does not cost the
 * shot: a medkit, a medic's heal, a grenade. Then a rocket, when its moment has come, or else a shot.
 * Empty when no unit is left.
 */
function actNext(battle: Battle): GameEvent[] {
  const seen = spotted(battle)
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.id <= battle.shooter || unit.civilian || !armed(battle, unit)) continue
    if (unit.panicked) {
      unit.panicked = false
      battle.shooter = unit.id
      return [{ type: 'frozen', id: unit.id }]
    }
    const special = alienAction(battle, unit)
    if (special) {
      if (special.length === 0) continue
      battle.shooter = unit.id
      return special
    }
    const healed = unit.charges > 0 && unit.ability === 'medic' ? heal(battle, unit) : []
    const thrown = has(unit, 'grenade') && !unit.spent.includes('grenade') ? blast(battle, unit, seen, GRENADE_DAMAGE) : []
    if (thrown.length > 0) unit.spent.push('grenade')
    const fired = unit.charges > 0 && unit.ability === 'rocket' ? blast(battle, unit, seen, ROCKET_DAMAGE, has(unit, 'bigBlast') ? BIG_BLAST_RADIUS : BLAST_RADIUS) : []
    if (healed.length + fired.length > 0) unit.charges--
    const acted = [...medkit(unit), ...secondWind(unit), ...healed, ...thrown, ...(fired.length > 0 ? fired : shoot(battle, unit, seen))]
    // What follows an action: a drone's shot, then a skirmisher's step back.
    const events = acted.length > 0 && unit.hp > 0 ? [...acted, ...drone(battle, unit), ...skirmish(battle, unit)] : acted
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
    // An ambush lasts until the squad's turn ends.
    if (battle.turn === 'human') for (const pod of battle.pods) pod.ambushed = false
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
  const humans = battle.units.some(isSoldier)
  // Aliens left to beat: none once the commander falls, for the rest flee, nor once a hold has lasted.
  const fled = (battle.goal === 'assassinate' && !battle.units.some((u) => u.target)) || (battle.goal === 'hold' && battle.round > HOLD_ROUNDS)
  const aliens = !fled && (battle.units.some((u) => u.side === 'alien') || battle.waves.length > 0)
  if (!humans || !aliens || battle.beat >= MAX_BEATS) {
    battle.phase = 'over'
    // With every alien beaten the squad has won, even if its last soldier fell to the same blast; clones are made anew.
    battle.winner = !aliens ? 'human' : humans ? null : 'alien'
    events.push({ type: 'end', winner: battle.winner })
  }
  return events
}
