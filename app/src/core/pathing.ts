// Where a unit moves: candidate paths, scored by stance, goal and threat.
import { type Battle, type Unit, type Tile, GRID, type Stance, revealed, alert, isSoldier, unaware, STANDOFF, MEDIC_REACH, HASTE_MOVE, CHILL_MOVE, type Order, PATROL_MOVE } from './battle'
import { blocked } from './grid'
import { walkingDistances } from './grid'
import { passable } from './grid'
import { coverAt } from './grid'
import { stepCost } from './grid'
import { onGrid } from './grid'
import { NEIGHBORS } from './grid'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { vipOf, carrying, nearest, lying, UPLINK_REACH, centreOf, uplinkReach, spotted, shootable, RESTLESS_ROUND, onTile, NULL_REACH, MIRROR_IMAGES, inAura, has, GUARDIAN_REACH, fireproof, enemiesOf, besideFuel, foes } from './fighters'
import { ESCORT_REACH } from './goals'
import { canShoot, detects, coverAgainst, odds, sees } from './sight'

/**
 * The cheapest path to each tile the unit can reach with `move`, climbing costing more, cheapest first,
 * starting with the empty path. Any first step is in reach. Of equally cheap paths to a tile, the one that turns least
 * is kept, so a unit walks straight rather than weaving.
 */
export function paths(battle: Battle, unit: Unit, move: number): Tile[][] {
  const best = new Map([[unit.y * GRID + unit.x, 0]])
  const turns = new Map([[unit.y * GRID + unit.x, 0]])
  const buckets: { path: Tile[]; turns: number }[][] = [[{ path: [], turns: 0 }]]
  const found: Tile[][] = []
  for (let cost = 0; cost < buckets.length; cost++) {
    for (const { path, turns: bends } of buckets[cost] ?? []) {
      const from = path.at(-1) ?? unit
      const key = from.y * GRID + from.x
      if (best.get(key) !== cost || turns.get(key) !== bends) continue
      // Settled: a later entry for the tile with as few turns is a duplicate.
      turns.set(key, -1)
      found.push(path)
      const back = path.at(-2) ?? (path.length > 0 ? unit : null)
      for (const [dx, dy] of NEIGHBORS) {
        const x = from.x + dx
        const y = from.y + dy
        if (blocked(battle, x, y) || !passable(battle, from, { x, y })) continue
        const next = cost + stepCost(battle, from, { x, y })
        const bent = bends + (back && (from.x - back.x !== dx || from.y - back.y !== dy) ? 1 : 0)
        const known = best.get(y * GRID + x) ?? Infinity
        // A first step is always within reach of a unit that can move, so a climb dearer than its move cannot wall it in.
        if (next > move && !(cost === 0 && move > 0)) continue
        if (next > known || (next === known && !(bent < (turns.get(y * GRID + x) ?? Infinity)))) continue
        best.set(y * GRID + x, next)
        turns.set(y * GRID + x, bent)
        ;(buckets[next] ??= []).push({ path: [...path, { x, y }], turns: bent })
      }
    }
  }
  return found
}

