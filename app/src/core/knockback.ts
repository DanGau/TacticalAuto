// Driving a unit back, and what it hits or falls from: a ledge, a window, or the edge of the world.
import { GRID, type Battle, type Effect, type Tile, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { blocked, CLIFF, edgeBetween, freeTilesNear, heightAt, onGrid, unitAt, unwalled, walks } from './grid'
import { has } from './fighters'
import { SLAM_DAMAGE, wound } from './wound'

/** Damage a fall does for each level dropped; what one over the edge does to a hero or a boss, which catches the edge. Any other alien is lost. */
export const FALL_DAMAGE = 2
export const EDGE_DAMAGE = 6

/** Effects that knock a target back, which heroes aim at a ledge. */
export const KNOCKS: Effect[] = ['thunder', 'hurl', 'repulse', 'shove']

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

/** Whether knocking `target` a tile straight back from `from` sends it off a ledge, or over the edge to be lost. */
export function pushesOff(battle: Battle, from: Tile, target: Unit): boolean {
  const beyond = fallBeyond(battle, target, { x: target.x + Math.sign(target.x - from.x), y: target.y + Math.sign(target.y - from.y) })
  return beyond !== 0 && !(beyond === 'drop' && target.boss) && !has(target, 'hover')
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
 * and any other alien is lost; one that hovers stays where it is. Off a ledge it lands below, FALL_DAMAGE a level, on
 * whoever stands there too, and lands beside them. A fall ignores armor.
 */
export function fall(battle: Battle, unit: Unit, from: Tile, to: Tile, events: GameEvent[]): void {
  const beyond = fallBeyond(battle, from, to)
  if (beyond === 0) return
  shatter(battle, from, to)
  if (has(unit, 'hover')) return void events.push({ type: 'effect', id: unit.id, effect: 'hover', amount: 0 })
  if (beyond === 'drop') {
    const caught = unit.side === 'human' || unit.boss
    const event: Extract<GameEvent, { type: 'fall' }> = { type: 'fall', id: unit.id, to, drop: 'edge', damage: caught ? EDGE_DAMAGE : unit.hp }
    events.push(event)
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
  const damage = FALL_DAMAGE * beyond
  const event: Extract<GameEvent, { type: 'fall' }> = { type: 'fall', id: unit.id, to: land, drop: beyond, damage, onto: under?.id }
  events.push(event)
  unit.x = land.x
  unit.y = land.y
  wound(battle, unit, damage, events, true)
  if (under) wound(battle, under, damage, events, true)
  event.fatal = unit.hp <= 0 || undefined
}

/**
 * A knockback: the target is driven `tiles` straight back from `unit`. Driven off a ledge or over the edge, it falls;
 * if something else stops it, it slams into that for `slam` damage, and an alien it slams into takes as much. With
 * `way` -1, a tethered hit pulls it a tile toward the shooter, as far as the way is free.
 */
export function knockback(battle: Battle, unit: Unit, target: Unit, events: GameEvent[], way = 1, tiles = 1, slam = SLAM_DAMAGE, effect: Effect = way > 0 ? 'thunder' : 'tether'): void {
  const step = { x: way * Math.sign(target.x - unit.x), y: way * Math.sign(target.y - unit.y) }
  drive(battle, target, step, tiles, events, way > 0 ? slam : 0, effect)
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
    events.push({ type: 'move', id: target.id, path, with: effect })
  }
  if (over) {
    fall(battle, target, end ?? start, over, events)
    return true
  }
  if (!stopped || slam === 0) return false
  const into = unitAt(battle, target.x + step.x, target.y + step.y)
  events.push({ type: 'effect', id: target.id, effect, amount: -slam })
  wound(battle, target, slam, events)
  if (into && into.side === target.side) {
    events.push({ type: 'effect', id: into.id, effect, amount: -slam })
    wound(battle, into, slam, events)
  }
  return false
}
