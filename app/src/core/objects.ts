// What heroes do with the objects about them: the strong throw what stands beside them, or a small alien, and anyone sets off fuel tanks among the aliens.
import { ALIENS } from './aliens'
import { GRID, isSoldier, type Battle, type Tile, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { foes } from './fighters'
import { blocked, CLIFF, distance, NEIGHBORS, onGrid, passable, walks, wreck } from './grid'
import { drive, fall, FALL_DAMAGE, isDrop, pushesOff } from './knockback'
import { canShoot, lineOfSight } from './sight'
import type { Prop } from './terrain'
import { FUEL_DAMAGE } from './twists'
import { RIG } from './utilities'
import { SLAM_DAMAGE, wound } from './wound'

/** What a hero can pick up and throw. */
const HURLABLE = new Set<Prop>(['car', 'truck', 'tree', 'crate', 'stack', 'rubble', 'growth', 'wreck'])

/** Objects or aliens a hero throws in a battle, how far, and the damage to each alien struck. */
export const OBJECT_USES = 3
export const HURL_RANGE = 5
export const THROW_DAMAGE = 4

/** What a throw is worth, in aliens struck, for each alien it sends off a ledge or over the edge. */
const FALL_WORTH = 3

/** Who is strong enough to throw: a Vanguard, a Powerhouse, or any hero with a hammer or fists. */
export const strong = (unit: Unit) => isSoldier(unit) && (unit.ability === 'runAndGun' || unit.ability === 'rocket' || unit.weapon === 'hammer' || unit.weapon === 'fists')

const usesLeft = (unit: Unit) => unit.spent.filter((e) => e === 'throw').length < OBJECT_USES

/** A small alien, light enough to throw: no boss, commander or still thing. */
export const throwable = (unit: Unit) => unit.side === 'alien' && !!unit.kind && ALIENS[unit.kind].danger === 'small' && !unit.boss && !unit.target && unit.stats.move > 0

/** The tiles beside `at` holding something a hero can throw. */
const hurlables = (battle: Battle, at: Tile) => NEIGHBORS.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })).filter((t) => onGrid(t.x, t.y) && HURLABLE.has(battle.props[t.y * GRID + t.x]))

/** Whether a hero standing on `at` could throw something, for it to weigh the tile. */
export const canHurlFrom = (battle: Battle, unit: Unit, at: Tile) => strong(unit) && usesLeft(unit) && hurlables(battle, at).length > 0

const away = (from: Tile, to: Tile): Tile => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) })


/** The fuel tanks standing in the arena, nearest the way in first: what a rigged tank is picked from. */
export function fuelTanks(battle: Battle): Tile[] {
  const tanks: Tile[] = []
  for (let t = 0; t < GRID * GRID; t++) {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    if (battle.props[t] === 'fuel' && distance(tile, battle.arena) <= battle.arena.reach) tanks.push(tile)
  }
  return tanks.sort((a, b) => distance(a, battle.approach) - distance(b, battle.approach))
}

/** The rigged tank blows once aliens crowd it, catching them and any hero close by. */
export function blowRigged(battle: Battle): GameEvent[] {
  const tank = battle.rigged
  if (!tank) return []
  if (battle.props[tank.y * GRID + tank.x] !== 'fuel') {
    battle.rigged = null
    return []
  }
  const aliens = battle.units.filter((u) => u.side === 'alien' && u.revealed)
  if (aliens.filter((a) => distance(a, tank) <= RIG.near).length < RIG.crowd) return []
  battle.rigged = null
  const caught = battle.units.filter((u) => distance(u, tank) <= (u.side === 'alien' ? RIG.radius : RIG.close))
  const events: GameEvent[] = [{ type: 'rocket', id: aliens[0].id, x: tank.x, y: tank.y, hits: caught.map((u) => ({ target: u.id, damage: RIG.damage })), label: 'RIGGED' }]
  wreck(battle, tank, 1)
  for (let y = tank.y - RIG.fireReach; y <= tank.y + RIG.fireReach; y++) for (let x = tank.x - RIG.fireReach; x <= tank.x + RIG.fireReach; x++) if (onGrid(x, y) && !['void', 'water'].includes(battle.ground[y * GRID + x])) battle.fire.push({ x, y, turns: RIG.fireTurns })
  for (const unit of caught) wound(battle, unit, RIG.damage, events)
  return events
}

/** A throw a hero could make: what it is worth, and making it. */
interface Throw {
  worth: number
  make: (events: GameEvent[]) => void
}

/** Throwing the object on `from` at `target`: it and each alien beside it take THROW_DAMAGE and are knocked away from where it lands. A car leaves a wreck. */
function objectThrow(battle: Battle, unit: Unit, from: Tile, target: Unit, aliens: Unit[]): Throw {
  const struck = aliens.filter((a) => distance(a, target) <= 1)
  const push = (a: Unit) => (a === target ? away(unit, target) : away(target, a))
  const worth = struck.length + FALL_WORTH * struck.filter((a) => pushesOff(battle, { x: a.x - push(a).x, y: a.y - push(a).y }, a)).length
  return {
    worth,
    make: (events) => {
      const prop = battle.props[from.y * GRID + from.x]
      battle.props[from.y * GRID + from.x] = 'none'
      battle.bulk[from.y * GRID + from.x] = 0
      walks.delete(battle)
      events.push({ type: 'throw', id: unit.id, from, to: { x: target.x, y: target.y }, object: prop, hits: struck.map((a) => ({ target: a.id, damage: THROW_DAMAGE })) })
      for (const alien of struck) {
        wound(battle, alien, THROW_DAMAGE, events)
        if (alien.hp > 0) drive(battle, alien, push(alien), 1, events, SLAM_DAMAGE, 'hurl')
      }
      if (prop !== 'car' && prop !== 'truck') return
      // A wreck stands only clear of anything else solid, so it walls no way off.
      const clear = (t: Tile) => !blocked(battle, t.x, t.y) && NEIGHBORS.every(([dx, dy]) => onGrid(t.x + dx, t.y + dy) && battle.bulk[(t.y + dy) * GRID + t.x + dx] === 0)
      const spot = [{ x: target.x, y: target.y }, ...NEIGHBORS.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy }))].find((t) => clear(t) && (t.x === target.x && t.y === target.y ? true : passable(battle, target, t)))
      if (!spot) return
      battle.props[spot.y * GRID + spot.x] = 'wreck'
      battle.bulk[spot.y * GRID + spot.x] = 1
      walks.delete(battle)
    },
  }
}