/** The path whose end `score` ranks lowest, comparing scores entry by entry; the shortest wins a tie. */
export function bestPath(candidates: Tile[][], unit: Unit, score: (end: Tile, steps: number) => number[]): Tile[] {
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
export interface Spot {
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
  /** Known enemies that could walk within range of the tile next turn. */
  threat: number
}

/** How much the enemy's best hit chance on a tile, weighted by health, must differ for a soldier to count it safer cover. */
export const RISK_BAND = 15

/**
 * How each stance ranks a tile it can shoot from, lowest first. Weighing `risk` makes a healthy unit bold
 * and a wounded one careful.
 */
export const WITH_SHOT: Record<Stance, (spot: Spot) => number[]> = {
  // A soldier takes the safest cover it can shoot from, then the best shot from it; an alien, the exchange of fire
  // that most favours it. Neither strays from its side.
  balanced: ({ mine, risk, stray, careful, threat }) => [careful ? Math.round(risk / RISK_BAND) : 0, risk - mine + STRAY_COST * stray + THREAT_COST * threat],
  // The surest shot; what comes back counts only as wounds mount.
  rush: ({ mine, risk, hurt, stray }) => [Math.round(hurt * risk) - mine + STRAY_COST * stray],
  // The same, with safety counted double.
  anchor: ({ mine, risk, stray, careful, threat }) => [careful ? Math.round(risk / RISK_BAND) : 0, 2 * risk - mine + STRAY_COST * stray + 2 * THREAT_COST * threat],
  // Out of every enemy's reach, then at a distance, then the best shot.
  standoff: ({ mine, theirs, crowded }) => [theirs, crowded, -mine],
  // A good exchange that keeps a squadmate within reach.
  escort: ({ mine, risk, apart, stray }) => [risk - mine + 10 * apart + STRAY_COST * stray],
}

/** What each enemy that could reach a tile to shoot it next turn costs it, in points of hit chance. */
export const THREAT_COST = 5

/** Tiles a soldier may be from the squad's centre before it counts as straying. */
export const COHESION = 4

/** What each tile of straying costs a firing position, in points of hit chance. */
export const STRAY_COST = 8

/**
 * Tiles a standoff soldier keeps behind the foremost squadmate while no soldier sees an alien, so the squad's
 * front line meets the enemy first.
 */
export const REAR_GAP = 2

/**
 * A soldier that has lost this share of its health is wary while a healthier squadmate fights on: it gives up a shot
 * for a tile where less comes back, and stops advancing through tiles an enemy can shoot. With no healthier
 * squadmate, or once the battle drags on, it fights as normal, so a battle always ends, even against a turret.
 * Aliens are never wary; they press the attack.
 */
export const WARY = 0.5

/**
 * Closing on the goal with no shot to take. An alien takes the shortest walk. A soldier gives up some of the walk to
 * stay with the squad, to stay out of an enemy's sights, and to end behind cover facing the goal; a wary one walks
 * only through tiles no enemy can shoot. It moves from cover to cover: any tile nearer the goal beats standing still,
 * and among those, cover is worth a lot. A soldier's costs are in tenths of a tile: a tile of straying costs two tiles
 * of progress, a certain hit coming back five, each level of cover one and a half, and each enemy that could come
 * within range of it next turn two.
 */
export const advance = ({ toGoal, theirs, wary, stray, shelter, careful, stalled, threat }: Spot) => {
  if (!careful) return [toGoal, theirs]
  const cost = 10 * toGoal + 20 * stray + Math.round(theirs / 2) - 15 * shelter + 20 * threat
  return wary ? [theirs, threat, stalled, cost] : [stalled, cost]
}

/** How each stance ranks a tile with no shot, lowest first. */
export const NO_SHOT: Record<Stance, (spot: Spot) => number[]> = {
  balanced: advance,
  rush: advance,
  anchor: advance,
  // A soldier holds at a distance, out of reach, and from there looks for a clear line before walking nearer.
  // An alien closes like any other, so that two sides hanging back cannot stall a battle.
  standoff: (spot) => (spot.careful ? [spot.theirs, spot.crowded, spot.blind, spot.toGoal + 2 * spot.stray] : advance(spot)),
  escort: (spot) => advance({ ...spot, toGoal: spot.toGoal + spot.apart }),
}

/**
 * How many of `enemies`, revealed and alert, could walk within range of each tile next turn: the danger of standing
 * there. Walls the walk goes round count; line of sight from where it ends does not.
 */
export function threats(battle: Battle, enemies: Unit[]): (tile: Tile) => number {
  const known = enemies.filter((e) => !e.civilian && revealed(battle, e) && alert(battle, e) && e.stats.range > 0)
  const fields = known.map((e) => ({ walk: walkingDistances(battle, e), reach: e.stats.move + e.stats.range }))
  // A tile no walk ends on, such as one a unit that never moves stands on, is as near as its nearest neighbour.
  const near = (walk: readonly number[], tile: Tile) =>
    Math.min(walk[tile.y * GRID + tile.x], ...NEIGHBORS.map(([dx, dy]) => (onGrid(tile.x + dx, tile.y + dy) ? walk[(tile.y + dy) * GRID + tile.x + dx] + 1 : Infinity)))
  return (tile) => fields.filter(({ walk, reach }) => near(walk, tile) <= reach).length
}

/** The best hit chance any of `enemies` has on a tile from where it stands, in whole percent. */
export function exposure(battle: Battle, enemies: Unit[], tile: Tile): number {
  const chances = enemies.filter((enemy) => canShoot(battle, enemy, tile, enemy.stats.range)).map((enemy) => odds(battle, enemy, tile, enemy.stats).hit)
  return Math.round(100 * Math.max(0, ...chances))
}

/**
 * Where a side's units close on when they have no shot, by the battle's goal. Soldiers share one, so the squad moves
 * together: on a hold, the uplink, then the extraction zone; on a VIP rescue, the VIP, then the extraction zone; on an
 * assassination, the commander once sighted; else the alien nearest the squad's centre; on a rescue, the alien nearest a
 * civilian, or with none near one, the civilian nearest the squad. On a hold the aliens
 * close on the uplink, then the squad; otherwise an alien closes on the soldier nearest itself, shooting civilians on
 * the way.
 */
export function goalOf(battle: Battle, unit: Unit, enemies: Unit[]): Tile | undefined {
  // The squad goes for the VIP until it reaches them.
  const vip = vipOf(battle)
  if (vip && unit.side === 'human' && battle.vip !== 'freed') return vip
  if (enemies.length === 0 && !(battle.extract && unit.side === 'human')) return undefined
  // Getting out, a soldier with its hands free goes for the nearest squadmate down first.
  if (battle.extract && unit.side === 'human') return (!carrying(battle, unit) && nearest(lying(battle), unit)) || battle.extract
  const captive = unit.side === 'human' && nearest(lying(battle).filter((d) => battle.captives.some((r) => r.soldier === d.soldier)), unit)
  if (captive) return captive
  // A raider makes for the nearest cache it can walk to until it has as many as it came for; walled off from all, it fights.
  const caches = battle.goal === 'raid' && unit.side === 'human' ? battle.caches.filter((c) => walkingDistances(battle, c)[unit.y * GRID + unit.x] < Infinity) : []
  if (caches.length > 0) return caches.reduce((a, b) => (distance(b, unit) < distance(a, unit) ? b : a))
  // On a hold an alien makes for the uplink, then from its zone goes for the squad, so no stand-off lasts.
  if (battle.uplink) return unit.side === 'alien' && distance(unit, battle.uplink) <= UPLINK_REACH ? nearest(enemies, unit) : battle.uplink
  const civilians = battle.units.filter((u) => u.civilian && u.civilian !== 'vip')
  if (unit.side === 'alien') return nearest(enemies.filter((e) => !e.civilian), unit) ?? nearest(enemies, unit)
  const squad = centreOf(battle.units.filter(isSoldier))
  if (civilians.length > 0) {
    // The squad goes for the alien nearest a civilian, nearest the squad among equals, before civilians no alien is near.
    const prey = (e: Unit) => Math.min(...civilians.map((c) => distance(c, e)))
    const hunters = enemies.filter((e) => prey(e) <= PREY_REACH).sort((a, b) => prey(a) - prey(b) || distance(a, squad) - distance(b, squad))
    return hunters[0] ?? nearest(civilians, squad)
  }
  return enemies.find((u) => u.target && revealed(battle, u)) ?? nearest(enemies, squad)
}

/** How near a civilian an alien must be for the squad to go for it on a rescue. */
export const PREY_REACH = 8

/**
 * What a shot at a civilian is worth to an alien beside the same chance at a soldier: it takes a good shot at a soldier,
 * or a civilian before a poor one, so a squad that hangs back loses civilians.
 */
export const PREY_WORTH = 0.25

/** What a shot at a VIP is worth to an alien beside the same chance at a soldier: it takes any it can get. */
export const VIP_WORTH = 1.5

/** What a hit chance at `target` is worth to an alien. */
export const preyed = (target: Unit, hit: number) => (target.civilian === 'vip' ? VIP_WORTH * hit : target.civilian ? PREY_WORTH * hit : hit)

/**
 * The path a fighting unit takes in its move stage: to the tile its stance ranks best, preferring any tile with a
 * shot over any without; the fewest steps wins a tie. Run and Gun doubles the move when the normal move reaches no shot.
 * While some soldier has an alien in sight, a soldier first avoids any tile from which it would sight another pod,
 * so one engagement ends before the next begins. A soldier left with no shot sets its order: see orderFor.
 */
export function fightPath(battle: Battle, unit: Unit): Tile[] {
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
      .map((enemy) => preyed(enemy, odds(battle, end, enemy, unit.stats, has(unit, 'piercing')).hit) * (flanker && coverAgainst(battle, enemy, end) === 0 ? 1.5 : 1))
    return Math.round(100 * Math.max(0, ...chances))
  }
  const theirs = (end: Tile) => exposure(battle, enemies, end)
  const threat = unit.side === 'human' ? threats(battle, enemies) : () => 0
  const squadmates = battle.units.filter((u) => u.side === unit.side && u !== unit && !u.civilian)
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
  const rescuable = unit.side === 'human' ? battle.units.filter((u) => u.civilian && u.civilian !== 'vip') : []
  const saves = (end: Tile) => (rescuable.some((c) => distance(c, end) <= 1) ? 0 : 1)
  const ward = battle.vip === 'freed' && unit.side === 'human' && enemies.some((e) => e.side === 'alien') ? vipOf(battle) : undefined
  /** Tiles `end` is more than a step beyond ESCORT_REACH of the VIP the squad escorts. */
  const escort = (end: Tile) => (ward ? Math.max(0, distance(end, ward) - ESCORT_REACH - 1) : 0)
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
        // A rescue is no time for care: every turn costs civilians.
        careful: unit.side === 'human' && battle.round < RESTLESS_ROUND && battle.goal !== 'rescue',
        threat: threat(end),
      }
      // A wary unit ranks every tile by the exchange of fire, so one with no shot and no risk can win.
      // No unit ends its move in acid if it can help it.
      // On a hold, a soldier stands its ground at the uplink before anything else.
      // Getting out, a soldier makes for the way out as fast as it can.
      // Escorting, a soldier keeps by the VIP.
      const first = [escort(end), battle.extract && unit.side === 'human' ? spot.toGoal : 0, leash(end), acid(end), provokes(end), saves(end)]
      // Setting an ambush: unnoticed first, then a shot at the pod, then the best cover against it, then nearer.
      if (setting) return [...first, noticed(end), lays(end) ? 0 : 1, -coverAgainst(battle, end, goal), steps]
      if (wary && unit.stance !== 'standoff' && inContact) return [...first, 0, ...WITH_SHOT[unit.stance](spot), spot.toGoal]
      return spot.mine > 0 ? [...first, 0, ...WITH_SHOT[unit.stance](spot), steps] : [...first, 1, ahead(end), ...NO_SHOT[unit.stance](spot)]
    })
  }
  // A unit whose perks pay for standing still holds a tile it can shoot from, unless the tile is acid, off the uplink, or too hot for a wary unit.
  const still = has(unit, 'steady') || has(unit, 'doubleTap')
  const shotHere = enemies.some((enemy) => revealed(battle, enemy) && shootable(battle, unit, unit, enemy, seen))
  if (still && shotHere && !battle.extract && !leash(unit) && !acid(unit) && !(wary && theirs(unit) > 0)) return []
  // A booming charge pins a unit that can fight from where it stands; a rooted one cannot move at all.
  if ((unit.booming > 0 && shotHere) || unit.rooted > 0 || (unit.kind === 'sprinter' && unit.chilled > 0)) return []
  // A carrier walks at half its move, as does an alien reeling from an ambush.
  const reeling = unit.pod !== null && battle.pods[unit.pod].reeling
  const full = Math.ceil(Math.max(0, unit.stats.move + (inAura(battle, unit, 'haste') ? HASTE_MOVE : 0) - (unit.chilled > 0 ? CHILL_MOVE : 0)) / (carrying(battle, unit) || reeling ? 2 : 1))
  // Unseen, a soldier creeps.
  // Unless it wears Ghost Weave.
  const move = unit.side === 'human' && battle.concealed && !has(unit, 'ghost') ? Math.ceil(full * CREEP) : full
  const path = choose(move)
  if (unit.ability === 'runAndGun' && !battle.concealed && mine(path.at(-1) ?? unit) === 0) return choose(2 * move)
  const end = path.at(-1) ?? unit
  const shot = enemies.some((e) => shootable(battle, unit, end, e, seen))
  if (unit.side === 'human' && shot && !battle.concealed && !setting && !battle.extract && !carrying(battle, unit)) battle.strides[unit.id] = move - costOf(battle, unit, path)
  if (unit.side !== 'human' || battle.concealed || setting || shot) return path
  // A soldier no alien can reach next turn dashes on to a shot, if one is within a dash.
  if (!battle.extract && !carrying(battle, unit) && threat(end) === 0) {
    const dash = choose(move + DASH_MOVE)
    if (enemies.some((e) => shootable(battle, unit, dash.at(-1) ?? unit, e, seen))) return dash
  }
  unit.order = orderFor(battle, unit, { wary, exposed: theirs(end) > 0, threatened: threat(end) > 0 })
  if (unit.order !== 'sprint') return path
  // Sprinting, it moves again; a sprint that gets it no nearer is no sprint.
  const far = choose(2 * move)
  const nearer = toGoal[(far.at(-1) ?? unit).y * GRID + (far.at(-1) ?? unit).x] < toGoal[end.y * GRID + end.x]
  if (!nearer) unit.order = null
  return nearer ? far : path
}

