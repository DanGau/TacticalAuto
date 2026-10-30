import { ALIENS, alienStats, NODE_EVERY, REGEN_HEAL } from './aliens'
import { OVERKILL, type FeatId, type Tally } from './feats'
import { TUNING } from './tuning'
import { PARRY_CHANCE } from './doctrines'
import { FUEL_DAMAGE } from './twists'
import {
  crumble,
  onGrid,
  BASE_STATS,
  SIGHT,
  mechUnit,
  type SkillEffect,
  type Stats,
  ACID_DAMAGE,
  ACID_TURNS,
  alienUnit,
  walkingDistances,
  stepCost,
  AMBUSH_AIM,
  AMBUSH_CRIT,

  IMPACT_REACH,
  POD_BLAST,
  POD_REACH,
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

  SPOTTER_AIM,

  BURN_DAMAGE,
  BURN_TURNS,
  LINGER_TURNS,
  NAPALM_DAMAGE,
  SEARING_DAMAGE,

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

  passable,
  PATROL_MOVE,
  PSI_BACKLASH,
  PSI_COOLDOWN,
  PSI_RANGE,
  alert,
  revealed,
  ROCKET_DAMAGE,
  SPAWN_EVERY,
  SPIT_DAMAGE,
  STANDOFF,
  type Battle,
  type Ability,
  type Effect,
  type Side,
  type Stance,
  type Tile,
  type Unit,
  wreck,
  unaware,
} from './battle'
import { ESCAPE_REACH, HOLD_ROUNDS, HOLD_WAVE_EVERY, WAVE_EVERY } from './goals'
import { random, randomInt } from './rng'
import { canShoot, coverAgainst, lineOfSight, odds, sees, detects } from './sight'

export type GameEvent =
  /** `path` lists each tile entered, in order. `with` names a skill that granted the move. */
  | { type: 'move'; id: number; path: Tile[]; with?: Effect }
  /**
   * A pod is sighted. `units` gives each member's tile at that moment. Unless it is ambushed, or `stalked` (it
   * stalked the squad and gave itself away by opening fire), its moves to cover follow.
   */
  | { type: 'reveal'; ambush: boolean; stalked: boolean; units: { id: number; x: number; y: number }[] }
  /** The squad sees a pod that has not noticed it, and holds its fire to set an ambush. */
  | { type: 'sighted'; units: { id: number; x: number; y: number }[] }
  /** `damage` is 0 for a miss. `with` lists the skills, gear and relics of the shooter that shaped the shot or granted it. */
  | { type: 'shot'; id: number; target: number; hit: boolean; crit: boolean; damage: number; with: Effect[] }
  /** A rocket, grenade or napalm (`fire`) lands on a tile, or a burster explodes on it; every unit in `hits` is damaged and the terrain around is wrecked. */
  | { type: 'rocket'; id: number; x: number; y: number; hits: { target: number; damage: number }[]; fire?: true }
  | { type: 'heal'; id: number; target: number; amount: number }
  /** An effect of gear, a skill, a relic or a class ability acts on the unit `id`. `amount` is the health it gained, or lost if negative; 0 when neither. */
  | { type: 'effect'; id: number; effect: Effect | Ability; amount: number }
  /** A spitter's spit lands on its target, which takes `damage`, and leaves acid on the tile. */
  | { type: 'spit'; id: number; target: number; damage: number }
  /** A feeder grows on a trick the squad used: its hits do `damage` more than its weapon's. */
  | { type: 'feed'; id: number; damage: number }
  /** A soldier reaches a civilian and gets them out. */
  | { type: 'saved'; id: number }
  /** A soldier reaches the escape zone and lifts off. */
  | { type: 'escaped'; id: number }
  /** A soldier grabs a raid's supply cache. */
  | { type: 'grabbed'; id: number; x: number; y: number }
  /** A psion panics a soldier, who loses its next action. */
  | { type: 'panic'; id: number; target: number }
  /** A panicked soldier loses its action. */
  | { type: 'frozen'; id: number }
  /** A unit is hurt by acid underfoot, or by the death of the psion of its pod. */
  | { type: 'hurt'; id: number; amount: number; cause: 'acid' | 'backlash' | 'impact' }
  /** A hold is done: the extraction zone appears at x, y. */
  | { type: 'extract'; x: number; y: number }
  /** A wave arrives on a hold, unseen unless the squad already sees where it lands. */
  | { type: 'wave'; units: { id: number; x: number; y: number }[] }
  /** A boss spawns a swarmling, or an engineer deploys a mech. */
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

/** Tiles a ricochet reaches from its first target, an arc leaps, and the leaps it makes. */
const RICOCHET_REACH = 3
const ARC_REACH = 3
const ARC_LEAPS = 2
/** Damage a volatile kill bursts for, and a thundering hit slams a target into what stops it for. */
const VOLATILE_DAMAGE = 2
const SLAM_DAMAGE = 1
/** Mirror images a wearer begins a battle with, and the chance a hit pops one instead. */
const MIRROR_IMAGES = 2
const MIRROR_CHANCE = 0.5
/** Reach of spirit guardians, of a blink, and of a null field. */
const GUARDIAN_REACH = 2
const BLINK_REACH = 5
const NULL_REACH = 3
/** Alien turns fire lies on a tile. */
const FIRE_TURNS = 2
/** Damage a booming charge does to a target that moves. */
const BOOM_DAMAGE = 3
/** How near an alien closing in must come before caltrops are strewn in its path, and how near is too late. */
const CALTROP_RANGE = 6
const CALTROP_LATE = 2

/** Whether an alien closes to fight up close, so rooting or charging it pays most. */
const closing = (unit: Unit) => unit.stance === 'rush' || unit.stats.range <= 1

/**
 * What a shooter's gear makes a target worth beyond the hit chance, in hit chance: holding back an alien that closes
 * in, pulling one that keeps its distance, knocking one into harm, and bursts or arcs where aliens crowd.
 */
function worth(battle: Battle, unit: Unit, enemy: Unit): number {
  const near = (reach: number) => battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= reach).length
  const behind = { x: enemy.x + Math.sign(enemy.x - unit.x), y: enemy.y + Math.sign(enemy.y - unit.y) }
  const harmful = blocked(battle, behind.x, behind.y) || onTile(battle.acid, behind) || onTile(battle.fire, behind) || onTile(battle.caltrops, behind)
  return (
    (has(unit, 'snare') && closing(enemy) && enemy.rooted === 0 ? 0.2 : 0) +
    (has(unit, 'booming') && closing(enemy) && enemy.booming === 0 ? 0.15 : 0) +
    (has(unit, 'tether') && !closing(enemy) ? 0.15 : 0) +
    (has(unit, 'thunder') && harmful ? 0.2 : 0) +
    (has(unit, 'net') && enemy.rooted > 0 ? 0.1 : 0) +
    (has(unit, 'volatile') && enemy.hp + enemy.armor <= unit.stats.damage ? 0.1 * near(1) : 0) +
    (has(unit, 'arc') ? 0.05 * Math.min(ARC_LEAPS, near(ARC_REACH)) : 0)
  )
}

/** Whether a unit's foes include one with `effect`: a squad relic, or a soldier's gear, working on the aliens. */
const foeHas = (battle: Battle, unit: Unit, effect: Effect) => battle.units.some((u) => u.side !== unit.side && u.hp > 0 && has(u, effect))

/** Whether an alien stands in a null field, where it cannot spit, panic, spawn or burst. */
const silenced = (battle: Battle, unit: Unit) => battle.units.some((u) => u.side !== unit.side && has(u, 'null') && distance(u, unit) <= NULL_REACH)

const onTile = (pools: Tile[], unit: Tile) => pools.some((pool) => pool.x === unit.x && pool.y === unit.y)

/** Turns a target `unit` sets burning burns, and one it chills stays chilled. */
const burnFrom = (unit: Unit) => BURN_TURNS + (has(unit, 'smolder') ? LINGER_TURNS : 0)
const chillFrom = (unit: Unit) => CHILL_TURNS + (has(unit, 'permafrost') ? LINGER_TURNS : 0)

/** Uses a once-per-battle effect. False if the unit lacks it or has used it. */
function spend(unit: Unit, effect: Effect): boolean {
  if (!has(unit, effect) || unit.spent.includes(effect)) return false
  unit.spent.push(effect)
  return true
}

/** Ids of the revealed aliens some soldier sees now. */
function spotted(battle: Battle): Set<number> {
  const soldiers = battle.units.filter(isSoldier)
  return new Set(battle.units.filter((u) => u.side === 'alien' && revealed(battle, u) && soldiers.some((s) => sees(battle, s, u))).map((u) => u.id))
}

