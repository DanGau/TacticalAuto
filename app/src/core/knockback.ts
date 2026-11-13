// Driving a unit back, and what it hits or falls from: a ledge, a window, or the edge of the world.
import { fx, srcOf } from './sources'
import { GRID, type Battle, type Effect, type Tile, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { blocked, CLIFF, edgeBetween, freeTilesNear, heightAt, onGrid, openNear, unitAt, unwalled, walks } from './grid'
import { has } from './fighters'
import { SLAM_DAMAGE, wound } from './wound'
import { fell, slammed } from './stacks'

/** Damage a fall beyond the unit's jump does for each level dropped; what one over the edge does to a hero or a boss, which catches the edge. Any other alien is lost. */
export const FALL_DAMAGE = 2
export const EDGE_DAMAGE = 6

/** Whether `to` is the drop: off the map or void. */
export const isDrop = (battle: Battle, to: Tile) => !onGrid(to.x, to.y) || battle.ground[to.y * GRID + to.x] === 'void'

/** What lies past `from` toward `to` for a unit driven that way: the drop, levels down a ledge, or 0 for neither. A wall bars both; glass breaks. */
export function fallBeyond(battle: Battle, from: Tile, to: Tile): 'drop' | number {
  const pane = (from.x === to.x || from.y === to.y) && onGrid(to.x, to.y) && edgeBetween(battle, from, to) === 'window'
  if (onGrid(to.x, to.y) && !unwalled(battle, from, to) && !pane) return 0
  if (isDrop(battle, to)) return 'drop'
  const down = heightAt(battle, from) - heightAt(battle, to)
  return down >= CLIFF ? down : 0
}

/** The ways back from `from` a knockback may drive `target`: straight back, or a step to either side of it. */
function ways(from: Tile, target: Tile): Tile[] {
  const i = COMPASS.findIndex(([dx, dy]) => dx === Math.sign(target.x - from.x) && dy === Math.sign(target.y - from.y))
  return i < 0 ? [] : [i, i + 1, i + 7].map((k) => ({ x: COMPASS[k % 8][0], y: COMPASS[k % 8][1] }))
}

/** The eight headings in turn round the compass. */
const COMPASS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]

/** Damage a fall of `levels` does `unit`: none within its jump, which it lands. */
export const fallDamage = (unit: Unit, levels: number) => (levels > unit.stats.jump ? FALL_DAMAGE * levels : 0)

/** Whether `target`, driven a tile along `step`, is hurt off a ledge or lost over the edge. */
const fellsAlong = (battle: Battle, target: Unit, step: Tile) => {
  const beyond = fallBeyond(battle, target, { x: target.x + step.x, y: target.y + step.y })
  if (beyond === 0 || has(target, 'hover')) return false
  return beyond === 'drop' ? !target.boss : fallDamage(target, beyond) > 0
}

/** The way a knockback from `from` drives `target`: of straight back and a step to either side, one that sends it off a ledge hurt or over the edge if any does, else straight back. */
export const knockWay = (battle: Battle, from: Tile, target: Unit): Tile | undefined => {
  const options = ways(from, target)
  return options.find((step) => fellsAlong(battle, target, step)) ?? options[0]
}

/** Whether a knockback from `from` sends `target` off a ledge hurt, or over the edge to be lost. */
export function pushesOff(battle: Battle, from: Tile, target: Unit): boolean {
  const step = knockWay(battle, from, target)
  return !!step && fellsAlong(battle, target, step)
}

/** Strength from which an alien's blow knocks a hero back anyway, and from which any shove drives a second tile. */
export const HEAVY = 4
export const MIGHTY = 5

/**
 * A hero's hit on an alien standing at a ledge or the edge knocks it off, as an alien's blow from beside does a hero;
 * a HEAVY alien's blow knocks a hero back anyway. A MIGHTY one's shove drives 2 tiles.
 */
export function shoveOff(battle: Battle, unit: Unit, target: Unit, events: GameEvent[]): void {
  if (target.civilian) return
  const reaches = unit.side === 'human' || Math.max(Math.abs(unit.x - target.x), Math.abs(unit.y - target.y)) <= 1
  const tiles = unit.stats.strength >= MIGHTY ? 2 : 1
  if ((reaches && pushesOff(battle, unit, target)) || (target.side === 'human' && unit.stats.strength >= HEAVY)) knockback(battle, unit, target, events, 1, tiles, SLAM_DAMAGE, 'shove')
}

/** Breaks the glass between neighbouring tiles, if any. */
function shatter(battle: Battle, from: Tile, to: Tile): void {
  if (!onGrid(to.x, to.y) || (from.x !== to.x && from.y !== to.y) || edgeBetween(battle, from, to) !== 'window') return
  if (from.y === to.y) battle.west[from.y * GRID + Math.max(from.x, to.x)] = 'none'
  else battle.north[Math.max(from.y, to.y) * GRID + from.x] = 'none'
  walks.delete(battle)
}

/**
 * `unit`, standing on `from`, goes over toward `to`. Over the edge, a hero or a boss catches it and takes EDGE_DAMAGE,
 * and any other alien is lost; one that hovers stays where it is. Off a ledge it lands below, hurt by fallDamage, as
 * is whoever stands there, and lands beside them. A fall ignores armor.
 */