/**
 * The standard action a soldier with no shot takes in place of attacking, or none. One with an ability that needs no
 * shot, or a leap that would reach the aliens, keeps it. A wary soldier in an enemy's sights hunkers; one an enemy
 * could come within range of next turn prepares; any other sprints toward the fight, or for the way out.
 */
export function orderFor(battle: Battle, unit: Unit, { wary, exposed, threatened }: { wary: boolean; exposed: boolean; threatened: boolean }): Order | null {
  if (unit.charges > 0 && (unit.ability === 'medic' || unit.ability === 'mech')) return null
  if (leapTo(battle, unit)) return null
  // A carrier cannot sprint.
  if (battle.extract) return carrying(battle, unit) ? null : 'sprint'
  if (wary && exposed) return 'hunker'
  return threatened ? 'prepare' : 'sprint'
}

/** Where Heroic Leap would land: the free tile within twice the soldier's move beside the most foes, and those foes. */
export function leapTo(battle: Battle, unit: Unit): { to: Tile; caught: Unit[] } | null {
  if (!has(unit, 'leap') || unit.spent.includes('leap')) return null
  const all = foes(battle, unit)
  let best: { to: Tile; caught: Unit[] } | null = null
  for (const foe of all.filter((f) => distance(f, unit) <= 2 * unit.stats.move)) {
    for (const [dx, dy] of NEIGHBORS) {
      const to = { x: foe.x + dx, y: foe.y + dy }
      if (blocked(battle, to.x, to.y) || onTile(battle.acid, to) || onTile(battle.fire, to)) continue
      const caught = all.filter((f) => distance(f, to) <= 1)
      if (caught.length > (best?.caught.length ?? 0)) best = { to, caught }
    }
  }
  return best
}