/** Throwing the small alien `held` onto `to`: over the edge or off a ledge it falls; onto another alien, both take THROW_DAMAGE. */
function alienThrow(battle: Battle, unit: Unit, held: Unit, to: Tile, aliens: Unit[]): Throw {
  const drop = isDrop(battle, to)
  const below = drop ? 0 : battle.height[unit.y * GRID + unit.x] - battle.height[to.y * GRID + to.x]
  const onto = aliens.find((a) => a !== held && a.x === to.x && a.y === to.y)
  const worth = drop ? FALL_WORTH + 2 : onto ? 2 + (below >= 2 ? 1 : 0) : below >= 2 ? FALL_WORTH : 0
  return {
    worth,
    make: (events) => {
      // Out over the edge, from the last ground on the way.
      const step = away(unit, to)
      let edge: Tile = { x: unit.x, y: unit.y }
      while (drop && !isDrop(battle, { x: edge.x + step.x, y: edge.y + step.y }) && distance(edge, to) > 1) edge = { x: edge.x + step.x, y: edge.y + step.y }
      const lands = drop ? edge : onto ? (NEIGHBORS.map(([dx, dy]) => ({ x: to.x + dx, y: to.y + dy })).find((t) => !blocked(battle, t.x, t.y) && !isDrop(battle, t)) ?? { x: unit.x, y: unit.y }) : to
      const damage = THROW_DAMAGE + (below >= CLIFF ? FALL_DAMAGE * below : 0)
      events.push({ type: 'throw', id: unit.id, from: { x: held.x, y: held.y }, to: lands, object: 'alien', thrown: held.id, hits: drop ? [] : [held, ...(onto ? [onto] : [])].map((a) => ({ target: a.id, damage: a === held ? damage : THROW_DAMAGE })) })
      Object.assign(held, lands)
      if (drop) return fall(battle, held, edge, to, events)
      wound(battle, held, damage, events)
      if (onto) wound(battle, onto, THROW_DAMAGE, events)
    },
  }
}

/** The best throw `unit` could make now, if any is worth making: one that fells an alien, or strikes two. */
function bestThrow(battle: Battle, unit: Unit): Throw | null {
  const aliens = foes(battle, unit)
  const options: Throw[] = []
  const [object] = hurlables(battle, unit)
  if (object) for (const target of aliens) if (canShoot(battle, unit, target, HURL_RANGE)) options.push(objectThrow(battle, unit, object, target, aliens))
  for (const held of aliens.filter((a) => throwable(a) && distance(a, unit) === 1 && a.hp > 0)) {
    for (let y = unit.y - HURL_RANGE; y <= unit.y + HURL_RANGE; y++)
      for (let x = unit.x - HURL_RANGE; x <= unit.x + HURL_RANGE; x++) {
        const to = { x, y }
        if (!onGrid(x, y) || (x === held.x && y === held.y) || (x === unit.x && y === unit.y) || !lineOfSight(battle, unit, to)) continue
        if (!isDrop(battle, to) && blocked(battle, x, y) && !aliens.some((a) => a.x === x && a.y === y)) continue
        options.push(alienThrow(battle, unit, held, to, aliens))
      }
  }
  const best = options.reduce<Throw | null>((a, b) => (!a || b.worth > a.worth ? b : a), null)
  return best && best.worth >= 2 ? best : null
}

/** In place of a soldier's attack: sets off a fuel tank it can shoot with aliens beside it and no human; else, if strong, makes the best throw worth making. */
export function leverage(battle: Battle, unit: Unit): GameEvent[] {
  if (!isSoldier(unit) || !usesLeft(unit)) return []
  const aliens = foes(battle, unit)
  const events: GameEvent[] = []
  const beside = (t: Tile, reach: number) => aliens.filter((a) => distance(a, t) <= reach)
  for (let t = 0; t < GRID * GRID; t++) {
    if (battle.props[t] !== 'fuel') continue
    const tank = { x: t % GRID, y: Math.floor(t / GRID) }
    if (battle.rigged?.x === tank.x && battle.rigged.y === tank.y) continue
    if (distance(tank, unit) > unit.stats.range || !canShoot(battle, unit, tank, unit.stats.range) || beside(tank, 1).length === 0) continue
    if (battle.units.some((u) => u.side === 'human' && distance(u, tank) <= 1)) continue
    unit.spent.push('throw')
    const caught = beside(tank, 1)
    events.push({ type: 'rocket', id: unit.id, x: tank.x, y: tank.y, hits: caught.map((u) => ({ target: u.id, damage: FUEL_DAMAGE })), label: 'TANK' })
    for (const alien of caught) wound(battle, alien, FUEL_DAMAGE, events)
    wreck(battle, tank, 0)
    return events
  }
  if (!strong(unit)) return []
  const chosen = bestThrow(battle, unit)
  if (!chosen) return []
  unit.spent.push('throw')
  chosen.make(events)
  return events
}