export function fall(battle: Battle, unit: Unit, from: Tile, to: Tile, events: GameEvent[]): void {
  const beyond = fallBeyond(battle, from, to)
  if (beyond === 0) return
  shatter(battle, from, to)
  if (has(unit, 'hover')) return void events.push(fx(unit.id, 'hover', 0))
  if (beyond === 'drop') {
    const caught = unit.side === 'human' || unit.boss
    const event: Extract<GameEvent, { type: 'fall' }> = { type: 'fall', id: unit.id, to, drop: 'edge', damage: caught ? EDGE_DAMAGE : unit.hp }
    events.push(event)
    fell(battle, unit, 0, events)
    if (caught) return void wound(battle, unit, EDGE_DAMAGE, events, true)
    unit.x = to.x
    unit.y = to.y
    wound(battle, unit, unit.hp + unit.armor + (unit.temp ?? 0), events, true, true)
    // One that cannot be hurt climbs back.
    if (unit.hp > 0) Object.assign(unit, from)
    event.fatal = unit.hp <= 0 || undefined
    return
  }
  const under = unitAt(battle, to.x, to.y)
  const land = under || blocked(battle, to.x, to.y) ? (freeTilesNear(battle, to, 1)[0] ?? from) : to
  const fallen = fallDamage(unit, beyond)
  const damage = fallen + (fallen > 0 ? fell(battle, unit, beyond, events) : 0)
  const event: Extract<GameEvent, { type: 'fall' }> = { type: 'fall', id: unit.id, to: land, drop: beyond, damage, onto: under?.id }
  events.push(event)
  unit.x = land.x
  unit.y = land.y
  if (damage > 0) wound(battle, unit, damage, events, true)
  if (under && damage > 0) wound(battle, under, damage, events, true)
  event.fatal = unit.hp <= 0 || undefined
}

/**
 * A knockback: the target is driven `tiles` back from `unit`, straight or a step aside toward a drop; see knockWay. Driven off a ledge or over the edge, it falls;
 * if something else stops it, it slams into that for `slam` damage, and an alien it slams into takes as much. With
 * `way` -1, a tethered hit pulls it a tile toward the shooter, as far as the way is free.
 */
export function knockback(battle: Battle, unit: Unit, target: Unit, events: GameEvent[], way = 1, tiles = 1, slam = SLAM_DAMAGE, effect: Effect = way > 0 ? 'thunder' : 'tether'): void {
  const back = way > 0 ? knockWay(battle, unit, target) : undefined
  const step = back ?? { x: way * Math.sign(target.x - unit.x), y: way * Math.sign(target.y - unit.y) }
  drive(battle, target, step, tiles, events, way > 0 ? slam : 0, effect)
}

/** Whether a knockback from `unit` drives `target` into something or off a ledge within `tiles`. */
export function knocksInto(battle: Battle, unit: Tile, target: Unit, tiles = 1): boolean {
  const step = knockWay(battle, unit, target)
  if (!step) return false
  let from: Tile = target
  for (let i = 0; i < tiles; i++) {
    const to = { x: from.x + step.x, y: from.y + step.y }
    if (fallBeyond(battle, from, to) !== 0 || blocked(battle, to.x, to.y) || !unwalled(battle, from, to) || heightAt(battle, to) - heightAt(battle, from) >= CLIFF) return true
    from = to
  }
  return false
}

/** Drives `target` up to `tiles` along `step`; see knockback. Returns whether it fell. */
export function drive(battle: Battle, target: Unit, step: Tile, tiles: number, events: GameEvent[], slam: number, effect: Effect): boolean {
  const path: Tile[] = []
  let over: Tile | null = null
  let stopped = false
  for (let i = 0; i < tiles && !stopped && !over; i++) {
    const from = path.at(-1) ?? target
    const to = { x: from.x + step.x, y: from.y + step.y }
    if (fallBeyond(battle, from, to) !== 0) over = to
    else if (blocked(battle, to.x, to.y) || !unwalled(battle, from, to) || heightAt(battle, to) - heightAt(battle, from) >= CLIFF) stopped = true
    else path.push(to)
  }
  const start = { x: target.x, y: target.y }
  const end = path.at(-1)
  if (end) {
    target.x = end.x
    target.y = end.y
    events.push({ type: 'move', src: srcOf(effect), id: target.id, path, with: effect })
  }
  if (over) {
    fall(battle, target, end ?? start, over, events)
    return true
  }
  if (!stopped || slam === 0) return false
  const into = unitAt(battle, target.x + step.x, target.y + step.y)
  events.push(fx(target.id, effect, -slam))
  wound(battle, target, slam, events)
  slammed(battle, target, events)
  if (into && into.side === target.side) {
    events.push(fx(into.id, effect, -slam))
    wound(battle, into, slam, events)
    if (into.hp > 0 && into.side === 'alien' && dominoes(battle)) drive(battle, into, step, 1, events, slam, 'domino')
  }
  return false
}

/** Whether the acting hero's knockbacks knock on, by Domino Rig. */
const dominoes = (battle: Battle) => battle.units.some((u) => u.id === battle.actor && u.side === 'human' && has(u, 'domino'))

/** A unit over the void that no longer levitates drifts to the nearest open ground, unhurt. */
export function settle(battle: Battle, unit: Unit): GameEvent[] {
  if (has(unit, 'hover') || !isDrop(battle, unit)) return []
  const to = openNear(battle, unit)
  Object.assign(unit, to)
  return [{ type: 'move', src: srcOf('hover'), id: unit.id, path: [to], with: 'hover' }]
}