/** Tiles from every alien a fleeing civilian counts safe. */
export const SAFE = 6

/** The most cover a prop beside `tile` gives: what a hider hides behind. */
export const hideout = (battle: Battle, tile: Tile) =>
  Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (onGrid(tile.x + dx, tile.y + dy) ? coverAt(battle, tile.x + dx, tile.y + dy) : 0)))

/** A civilian's path. A hider makes for the best cover in reach and stays there; a runner goes away from the nearest alien until SAFE from all, then toward the nearest soldier. */
export function fleePath(battle: Battle, unit: Unit): Tile[] {
  if (unit.civilian === 'vip') return battle.vip === 'freed' ? escapePath(battle, unit) : []
  if (unit.civilian === 'hider') return hideout(battle, unit) > 0 ? [] : bestPath(paths(battle, unit, unit.stats.move), unit, (end, steps) => [-hideout(battle, end), steps])
  const aliens = battle.units.filter((u) => u.side === 'alien')
  const soldier = nearest(battle.units.filter(isSoldier), unit)
  const toSquad = soldier ? walkingDistances(battle, soldier) : null
  return bestPath(paths(battle, unit, unit.stats.move), unit, (end) => [SAFE - Math.min(SAFE, ...aliens.map((a) => distance(a, end))), toSquad ? toSquad[end.y * GRID + end.x] : 0])
}