/** Whether `unit`, standing on `from`, may shoot `target`. Squadsight reaches any spotted alien in a clear line; a ghost is safe from far off. */
function shootable(battle: Battle, unit: Unit, from: Tile, target: Unit, seen: Set<number>): boolean {
  // Soldiers hold their fire on a pod they are setting an ambush on, until it is sprung.
  if (unit.side === 'human' && unaware(battle, target)) return false
  if (has(target, 'ghost') && distance(from, target) > GHOST_REACH) return false
  // A psionic attack needs no line of sight, only an alien whose pod is revealed.
  if (has(unit, 'psionic') && revealed(battle, target) && distance(from, target) <= unit.stats.range) return true
  if (canShoot(battle, from, target, unit.stats.range)) return true
  return unit.ability === 'squadsight' && seen.has(target.id) && lineOfSight(battle, from, target)
}

/**
 * The cheapest path to each tile the unit can reach with `move`, climbing costing more, cheapest first,
 * starting with the empty path. Any first step is in reach.
 */
function paths(battle: Battle, unit: Unit, move: number): Tile[][] {
  const best = new Map([[unit.y * GRID + unit.x, 0]])
  const buckets: Tile[][][] = [[[]]]
  const found: Tile[][] = []
  for (let cost = 0; cost < buckets.length; cost++) {
    for (const path of buckets[cost] ?? []) {
      const from = path.at(-1) ?? unit
      if (best.get(from.y * GRID + from.x) !== cost) continue
      found.push(path)
      for (const [dx, dy] of NEIGHBORS) {
        const x = from.x + dx
        const y = from.y + dy
        if (blocked(battle, x, y) || !passable(battle, from, { x, y })) continue
        const next = cost + stepCost(battle, from, { x, y })
        // A first step is always within reach of a unit that can move, so a climb dearer than its move cannot wall it in.
        if ((next > move && !(cost === 0 && move > 0)) || next >= (best.get(y * GRID + x) ?? Infinity)) continue
        best.set(y * GRID + x, next)
        ;(buckets[next] ??= []).push([...path, { x, y }])
      }
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
  /** 0 with some enemy in sight, else 1. */
  blind: number
  /** The walk to the unit's goal: for a soldier the squad's, for an alien the nearest soldier. */
  toGoal: number
  /** Tiles the squad's centre is beyond COHESION. */
  stray: number
  /** The cover the tile gives against the goal. */
  shelter: number
  /** 1 if the tile brings the unit no nearer the goal than where it stands. */
  stalled: number
  /** Whether the unit is a soldier. Soldiers pick their way forward; aliens press the attack. */
  careful: boolean
}

/**
 * How each stance ranks a tile it can shoot from, lowest first. Weighing `risk` makes a healthy unit bold
 * and a wounded one careful.
 */
/** How much the enemy's best hit chance on a tile, weighted by health, must differ for a soldier to count it safer cover. */
const RISK_BAND = 15

const WITH_SHOT: Record<Stance, (spot: Spot) => number[]> = {
  // A soldier takes the safest cover it can shoot from, then the best shot from it; an alien, the exchange of fire
  // that most favours it. Neither strays from its side.
  balanced: ({ mine, risk, stray, careful }) => [careful ? Math.round(risk / RISK_BAND) : 0, risk - mine + STRAY_COST * stray],
  // The surest shot; what comes back counts only as wounds mount.
  rush: ({ mine, risk, hurt, stray }) => [Math.round(hurt * risk) - mine + STRAY_COST * stray],
  // The same, with safety counted double.
  anchor: ({ mine, risk, stray, careful }) => [careful ? Math.round(risk / RISK_BAND) : 0, 2 * risk - mine + STRAY_COST * stray],
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
 * squadmate, or once the battle drags on, it fights as normal, so a battle always ends, even against a turret.
 * Aliens are never wary; they press the attack.
 */
const WARY = 0.5

/**
 * Closing on the goal with no shot to take. An alien takes the shortest walk. A soldier gives up some of the walk to
 * stay with the squad, to stay out of an enemy's sights, and to end behind cover facing the goal; a wary one walks
 * only through tiles no enemy can shoot. It moves from cover to cover: any tile nearer the goal beats standing still,
 * and among those, cover is worth a lot. A soldier's costs are in tenths of a tile: a tile of straying costs two tiles
 * of progress, a certain hit coming back five, and each level of cover one and a half.
 */
const advance = ({ toGoal, theirs, wary, stray, shelter, careful, stalled }: Spot) => {
  if (!careful) return [toGoal, theirs]
  const cost = 10 * toGoal + 20 * stray + Math.round(theirs / 2) - 15 * shelter
  return wary ? [theirs, stalled, cost] : [stalled, cost]
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
 * Where a side's units close on when they have no shot, by the battle's goal. Soldiers share one, so the squad moves
 * together: on a hold, the uplink, then the extraction zone; on an assassination, the commander once sighted; else the
 * alien nearest the squad's centre. On a rescue each soldier makes for the nearest civilian. On a hold the aliens close on
 * the uplink, then the squad; on a rescue an alien fights a soldier it sees, else hunts the nearest civilian; otherwise
 * an alien closes on the human nearest itself.
 */
function goalOf(battle: Battle, unit: Unit, enemies: Unit[]): Tile | undefined {
  if (enemies.length === 0) return undefined
  if (battle.escape && unit.side === 'human') return battle.escape
  // A raider makes for the nearest cache until it has as many as it came for.
  if (battle.goal === 'raid' && unit.side === 'human' && battle.caches.length > 0) return battle.caches.reduce((a, b) => (distance(b, unit) < distance(a, unit) ? b : a))
  // On a hold an alien makes for the uplink, then from its zone goes for the squad, so no stand-off lasts.
  if (battle.uplink) return unit.side === 'alien' && distance(unit, battle.uplink) <= UPLINK_REACH ? nearest(enemies, unit) : battle.uplink
  const civilians = battle.units.filter((u) => u.civilian)
  if (unit.side === 'alien' && civilians.length > 0) {
    const fighters = enemies.filter((e) => !e.civilian && sees(battle, unit, e))
    return nearest(fighters.length > 0 ? fighters : civilians, unit)
  }
  if (unit.side === 'alien') return nearest(enemies, unit)
  if (civilians.length > 0) return nearest(civilians, unit)
  // A split squad's teams each go their own way.
  const team = centreOf(battle.units.filter((u) => isSoldier(u) && u.team === unit.team))
  return enemies.find((u) => u.target && revealed(battle, u)) ?? nearest(enemies, team)
}

/** On a hold, how far from the uplink a soldier may stand and still defend it; Relay Booster widens it. */
export const UPLINK_REACH = 3
export const RELAY_REACH = 2
const uplinkReach = (battle: Battle) => UPLINK_REACH + (battle.units.some((u) => isSoldier(u) && has(u, 'relay')) ? RELAY_REACH : 0)
/** How far from the uplink a hold's extraction zone appears. */
const EXTRACT_CLEARANCE = 12
/** How near the escape or extraction zone lifts a soldier off; a Signal Flare widens it. */
const FLARE_REACH = 3
const escapeReach = (battle: Battle) => ESCAPE_REACH + (battle.units.some((u) => isSoldier(u) && has(u, 'flare')) ? FLARE_REACH : 0)
/** What Killing Ground adds to an ambush's aim and crit, Bounty Rounds to hits on a boss, and how far an Evac Beacon gets a civilian out from. */
export const KILLZONE = 0.15
export const BOUNTY_DAMAGE = 3
export const BEACON_REACH = 3

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
  const flanker = has(unit, 'backstab')
  /** The best hit chance from `end`, in whole percent; 0 with no shot. A backstabber counts a target out of cover half again. */
  const mine = (end: Tile) => {
    const chances = enemies
      .filter((enemy) => shootable(battle, unit, end, enemy, seen))
      .map((enemy) => odds(battle, end, enemy, unit.stats, has(unit, 'piercing')).hit * (flanker && coverAgainst(battle, enemy, end) === 0 ? 1.5 : 1))
    return Math.round(100 * Math.max(0, ...chances))
  }
  const theirs = (end: Tile) => exposure(battle, enemies, end)
  const squadmates = battle.units.filter((u) => u.side === unit.side && u !== unit && !u.civilian && u.team === unit.team)
  const hurt = 1 - unit.hp / unit.stats.hp
  const wary = unit.side === 'human' && battle.round < RESTLESS_ROUND && hurt >= WARY && squadmates.some((u) => u.hp / u.stats.hp > 1 - WARY)
  const apart = (end: Tile) => Math.max(0, Math.min(MEDIC_REACH, ...squadmates.map((u) => distance(end, u) - MEDIC_REACH)))
  const centre = squadmates.length > 0 ? centreOf(squadmates) : unit
  /** Tiles `end` is beyond COHESION from the middle of the unit's squadmates. Aliens fight as they find themselves. */
  const stray = (end: Tile) => (unit.side === 'human' ? Math.max(0, distance(end, centre) - COHESION) : 0)
  const unseen = battle.units.filter((u) => u.side !== unit.side && !revealed(battle, u))
  // The squad is in a fight while some soldier has an alien in sight.
  const engaged = unit.side === 'human' && seen.size > 0
  /** Whether a soldier on `end` would sight a pod not yet revealed, while the squad is in a fight. */
  const provokes = (end: Tile) => (engaged && unseen.some((alien) => sees(battle, end, alien)) ? 1 : 0)
  /** Whether `end` would hurt the unit to stand on: acid, or fire unless it cannot burn; for a soldier, a fuel tank beside it. Caltrops only slow and hurt the way. */
  const acid = (end: Tile) => (onTile(battle.acid, end) || (unit.side === 'human' && besideFuel(battle, end)) || (onTile(battle.fire, end) && !fireproof(battle, unit)) ? 1 : 0)
  /**
   * What a soldier's gear makes a tile worth, in points of hit chance: a null field over aliens with abilities, spirit
   * guardians where aliens will come while the wearer is healthy, a bond beside a squadmate.
   */
  const role = (end: Tile) =>
    unit.side !== 'human'
      ? 0
      : (has(unit, 'null') ? 15 * enemies.filter((e) => revealed(battle, e) && e.kind !== 'trooper' && distance(end, e) <= NULL_REACH).length : 0) +
        (has(unit, 'guardians') && hurt < WARY ? 8 * enemies.filter((e) => revealed(battle, e) && distance(end, e) <= GUARDIAN_REACH + 2).length : 0) +
        (has(unit, 'bond') && squadmates.some((u) => distance(u, end) <= 1) ? 15 : 0)
  /** Mirror images left make a wearer bolder: half what comes back counts. */
  const images = has(unit, 'mirror') && unit.spent.filter((e) => e === 'mirror').length < MIRROR_IMAGES ? 0.5 : 1
  const uplink = battle.uplink
  // Measured by the walk there, so a wall between a soldier and the uplink cannot strand it.
  const leash = (end: Tile) => (uplink && unit.side === 'human' && distance(end, uplink) > uplinkReach(battle) ? toGoal[end.y * GRID + end.x] : 0)
  const marching = unit.side === 'human' && seen.size === 0
  // An escort follows the squad rather than leading it, so it leads no one.
  const leaders = unit.stance === 'standoff' ? squadmates.filter((u) => u.stance !== 'standoff' && u.stance !== 'escort') : []
  /** The nearest to the enemy this unit may walk while marching: REAR_GAP behind the foremost leader. */
  const slot = marching && leaders.length > 0 ? Math.min(...leaders.map((u) => toGoal[u.y * GRID + u.x])) + REAR_GAP : 0
  /** Tiles `end` is ahead of the unit's place in the formation. */
  const ahead = (end: Tile) => Math.max(0, slot - toGoal[end.y * GRID + end.x])
  /** 0 if a soldier ending its move on `end` gets a civilian out, else 1: a rescuer takes that chance over a shot. */
  const rescuable = unit.side === 'human' ? battle.units.filter((u) => u.civilian && revealed(battle, u)) : []
  const saves = (end: Tile) => (rescuable.some((c) => distance(c, end) <= 1) ? 0 : 1)
  const quarry = enemies.filter((e) => unaware(battle, e))
  /** Whether the squad is setting an ambush: it sees a pod unaware of it, and no alert alien. */
  const setting = unit.side === 'human' && quarry.length > 0 && !enemies.some((e) => revealed(battle, e) && alert(battle, e))
  const noticed = (end: Tile) => (quarry.some((e) => detects(battle, e, { ...unit, x: end.x, y: end.y, moved: true })) ? 1 : 0)
  const lays = (end: Tile) => quarry.some((e) => canShoot(battle, end, e, unit.stats.range))
  const choose = (move: number) => {
    const reach = paths(battle, unit, move)
    /** Whether some tile in reach has a shot; out of contact, even a wary unit keeps advancing. */
    const inContact = reach.some((path) => mine(path.at(-1) ?? unit) > 0)
    return bestPath(reach, unit, (end, steps) => {
      const spot: Spot = {
        mine: mine(end) > 0 ? mine(end) + role(end) : 0,
        theirs: theirs(end),
        risk: Math.round(theirs(end) * (0.5 + 2.5 * hurt) * images),
        hurt,
        wary,
        apart: apart(end),
        crowded: Math.max(0, STANDOFF - Math.min(...enemies.map((enemy) => distance(end, enemy)))),
        blind: enemies.some((enemy) => sees(battle, end, enemy)) ? 0 : 1,
        toGoal: toGoal[end.y * GRID + end.x] - Math.round(role(end) / 10),
        stray: stray(end),
        shelter: coverAgainst(battle, end, goal),
        stalled: toGoal[end.y * GRID + end.x] >= toGoal[unit.y * GRID + unit.x] ? 1 : 0,
        careful: unit.side === 'human' && battle.round < RESTLESS_ROUND,
      }
      // A wary unit ranks every tile by the exchange of fire, so one with no shot and no risk can win.
      // No unit ends its move in acid if it can help it.
      // On a hold, a soldier stands its ground at the uplink before anything else.
      // On an escape every move must bring a soldier nearer the way out.
      const first = [battle.escape && unit.side === 'human' ? spot.stalled : 0, leash(end), acid(end), provokes(end), saves(end)]
      // Setting an ambush: unnoticed first, then a shot at the pod, then the best cover against it, then nearer.
      if (setting) return [...first, noticed(end), lays(end) ? 0 : 1, -coverAgainst(battle, end, goal), steps]
      if (wary && unit.stance !== 'standoff' && inContact) return [...first, 0, ...WITH_SHOT[unit.stance](spot), spot.toGoal]
      return spot.mine > 0 ? [...first, 0, ...WITH_SHOT[unit.stance](spot), steps] : [...first, 1, ahead(end), ...NO_SHOT[unit.stance](spot)]
    })
  }
  // A unit whose perks pay for standing still holds a tile it can shoot from, unless the tile is acid, off the uplink, or too hot for a wary unit.
  const still = has(unit, 'steady') || has(unit, 'doubleTap')
  const shotHere = enemies.some((enemy) => revealed(battle, enemy) && shootable(battle, unit, unit, enemy, seen))
  if (still && shotHere && !battle.escape && !leash(unit) && !acid(unit) && !(wary && theirs(unit) > 0)) return []
  // A booming charge pins a unit that can fight from where it stands; a rooted one cannot move at all.
  if ((unit.booming > 0 && shotHere) || unit.rooted > 0 || (unit.kind === 'sprinter' && unit.chilled > 0)) return []
  const full = Math.max(0, unit.stats.move + (inAura(battle, unit, 'haste') ? HASTE_MOVE : 0) - (unit.chilled > 0 ? CHILL_MOVE : 0))
  // Unseen, a soldier creeps.
  // Unless it wears Ghost Weave.
  const move = unit.side === 'human' && battle.concealed && !has(unit, 'ghost') ? Math.ceil(full * CREEP) : full
  const path = choose(move)
  if (unit.ability === 'runAndGun' && !battle.concealed && mine(path.at(-1) ?? unit) === 0) return choose(2 * move)
  return path
}

/** Tiles from every alien a fleeing civilian counts safe. */
const SAFE = 6

/** A civilian's path: away from the nearest alien until SAFE from all, then toward the nearest soldier. */
function fleePath(battle: Battle, unit: Unit): Tile[] {
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const soldier = nearest(battle.units.filter(isSoldier), unit)
  const toSquad = soldier ? walkingDistances(battle, soldier) : null
  return bestPath(paths(battle, unit, unit.stats.move), unit, (end) => [SAFE - Math.min(SAFE, ...aliens.map((a) => distance(a, end))), toSquad ? toSquad[end.y * GRID + end.x] : 0])
}

/** The path an alien takes while its pod is unaware: toward the pod's waypoint, slowly, unless it guards its post. */
function patrolPath(battle: Battle, unit: Unit): Tile[] {
  if (battle.pods[unit.pod!].guard) return []
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
 * Soldiers and pods notice each other, both by the same rule. A pod the squad notices first is ambushed: caught where
 * it stands. A pod that notices the squad first turns alert unseen and stalks it. When both notice at once, the pod
 * scrambles to fighting positions. A pod caught on its own turn does not shoot until its next.
 */
function sight(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  battle.pods.forEach((pod, index) => {
    if ((pod.revealed && pod.alert) || burrowing(battle, index)) return
    const members = battle.units.filter((u) => u.pod === index)
    const noticed = !pod.revealed && members.some((m) => soldiers.some((s) => detects(battle, s, m)))
    const notices = !pod.alert && members.some((m) => soldiers.some((s) => detects(battle, m, s)))
    const wasAlert = pod.alert
    // A pod the squad is setting an ambush on spots it first: the fight is on, with no ambush.
    if (pod.revealed && notices) {
      Object.assign(pod, { alert: true, surprised: battle.turn === 'alien' })
      events.push({ type: 'reveal', ambush: false, stalked: false, units: members.map(({ id, x, y }) => ({ id, x, y })) })
      return
    }
    // A pod the squad sees first, unaware of it, goes on as it was while the squad sets up its ambush.
    if (noticed && !notices && !wasAlert) {
      pod.revealed = true
      events.push({ type: 'sighted', units: members.map(({ id, x, y }) => ({ id, x, y })) })
      return
    }
    if (notices) {
      pod.alert = true
      pod.stalking = !noticed
    }
    if (!noticed) return
    const ambush = !wasAlert && !notices
    Object.assign(pod, { revealed: true, alert: true, ambushed: ambush, surprised: battle.turn === 'alien' && !wasAlert })
    events.push({ type: 'reveal', ambush, stalked: false, units: members.map(({ id, x, y }) => ({ id, x, y })) })
    if (!ambush && !wasAlert) for (const member of members) walk(member, fightPath(battle, member), events)
  })
  // A soldier at the escape zone lifts off.
  for (const soldier of battle.escape ? soldiers.filter((s) => distance(s, battle.escape!) <= escapeReach(battle)) : []) {
    battle.units.splice(battle.units.indexOf(soldier), 1)
    battle.escaped.push(soldier.soldier!)
    events.push({ type: 'escaped', id: soldier.id })
  }
  // A soldier beside a raid's cache grabs it.
  for (const cache of battle.caches.filter((c) => soldiers.some((s) => distance(s, c) <= 1))) {
    battle.caches.splice(battle.caches.indexOf(cache), 1)
    battle.grabbed++
    events.push({ type: 'grabbed', id: soldiers.find((s) => distance(s, cache) <= 1)!.id, x: cache.x, y: cache.y })
  }
  // A soldier beside a civilian gets them out.
  for (const civilian of battle.units.filter((u) => u.civilian && soldiers.some((s) => distance(s, u) <= (has(s, 'beacon') ? BEACON_REACH : 1)))) {
    battle.units.splice(battle.units.indexOf(civilian), 1)
    battle.saved++
    events.push({ type: 'saved', id: civilian.id })
  }
  battle.concealed = !hunted(battle)
  return events
}

/** Each soldier with the sentinel protocol beside an alien about to walk shoots it, once a turn each. */
function sentries(battle: Battle, unit: Unit, watched: Set<number>): GameEvent[] {
  const events: GameEvent[] = []
  for (const sentry of battle.units.filter((u) => isSoldier(u) && has(u, 'sentinel') && !watched.has(u.id) && distance(u, unit) <= 1)) {
    if (unit.hp <= 0) break
    battle.actor = sentry.id
    const shot = shoot(battle, sentry, spotted(battle), 'sentinel', unit)
    battle.actor = null
    if (shot.length > 0) watched.add(sentry.id)
    events.push(...shot)
  }
  return events
}

/** What befalls a unit that has walked `path`: caltrops it stepped on hurt an alien, and a booming charge goes off. */
function moved(battle: Battle, unit: Unit, path: Tile[], events: GameEvent[]): void {
  const spikes = unit.side === 'alien' ? path.filter((t) => onTile(battle.caltrops, t)).length : 0
  if (spikes > 0) {
    events.push({ type: 'effect', id: unit.id, effect: 'caltrops', amount: -spikes })
    wound(battle, unit, spikes, events)
  }
  if (unit.booming > 0 && unit.hp > 0) {
    unit.booming = 0
    events.push({ type: 'effect', id: unit.id, effect: 'booming', amount: -BOOM_DAMAGE })
    wound(battle, unit, BOOM_DAMAGE, events)
  }
}

/** A mech's stats, and a light drone's, before its engineer's skills. */
const MECH_STATS: Stats = { ...BASE_STATS, hp: 8, armor: 1, aim: 0.65, crit: 0.1, range: 4 }
const DRONE_STATS: Stats = { ...BASE_STATS, hp: 4, damage: 2, aim: 0.65, crit: 0.1, range: 4, move: 6 }
/** Damage a self-destructing mech does to each alien beside it. */
const DETONATE_DAMAGE = 4

/**
 * Deploy Mech: once aliens are in sight, an engineer with a deploy left builds a mech beside it, or drones for a swarm,
 * shaped by its skills. It costs no shot.
 */
function deploy(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (unit.ability !== 'mech' || unit.charges <= 0 || seen.size === 0) return []
  const swarm = has(unit, 'swarm')
  const stats: Stats = swarm ? { ...DRONE_STATS } : { ...MECH_STATS }
  if (has(unit, 'titan')) Object.assign(stats, { hp: stats.hp + 6, damage: stats.damage + 1 })
  if (has(unit, 'plating')) stats.armor += 2
  if (has(unit, 'servos')) Object.assign(stats, { move: stats.move + 2, aim: stats.aim + 0.15 })
  const granted: [SkillEffect, Effect][] = [['plating', 'taunt'], ['spotter', 'mark'], ['linked', 'inspire'], ['shock', 'snare'], ['detonate', 'detonate']]
  const effects = granted.flatMap(([skill, effect]) => (has(unit, skill) ? [effect] : []))
  const tiles = freeTilesNear(battle, unit, !swarm ? 1 : has(unit, 'hive') ? 3 : 2)
  if (tiles.length === 0) return []
  unit.charges--
  return tiles.map((tile) => {
    const mech = mechUnit(battle, unit, { ...stats }, effects, tile)
    battle.units.push(mech)
    return { type: 'spawn', id: unit.id, unit: { id: mech.id, x: mech.x, y: mech.y } }
  })
}

/** Caltrops: once per battle, an alien closing in finds the tiles between it and the carrier strewn with them. */
function strew(battle: Battle, unit: Unit): GameEvent[] {
  if (!has(unit, 'caltrops') || unit.spent.includes('caltrops')) return []
  const rusher = nearest(
    battle.units.filter((u) => u.side !== unit.side && revealed(battle, u) && alert(battle, u) && distance(u, unit) <= CALTROP_RANGE && distance(u, unit) > CALTROP_LATE),
    unit,
  )
  if (!rusher) return []
  unit.spent.push('caltrops')
  const centre = { x: unit.x + 2 * Math.sign(rusher.x - unit.x), y: unit.y + 2 * Math.sign(rusher.y - unit.y) }
  for (const [dx, dy] of [[0, 0], ...NEIGHBORS]) {
    const tile = { x: centre.x + dx, y: centre.y + dy }
    if (tile.x >= 0 && tile.y >= 0 && tile.x < GRID && tile.y < GRID && !onTile(battle.caltrops, tile)) battle.caltrops.push(tile)
  }
  return [{ type: 'effect', id: unit.id, effect: 'caltrops', amount: 0 }]
}

/** Alien turns after which the aliens still unseen patrol toward the squad, and soldiers no longer hang back out of reach. */
const RESTLESS_ROUND = 25

/** Whether some living alien is alert to the squad. */
const hunted = (battle: Battle) => battle.units.some((u) => u.side === 'alien' && alert(battle, u))

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
    if (unit.rooted > 0) unit.rooted--
    if (unit.booming > 0) unit.booming--
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
    if (unit.kind === 'regenerator' && unit.burning === 0 && unit.hp < unit.stats.hp) {
      const amount = Math.min(REGEN_HEAL, unit.stats.hp - unit.hp)
      unit.hp += amount
      events.push({ type: 'effect', id: unit.id, effect: 'regen', amount })
    }
    if (unit.burning > 0) {
      if (foeHas(battle, unit, 'pyre') && !onTile(battle.fire, unit)) battle.fire.push({ x: unit.x, y: unit.y, turns: FIRE_TURNS })
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
  // A hold counts only the rounds the squad ends standing on it. Once held, the uplink is done and the squad extracts.
  if (battle.uplink && battle.units.some((u) => isSoldier(u) && distance(u, battle.uplink!) <= uplinkReach(battle))) battle.held++
  if (battle.uplink && battle.held >= HOLD_ROUNDS) {
    battle.escape = spacedTile(battle, [battle.uplink], EXTRACT_CLEARANCE, 'edge')
    battle.uplink = null
    events.push({ type: 'extract', ...battle.escape })
  }
  for (const husk of battle.husks.splice(0)) {
    const [tile] = freeTilesNear(battle, husk, 1)
    if (!tile) continue
    const unit = alienUnit(battle, { kind: 'husk', stats: alienStats('husk', 0, 0), stance: ALIENS.husk.stance, boss: false, spawns: false, target: false, resists: [] }, tile, husk.pod)
    battle.units.push(unit)
    events.push({ type: 'wave', units: [{ id: unit.id, x: unit.x, y: unit.y }] })
  }
  // A long battle makes the aliens still unseen restless: they patrol toward the squad, so no fight is put off for good.
  if (battle.round >= RESTLESS_ROUND) {
    const soldiers = battle.units.filter(isSoldier)
    for (const pod of battle.pods.filter((p) => !p.revealed)) {
      const member = battle.units.find((u) => battle.pods[u.pod ?? -1] === pod)
      const near = member && nearest(soldiers, member)
      if (near) Object.assign(pod, { guard: false, waypoint: { x: near.x, y: near.y } })
    }
  }
  // A hold's waves come in from the edges, without end, each pack one alien larger every time it returns.
  const hold = battle.goal === 'hold'
  if (battle.waves.length > 0 && battle.round % (hold ? HOLD_WAVE_EVERY : WAVE_EVERY) === 0) {
    const centre = spacedTile(battle, battle.units.filter(isSoldier), ZONE_CLEARANCE, hold ? 'edge' : 'anywhere')
    const wave = battle.waves.shift()!
    if (hold) battle.waves.push({ ...wave, aliens: [...wave.aliens, wave.aliens[0]] })
    // It comes in unseen but hunting, as a stalking pod does, and shows once the squad sights it.
    const units = placePod(battle, wave, centre, false)
    Object.assign(battle.pods.at(-1)!, { alert: true, stalking: true })
    events.push({ type: 'wave', units: units.map(({ id, x, y }) => ({ id, x, y })) })
  }
  battle.acid = battle.acid.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  battle.fire = battle.fire.map((pool) => ({ ...pool, turns: pool.turns - 1 })).filter((pool) => pool.turns > 0)
  for (const unit of battle.units.filter((u) => u.side === 'alien')) {
    // An incubator's time runs only once it is seen.
    if (unit.cooldown > 0 && (unit.kind !== 'incubator' || revealed(battle, unit))) unit.cooldown--
    if (unit.kind === 'incubator' && unit.cooldown === 0) {
      events.push(...hatch(battle, unit))
      continue
    }
    if (!unit.spawns || unit.cooldown > 0 || !revealed(battle, unit) || silenced(battle, unit)) continue
    const [tile] = freeTilesNear(battle, unit, 1)
    if (!tile || (unit.kind === 'hiveNode' && unit.charges <= 0)) continue
    if (unit.kind === 'hiveNode') unit.charges--
    unit.cooldown = unit.kind === 'hiveNode' ? NODE_EVERY : SPAWN_EVERY
    const spawn = alienUnit(battle, { kind: 'swarmling', stats: alienStats('swarmling', 0, 0), stance: ALIENS.swarmling.stance, boss: false, spawns: false, target: false, resists: [] }, tile, unit.pod!)
    battle.units.push(spawn)
    events.push({ type: 'spawn', id: unit.id, unit: { id: spawn.id, x: spawn.x, y: spawn.y } })
  }
  return events
}

/** An incubator hatches: it is gone, and two brutes of its pod stand where it was. */
function hatch(battle: Battle, unit: Unit): GameEvent[] {
  battle.units = battle.units.filter((u) => u !== unit)
  const events: GameEvent[] = [{ type: 'death', id: unit.id }]
  for (const tile of freeTilesNear(battle, unit, 2)) {
    const brute = alienUnit(battle, { kind: 'brute', stats: alienStats('brute', unit.stats.armor, 0), stance: ALIENS.brute.stance, boss: false, spawns: false, target: false, resists: ALIENS.brute.resists }, tile, unit.pod!)
    battle.units.push(brute)
    events.push({ type: 'spawn', id: unit.id, unit: { id: brute.id, x: brute.x, y: brute.y } })
  }
  return events
}

/** Whether a pod is burrowers still underground: unseen, and beyond the squad's sight. */
function burrowing(battle: Battle, index: number): boolean {
  const members = battle.units.filter((u) => u.pod === index)
  return !battle.pods[index].revealed && members.length > 0 && members.every((u) => u.kind === 'burrower')
}

/**
 * Burrowers underground surface once the fight is on or a soldier comes within sight of them: beside the soldier with
 * the fewest squadmates near, ready to strike this turn.
 */
function surface(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  const company = (s: Unit) => battle.units.filter((u) => u.side === s.side && u !== s && !u.civilian && distance(u, s) <= COHESION).length
  battle.pods.forEach((pod, index) => {
    if (!burrowing(battle, index)) return
    const members = battle.units.filter((u) => u.pod === index)
    if (!hunted(battle) && !members.some((m) => soldiers.some((s) => distance(s, m) <= SIGHT))) return
    const alone = soldiers.reduce<Unit | undefined>((best, s) => (!best || company(s) < company(best) ? s : best), undefined)
    if (!alone) return
    freeTilesNear(battle, alone, members.length).forEach((tile, i) => Object.assign(members[i], tile))
    Object.assign(pod, { revealed: true, alert: true, stalking: false, ambushed: false, surprised: false })
    events.push({ type: 'reveal', ambush: false, stalked: true, units: members.map(({ id, x, y }) => ({ id, x, y })) })
    // Surfacing is a move, so overwatch answers it.
    for (const m of members) events.push({ type: 'move', id: m.id, path: [{ x: m.x, y: m.y }] })
  })
  return events
}

/** Drop pods' impact after a breach: each alien beside where a soldier landed is hurt, farther and harder with drop pod relics. */
function impact(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  battle.breach = false
  const soldiers = battle.units.filter(isSoldier)
  const held = (effect: Effect) => soldiers.some((s) => has(s, effect))
  const reach = held('podBlast') || held('podShred') || held('podFrost') ? POD_REACH : IMPACT_REACH
  const damage = TUNING.impactDamage + (held('podBlast') ? POD_BLAST : 0)
  for (const alien of battle.units.filter((u) => u.side === 'alien' && soldiers.some((s) => distance(s, u) <= reach))) {
    events.push({ type: 'hurt', id: alien.id, amount: damage, cause: 'impact' })
    wound(battle, alien, damage, events)
  }
  return events
}

/** The side on turn has its upkeep; each of its units walks its path, lowest id first; acid burns those still in it; then newly sighted pods are revealed. */
function moveSide(battle: Battle): GameEvent[] {
  const events = [...(battle.breach ? impact(battle) : []), ...upkeep(battle), ...(battle.turn === 'alien' ? surface(battle) : [])]
  if (battle.turn === 'alien') {
    for (const pod of battle.pods) {
      // A pod that has reached its waypoint picks the next.
      const arrived = battle.units.some((u) => battle.pods[u.pod ?? -1] === pod && distance(u, pod.waypoint) <= PATROL_MOVE)
      if (!pod.alert && arrived) pod.waypoint = { x: randomInt(battle, GRID), y: randomInt(battle, GRID) }
    }
  }
  const watched = new Set<number>()
  for (const unit of battle.units) {
    if (unit.side !== battle.turn || unit.hp <= 0) continue
    const path = unit.civilian ? fleePath(battle, unit) : alert(battle, unit) ? fightPath(battle, unit) : patrolPath(battle, unit)
    if (path.length === 0) continue
    // A sentry fires as the alien turns to go.
    if (unit.side === 'alien') events.push(...sentries(battle, unit, watched))
    if (unit.hp <= 0) continue
    walk(unit, path, events)
    moved(battle, unit, path, events)
  }
  // Acid burns each unit of the side still standing in it once the side has moved, so a unit free to move can step out.
  for (const unit of battle.units.filter((u) => u.side === battle.turn)) {
    if (!battle.acid.some((pool) => pool.x === unit.x && pool.y === unit.y) || immune(battle, unit, 'acid')) continue
    events.push({ type: 'hurt', id: unit.id, amount: ACID_DAMAGE, cause: 'acid' })
    wound(battle, unit, ACID_DAMAGE, events)
  }
  for (const unit of battle.units.filter((u) => u.side === battle.turn && onTile(battle.fire, u) && !fireproof(battle, u))) {
    unit.burning = BURN_TURNS
    events.push({ type: 'effect', id: unit.id, effect: foeHas(battle, unit, 'pyre') ? 'pyre' : 'napalm', amount: 0 })
  }
  // Spirit guardians strike each alien that ends its move near their wearer.
  if (battle.turn === 'alien') {
    for (const unit of battle.units.filter((u) => u.side === 'alien' && battle.units.some((g) => g.side === 'human' && g.hp > 0 && has(g, 'guardians') && distance(g, u) <= GUARDIAN_REACH))) {
      events.push({ type: 'effect', id: unit.id, effect: 'guardians', amount: -1 })
      wound(battle, unit, 1, events)
    }
  }
  const sighted = [...sight(battle), ...(battle.turn === 'human' ? spring(battle) : [])]
  // Soldiers on overwatch fire once the aliens have moved and any pod sighted has taken its place.
  if (battle.turn === 'alien') sighted.push(...overwatch(battle, [...events, ...sighted].flatMap((e) => (e.type === 'move' ? [e.id] : []))))
  // A patrolling pod that could not move, hemmed in by others, tries for somewhere else next turn.
  if (battle.turn === 'alien') {
    battle.pods.forEach((pod, index) => {
      const members = battle.units.filter((u) => u.pod === index)
      const moved = events.some((e) => e.type === 'move' && members.some((u) => u.id === e.id))
      if (!pod.alert && members.length > 0 && !moved) pod.waypoint = { x: randomInt(battle, GRID), y: randomInt(battle, GRID) }
    })
  }
  return [...events, ...sighted]
}

/**
 * Deals `damage` to a unit: its armor takes it first, then its health. At zero health the unit is removed and its
 * death reported. A burster that dies explodes, and a psion that dies hurts the other aliens of its pod.
 */
/** A soldier's tally for this battle, begun empty. */
export function tallyOf(battle: Battle, soldier: number): Tally {
  return (battle.tally[soldier] ??= { dealt: 0, kills: 0, taken: 0, feats: [] })
}

const feat = (tally: Tally, id: FeatId) => tally.feats.includes(id) || tally.feats.push(id)

function wound(battle: Battle, target: Unit, dealt: number, events: GameEvent[], pierce = false, crit = false): void {
  if (target.hp <= 0) return
  const damage = target.kind === 'wraith' && !crit ? Math.min(dealt, 1) : dealt
  const full = target.hp === target.stats.hp
  // A juggernaut's plate stops a hit whole, and is lost to it.
  const plated = target.kind === 'juggernaut' && !pierce && target.armor > 0
  const absorbed = plated ? damage : pierce ? 0 : Math.min(target.armor, damage)
  // Health lost: damage past what the target had left is counted for nobody.
  const lost = Math.min(target.hp, damage - absorbed)
  target.armor -= plated ? 1 : absorbed
  target.hp -= damage - absorbed
  if (target.soldier !== null) tallyOf(battle, target.soldier).taken += lost
  // A mech's work is its engineer's.
  const by = battle.units.find((u) => u.id === battle.actor)
  const credited = by && by.side !== target.side ? (by.soldier ?? by.summoner) : null
  const tally = credited !== null && credited !== undefined ? tallyOf(battle, credited) : null
  if (tally) {
    tally.dealt += lost
    if (damage >= OVERKILL) feat(tally, 'overkill')
  }
  if (target.hp > 0) return
  // An alien that dies burning spreads the fire, if the squad carries wildfire or its killer backdraft; one that dies
  // chilled, the chill, if its killer has avalanche.
  const wildfire = battle.units.some((u) => u.side !== target.side && has(u, 'wildfire'))
  const killer = by && by.side !== target.side ? by : null
  const beside = battle.units.filter((u) => u.side === target.side && u !== target && distance(u, target) <= 1)
  if (target.burning > 0 && (wildfire || (killer && has(killer, 'backdraft')))) {
    for (const other of beside.filter((u) => !fireproof(battle, u))) {
      other.burning = BURN_TURNS
      events.push({ type: 'effect', id: other.id, effect: wildfire ? 'wildfire' : 'backdraft', amount: 0 })
    }
  }
  if (target.chilled > 0 && killer && has(killer, 'avalanche')) {
    for (const other of beside.filter((u) => !u.resists.includes('frost'))) {
      other.chilled = chillFrom(killer)
      events.push({ type: 'effect', id: other.id, effect: 'avalanche', amount: 0 })
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
  if (target.civilian && killer?.kind === 'harvester') battle.husks.push({ x: target.x, y: target.y, pod: killer.pod! })
  if (has(target, 'detonate')) {
    const caught = battle.units.filter((u) => u.side !== target.side && distance(u, target) <= 1)
    events.push({ type: 'rocket', id: target.id, x: target.x, y: target.y, hits: caught.map((u) => ({ target: u.id, damage: DETONATE_DAMAGE })) })
    for (const u of caught) wound(battle, u, DETONATE_DAMAGE, events)
  }
  if (tally) {
    tally.kills++
    if (full) feat(tally, 'oneShot')
    if (target.boss || target.target) feat(tally, 'giantSlayer')
    if (tally.kills === 3) feat(tally, 'hatTrick')
  }
  // A hexed death passes the mark to the nearest unmarked alien.
  const heir = target.marked && foeHas(battle, target, 'hex') ? nearest(battle.units.filter((u) => u.side === target.side && !u.marked && !u.resists.includes('mark')), target) : undefined
  if (heir) {
    heir.marked = true
    events.push({ type: 'effect', id: heir.id, effect: 'hex', amount: 0 })
  }
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

/**
 * A thundering hit knocks the target a tile straight back from the shooter; if something stops it, it slams into that
 * instead. With `way` -1, a tethered hit pulls it a tile toward the shooter, if the tile is free.
 */
function knockback(battle: Battle, unit: Unit, target: Unit, events: GameEvent[], way = 1): void {
  const to = { x: target.x + way * Math.sign(target.x - unit.x), y: target.y + way * Math.sign(target.y - unit.y) }
  if (!blocked(battle, to.x, to.y) && passable(battle, target, to)) {
    target.x = to.x
    target.y = to.y
    events.push({ type: 'move', id: target.id, path: [to], with: way > 0 ? 'thunder' : 'tether' })
    return
  }
  if (way < 0) return
  events.push({ type: 'effect', id: target.id, effect: 'thunder', amount: -SLAM_DAMAGE })
  wound(battle, target, SLAM_DAMAGE, events)
}

/** Blink: the unit vanishes to the free tile within reach where the enemy's best shot at it is worst. */
function blink(battle: Battle, unit: Unit, events: GameEvent[]): void {
  const enemies = enemiesOf(battle, unit)
  const tiles = freeTilesNear(battle, unit, 4 * BLINK_REACH * BLINK_REACH).filter((t) => distance(t, unit) <= BLINK_REACH)
  const to = tiles.reduce<Tile | undefined>((best, t) => (!best || exposure(battle, enemies, t) < exposure(battle, enemies, best) ? t : best), undefined)
  if (!to) return
  unit.x = to.x
  unit.y = to.y
  events.push({ type: 'move', id: unit.id, path: [to], with: 'blink' })
}

/** Polymorph: once per battle, the toughest alien the unit can shoot, a boss aside, becomes a chicken and loses its next action. */
function polymorph(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (!has(unit, 'polymorph') || unit.spent.includes('polymorph')) return []
  const target = battle.units
    .filter((u) => u.side !== unit.side && !u.boss && !u.panicked && shootable(battle, unit, unit, u, seen))
    .reduce<Unit | undefined>((best, u) => (!best || u.hp > best.hp ? u : best), undefined)
  if (!target) return []
  unit.spent.push('polymorph')
  target.panicked = true
  return [{ type: 'effect', id: target.id, effect: 'polymorph', amount: 0 }]
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
  if (unit.kind && unit.kind !== 'trooper' && silenced(battle, unit)) return unit.kind === 'burster' ? [] : null
  if (unit.kind === 'incubator') return []
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

/** Whether a unit cannot burn: by its nature, a fire suit, or in the rain. */
const fireproof = (battle: Battle, unit: Unit) => unit.resists.includes('burn') || has(unit, 'fireSuit') || battle.twist === 'rain'

/** Napalm: a blast that sets those it catches burning and the ground it covers alight. */
function napalm(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  const radius = has(unit, 'inferno') ? BIG_BLAST_RADIUS : BLAST_RADIUS
  const events = blast(battle, unit, seen, NAPALM_DAMAGE, radius)
  const landed = events[0]
  if (landed?.type !== 'rocket') return events
  landed.fire = true
  for (let y = landed.y - radius; y <= landed.y + radius; y++) {
    for (let x = landed.x - radius; x <= landed.x + radius; x++) {
      if (onGrid(x, y) && !onTile(battle.fire, { x, y })) battle.fire.push({ x, y, turns: FIRE_TURNS })
    }
  }
  for (const hit of landed.hits) {
    const target = battle.units.find((u) => u.id === hit.target)
    if (target && target.hp > 0 && !fireproof(battle, target)) target.burning = burnFrom(unit)
  }
  return events
}

/** Whether a fuel tank stands beside a tile. */
const besideFuel = (battle: Battle, tile: Tile) => NEIGHBORS.some(([dx, dy]) => onGrid(tile.x + dx, tile.y + dy) && battle.props[(tile.y + dy) * GRID + tile.x + dx] === 'fuel')

/** A shot missed `target`: a fuel tank beside it goes up, hurting and setting burning everyone beside the tank. */
function ignite(battle: Battle, target: Unit): GameEvent[] {
  const tank = NEIGHBORS.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).find((t) => onGrid(t.x, t.y) && battle.props[t.y * GRID + t.x] === 'fuel')
  if (!tank) return []
  const caught = battle.units.filter((u) => distance(u, tank) <= 1 && !immune(battle, u, 'blast'))
  const events: GameEvent[] = [{ type: 'rocket', id: target.id, x: tank.x, y: tank.y, hits: caught.map((u) => ({ target: u.id, damage: FUEL_DAMAGE })) }]
  wreck(battle, tank, 0)
  for (const unit of caught) {
    wound(battle, unit, FUEL_DAMAGE, events)
    if (unit.hp > 0 && !fireproof(battle, unit)) unit.burning = BURN_TURNS
  }
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
  const piercing = has(unit, 'piercing') || has(unit, 'pierce') || has(unit, 'psionic')
  const chanceAt = (target: Unit) => odds(battle, unit, target, unit.stats, piercing)
  const inReach = (only ? [only] : battle.units).filter((other) => other.side !== unit.side && shootable(battle, unit, unit, other, seen))
  // An alien with a soldier in reach fights it; only with none does it turn on civilians.
  const fighters = inReach.filter((other) => !other.civilian)
  const taunting = inReach.filter((other) => has(other, 'taunt'))
  let enemy: Unit | undefined
  for (const other of taunting.length > 0 ? taunting : fighters.length > 0 ? fighters : inReach) {
    const gain = enemy ? chanceAt(other).hit + worth(battle, unit, other) - chanceAt(enemy).hit - worth(battle, unit, enemy) : 1
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
  // The ambush bonus: against a pod caught unaware, or for a stalking pod's shots.
  const ambushed = (enemy.pod !== null && battle.pods[enemy.pod].ambushed) || (unit.pod !== null && battle.pods[unit.pod].stalking)
  const baned = battle.units.some((u) => u.side !== unit.side && has(u, 'bane') && distance(u, unit) <= BANE_REACH)
  const toHit =
    chance.hit +
    (ambushed ? AMBUSH_AIM + when(true, 'killzone', KILLZONE) : 0) +
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
  if (hit && has(enemy, 'mirror') && enemy.spent.filter((e) => e === 'mirror').length < MIRROR_IMAGES && random(battle) < MIRROR_CHANCE) {
    hit = false
    enemy.spent.push('mirror')
    events.push({ type: 'effect', id: enemy.id, effect: 'mirror', amount: 0 })
  }
  if (hit && has(enemy, 'parry') && distance(unit, enemy) > 1 && random(battle) < PARRY_CHANCE) {
    hit = false
    events.push({ type: 'effect', id: enemy.id, effect: 'parry', amount: 0 })
  }
  if (!hit) {
    // A ricochet bounces a miss to another alien near the target, for one more roll.
    const bounce = granted ? undefined : has(unit, 'ricochet') ? nearest(inReach.filter((u) => u !== enemy && distance(u, enemy!) <= RICOCHET_REACH), enemy) : undefined
    return [{ type: 'shot', id: unit.id, target: enemy.id, hit, crit: false, damage: 0, with: used }, ...events, ...(battle.twist === 'fuel' ? ignite(battle, enemy) : []), ...(bounce ? shoot(battle, unit, seen, 'ricochet', bounce) : again(battle, unit, seen, granted, false))]
  }

  const sure = when(spend(unit, 'opener'), 'opener', 1) + when(enemy.hp === enemy.stats.hp, 'assassinate', 1) > 0
  const crit = !enemy.resists.includes('crit') && (sure || random(battle) < chance.crit + (ambushed ? AMBUSH_CRIT + (has(unit, 'killzone') ? KILLZONE : 0) : 0))
  // A mirror hits as hard as the squad's hardest hitter; a feeder as hard as it has grown.
  const base = unit.kind === 'mirror' ? Math.max(unit.stats.damage, ...battle.units.filter(isSoldier).map((s) => s.stats.damage)) : unit.stats.damage
  let damage =
    base +
    (unit.kind === 'feeder' ? unit.fury : 0) +
    (crit ? CRIT_BONUS + when(true, 'headshot', HEADSHOT_DAMAGE) : 0) +
    when(enemy.hp <= enemy.stats.hp / 2, 'executioner', EXECUTE_BONUS) +
    when(coverAgainst(battle, enemy, unit) === 0, 'backstab', BACKSTAB_DAMAGE) +
    when(unit.hp <= unit.stats.hp / 2, 'rage', RAGE_DAMAGE) +
    when(enemy.hp < enemy.stats.hp, 'slayer', SLAYER_DAMAGE) +
    (enemy.marked ? TUNING.markDamage : 0) +
    when(enemy.burning > 0, 'accelerant', TUNING.accelerantDamage) +
    when(enemy.chilled > 0, 'shatter', TUNING.shatterDamage) +
    when(enemy.burning > 0, 'searing', SEARING_DAMAGE) +
    when(enemy.chilled > 0, 'icebreak', SEARING_DAMAGE) +
    when(enemy.burning > 0 && enemy.chilled > 0, 'thermal', TUNING.thermalDamage) +
    when(unit.armor > 0, 'armored', 1) +
    when(enemy.rooted > 0, 'net', 2) +
    when(enemy.boss, 'bounty', BOUNTY_DAMAGE) +
    when(unit.fury > 0, 'bloodRite', unit.fury) -
    (has(enemy, 'thick') ? THICK_ARMOR : 0)
  if (when(enemy.armor > 0, 'shred', 1)) enemy.armor = 0
  const pierced = unit.resists.includes('ward') || when(enemy.chilled > 0, 'brittle', 1) + when(enemy.chilled > 0, 'frostbreak', 1) > 0
  const left = enemy.hp + (pierced ? 0 : enemy.armor)
  if (spend(enemy, 'shield')) {
    damage = 0
    events.push({ type: 'effect', id: enemy.id, effect: 'shield', amount: 0 })
    // No one shot kills a commander from full health.
  } else if (damage >= left && ((enemy.target && enemy.hp === enemy.stats.hp) || spend(enemy, 'lastStand'))) {
    damage = left - 1
    events.push({ type: 'effect', id: enemy.id, effect: 'lastStand', amount: 0 })
  }
  // Those beside the target, for a volley or a cleave, as they stand before the hit.
  const beside = battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1)
  events.unshift({ type: 'shot', id: unit.id, target: enemy.id, hit, crit, damage, with: used })
  if (battle.twist === 'crumbling' && damage > 0) crumble(battle, enemy, unit)
  // A bonded squadmate beside the target takes the hit in its place.
  const guard = battle.units.find((u) => u.side === enemy.side && u !== enemy && u.hp > 0 && has(u, 'bond') && distance(u, enemy) <= 1)
  if (guard && damage > 0) {
    events.push({ type: 'effect', id: guard.id, effect: 'bond', amount: -damage })
    wound(battle, guard, damage, events, pierced, crit)
  } else wound(battle, enemy, damage, events, pierced, crit)
  const spare = enemy.hp <= 0 ? when(damage > left, 'overkill', damage - left) : 0
  const next = spare > 0 ? nearest(battle.units.filter((u) => u.side === enemy.side && u.hp > 0), enemy) : undefined
  if (next) {
    events.push({ type: 'effect', id: next.id, effect: 'overkill', amount: -spare })
    wound(battle, next, spare, events)
  }
  const splash = when(damage > 0, 'volley', Math.ceil(damage / 2)) || when(enemy.hp <= 0, 'cleave', CLEAVE_DAMAGE)
  for (const other of splash > 0 ? beside : []) {
    events.push({ type: 'effect', id: other.id, effect: has(unit, 'volley') ? 'volley' : 'cleave', amount: -splash })
    wound(battle, other, splash, events)
  }
  // An arc leaps from the target to the nearest alien not yet struck, and on again.
  if (crit && damage > 0 && when(true, 'arc', 1)) {
    const struck = new Set([enemy.id])
    let from: Unit = enemy
    for (let leap = 0; leap < ARC_LEAPS; leap++) {
      const next = nearest(battle.units.filter((u) => u.side === enemy.side && !struck.has(u.id) && distance(u, from) <= ARC_REACH), from)
      if (!next) break
      struck.add(next.id)
      events.push({ type: 'effect', id: next.id, effect: 'arc', amount: -Math.ceil(damage / 2) })
      wound(battle, next, Math.ceil(damage / 2), events)
      from = next
    }
  }
  if (enemy.hp <= 0 && when(true, 'volatile', 1)) {
    for (const other of beside.filter((u) => u.hp > 0)) {
      events.push({ type: 'effect', id: other.id, effect: 'volatile', amount: -VOLATILE_DAMAGE })
      wound(battle, other, VOLATILE_DAMAGE, events)
    }
  }
  if (enemy.hp > 0 && !enemy.resists.includes('mark') && (when(true, 'mark', 1) || when(true, 'tracer', 1) || when(crit, 'exploit', 1))) enemy.marked = true
  const cryo = damage > 0 && unit.ability === 'cryo'
  if (enemy.hp > 0 && !enemy.resists.includes('frost') && (when(damage > 0, 'frostbite', 1) || cryo || when(crit, 'freeze', 1))) {
    enemy.chilled = chillFrom(unit)
    if (when(true, 'glacial', 1) + when(true, 'rimeLock', 1) > 0) enemy.rooted = CHILL_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: has(unit, 'frostbite') ? 'frostbite' : cryo ? 'cryo' : 'freeze', amount: 0 })
    if (enemy.marked && has(unit, 'conductor')) {
      for (const other of battle.units.filter((u) => u.side === enemy.side && u !== enemy && distance(u, enemy) <= 1 && !u.resists.includes('frost'))) {
        other.chilled = CHILL_TURNS
        events.push({ type: 'effect', id: other.id, effect: 'conductor', amount: 0 })
      }
    }
  }
  if (enemy.hp > 0 && crit && enemy.chilled > 0 && when(true, 'stasis', 1) + when(true, 'deepFreeze', 1) > 0) {
    enemy.panicked = true
    events.push({ type: 'effect', id: enemy.id, effect: has(unit, 'stasis') ? 'stasis' : 'deepFreeze', amount: 0 })
  }
  if (enemy.hp > 0 && damage > 0 && when(true, 'thunder', 1)) knockback(battle, unit, enemy, events)
  if (enemy.hp > 0 && damage > 0 && when(true, 'tether', 1)) knockback(battle, unit, enemy, events, -1)
  if (enemy.hp > 0 && when(true, 'snare', 1)) {
    enemy.rooted = CHILL_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: 'snare', amount: 0 })
  }
  if (enemy.hp > 0 && when(true, 'booming', 1)) {
    enemy.booming = CHILL_TURNS
    events.push({ type: 'effect', id: enemy.id, effect: 'booming', amount: 0 })
  }
  if (enemy.hp > 0 && enemy.hp <= enemy.stats.hp / 2 && spend(enemy, 'blink')) blink(battle, enemy, events)
  if (enemy.hp <= 0 && when(true, 'momentum', 1)) unit.armor++
  if (enemy.hp <= 0 && when(true, 'bloodRite', 1)) unit.fury++
  if (enemy.hp > 0 && when(true, 'suppress', 1)) enemy.suppressed = 2
  if (enemy.hp > 0 && crit && has(unit, 'concussion')) {
    enemy.panicked = true
    events.push({ type: 'effect', id: enemy.id, effect: 'concussion', amount: 0 })
  }
  if (enemy.hp > 0 && !fireproof(battle, enemy) && ((damage > 0 && (has(unit, 'incendiary') || has(unit, 'tinder'))) || when(crit, 'ignite', 1))) {
    enemy.burning = burnFrom(unit)
    events.push({ type: 'effect', id: enemy.id, effect: has(unit, 'incendiary') ? 'incendiary' : has(unit, 'tinder') ? 'tinder' : 'ignite', amount: 0 })
  }
  const healing = (damage > 0 && has(unit, 'vampiric') ? 1 : 0) + (enemy.hp <= 0 && has(unit, 'feast') ? FEAST_HEAL : 0)
  const healed = Math.min(healing, unit.stats.hp - unit.hp)
  if (healed > 0) {
    unit.hp += healed
    events.push({ type: 'effect', id: unit.id, effect: enemy.hp <= 0 && has(unit, 'feast') ? 'feast' : 'vampiric', amount: healed })
  }
  if (has(enemy, 'kindling') && enemy.armor > 0 && !fireproof(battle, unit)) {
    unit.burning = BURN_TURNS
    events.push({ type: 'effect', id: unit.id, effect: 'kindling', amount: 0 })
  }
  if (has(enemy, 'rime')) {
    unit.chilled = CHILL_TURNS
    events.push({ type: 'effect', id: unit.id, effect: 'rime', amount: 0 })
  }
  if (has(enemy, 'thorns')) {
    events.push({ type: 'effect', id: unit.id, effect: 'thorns', amount: -1 })
    wound(battle, unit, 1, events)
  }
  if (when(true, 'demolish', 1)) {
    wreck(battle, enemy)
    events.push({ type: 'effect', id: enemy.id, effect: 'demolish', amount: 0 })
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
    killed && has(unit, 'frenzy') ? 'frenzy' : killed && has(unit, 'chain') ? 'chain' : has(unit, 'twin') ? 'twin' : has(unit, 'doubleTap') && !unit.moved ? 'doubleTap' : has(unit, 'surge') && !unit.spent.includes('surge') ? 'surge' : null
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
      battle.actor = unit.id
      const shot = alien && unit.hp > 0 ? shoot(battle, unit, seen, 'overwatch', alien) : []
      battle.actor = null
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

/** Each feeder in sight grows on a trick the squad's unit used in `events`: its ability, a grenade, or a once-per-battle effect. */
function feed(battle: Battle, unit: Unit, events: GameEvent[]): GameEvent[] {
  const tricked = events.some((e) => (e.type === 'rocket' || e.type === 'heal' || e.type === 'spawn' || (e.type === 'effect' && e.amount >= 0)) && e.id === unit.id)
  if (!tricked) return []
  return battle.units
    .filter((u) => u.kind === 'feeder' && revealed(battle, u))
    .map((u) => {
      u.fury++
      return { type: 'feed', id: u.id, damage: u.fury }
    })
}

/** Whether the unit may act this turn: an alien may not while its pod is unaware or surprised. */
function armed(battle: Battle, unit: Unit): boolean {
  return unit.pod === null || (battle.pods[unit.pod].alert && !battle.pods[unit.pod].surprised)
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
    battle.actor = unit.id
    const healed = unit.charges > 0 && unit.ability === 'medic' ? heal(battle, unit) : []
    const thrown = has(unit, 'grenade') && !unit.spent.includes('grenade') ? blast(battle, unit, seen, GRENADE_DAMAGE) : []
    if (thrown.length > 0) unit.spent.push('grenade')
    const fired =
      unit.charges <= 0 ? [] : unit.ability === 'rocket' ? blast(battle, unit, seen, ROCKET_DAMAGE, has(unit, 'bigBlast') ? BIG_BLAST_RADIUS : BLAST_RADIUS) : unit.ability === 'napalm' ? napalm(battle, unit, seen) : []
    if (healed.length + fired.length > 0) unit.charges--
    const acted = [...medkit(unit), ...secondWind(unit), ...polymorph(battle, unit, seen), ...strew(battle, unit), ...deploy(battle, unit, seen), ...healed, ...thrown, ...(fired.length > 0 ? fired : shoot(battle, unit, seen))]
    // What follows an action: a drone's shot, then a skirmisher's step back.
    const events = acted.length > 0 && unit.hp > 0 ? [...acted, ...drone(battle, unit), ...skirmish(battle, unit)] : acted
    battle.actor = null
    if (unit.side === 'human') events.push(...feed(battle, unit, events))
    if (events.length === 0) continue
    battle.shooter = unit.id
    // A stalking pod gives itself away when it opens fire.
    const pod = unit.pod === null ? null : battle.pods[unit.pod]
    if (pod && !pod.revealed) {
      pod.revealed = true
      events.unshift({ type: 'reveal', ambush: false, stalked: true, units: battle.units.filter((u) => u.pod === unit.pod).map(({ id, x, y }) => ({ id, x, y })) })
    }
    return events
  }
  return []
}

/** Share of its move a soldier walks while the squad is unseen. */
const CREEP = 0.6
/** Squad turns the squad sets up an ambush before it springs it, ready or not. */
const SETUP_TURNS = 2

/**
 * After the squad moves, each ambush it is setting is sprung once every soldier who can fight has a shot at the pod,
 * or after SETUP_TURNS: the pod turns alert and is ambushed, and the squad opens fire together.
 */
function spring(battle: Battle): GameEvent[] {
  const events: GameEvent[] = []
  const soldiers = battle.units.filter((u) => isSoldier(u) && armed(battle, u))
  battle.pods.forEach((pod, index) => {
    if (!pod.revealed || pod.alert) return
    const members = battle.units.filter((u) => u.pod === index)
    pod.stalked++
    const ready = soldiers.every((s) => members.some((m) => canShoot(battle, s, m, s.stats.range)))
    if (!ready && pod.stalked <= SETUP_TURNS) return
    Object.assign(pod, { alert: true, ambushed: true })
    events.push({ type: 'reveal', ambush: true, stalked: false, units: members.map(({ id, x, y }) => ({ id, x, y })) })
  })
  battle.concealed = !hunted(battle)
  return events
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
    // An ambush lasts until the squad's turn ends; surprise, until the aliens'.
    if (battle.turn === 'human') for (const pod of battle.pods) pod.ambushed = false
    else {
      for (const pod of battle.pods) Object.assign(pod, { surprised: false, stalking: false })
      // With every pod that knew of it dead, the squad slips back into stealth.
      battle.concealed = !hunted(battle) && battle.waves.length === 0
    }
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
  // Aliens left to beat: none once the commander falls, for the rest flee.
  const fled = battle.goal === 'assassinate' && !battle.units.some((u) => u.target)
  const aliens = !fled && (battle.units.some((u) => u.side === 'alien') || battle.waves.length > 0)
  // A rescue is over once no civilian is left to save: won if any were. A raid is won once it has the caches it came for.
  const emptied = battle.goal === 'rescue' && !battle.units.some((u) => u.civilian)
  const loaded = battle.goal === 'raid' && battle.grabbed >= battle.greed
  if (!humans || !aliens || emptied || loaded || battle.beat >= MAX_BEATS) {
    battle.phase = 'over'
    // With every alien beaten the squad has won, even if its last soldier fell to the same blast; clones are made anew.
    battle.winner = !aliens || loaded || (emptied && battle.saved > 0) || (!humans && battle.escaped.length > 0) ? 'human' : humans && !emptied ? null : 'alien'
    events.push({ type: 'end', winner: battle.winner })
  }
  return events
}