/** A freed VIP's path: toward the extraction zone, away from the aliens' shots and, while any is in sight, never beyond ESCORT_REACH of a soldier. */
export function escapePath(battle: Battle, unit: Unit): Tile[] {
  const toExtract = walkingDistances(battle, battle.extract!)
  const soldiers = battle.units.filter(isSoldier)
  const aliens = battle.units.filter((u) => u.side === 'alien' && revealed(battle, u))
  // With no alien left in sight it makes straight for the way out.
  return bestPath(paths(battle, unit, unit.stats.move), unit, (end) => [
    aliens.length > 0 ? Math.max(0, Math.min(...soldiers.map((s) => distance(s, end))) - ESCORT_REACH) : 0,
    toExtract[end.y * GRID + end.x] + Math.round(exposure(battle, aliens, end) / 10),
  ])
}

/** The path an alien takes while its pod is unaware: toward the pod's waypoint, slowly, unless it guards its post. */
export function patrolPath(battle: Battle, unit: Unit): Tile[] {
  if (battle.pods[unit.pod!].guard) return []
  const toWaypoint = walkingDistances(battle, battle.pods[unit.pod!].waypoint)
  return bestPath(paths(battle, unit, PATROL_MOVE), unit, (end) => [toWaypoint[end.y * GRID + end.x]])
}

/** The move a path costs, climbing costing more. */
export function costOf(battle: Battle, unit: Unit, path: Tile[]): number {
  return path.reduce((sum, tile, i) => sum + stepCost(battle, path[i - 1] ?? unit, tile), 0)
}

export function walk(unit: Unit, path: Tile[], events: GameEvent[]): void {
  const end = path.at(-1)
  if (!end) return
  unit.x = end.x
  unit.y = end.y
  unit.moved = true
  events.push({ type: 'move', id: unit.id, path })
}

/** Share of its move a soldier walks while the squad is unseen. */
export const CREEP = 0.6
/** Tiles further a soldier may dash in the fight to reach a shot. */
const DASH_MOVE = 3
