// What heroes do with the objects about them: hurl what stands beside them, and set off fuel tanks among the aliens.
import { GRID, isSoldier, type Battle, type Tile, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { foes } from './fighters'
import { distance, NEIGHBORS, onGrid, wreck } from './grid'
import { canShoot } from './sight'
import type { Prop } from './terrain'
import { FUEL_DAMAGE } from './twists'
import { wound } from './wound'

/** What a hero can pick up and hurl. */
const HURLABLE = new Set<Prop>(['car', 'truck', 'tree', 'crate', 'stack', 'rubble', 'growth'])

/** Objects a hero uses in a battle, how far it hurls one, and the damage to the alien struck and each beside it. */
export const OBJECT_USES = 3
export const HURL_RANGE = 5
export const THROW_DAMAGE = 4

const usesLeft = (unit: Unit) => unit.spent.filter((e) => e === 'throw').length < OBJECT_USES

/** The tiles beside `at` holding something a hero can hurl. */
const hurlables = (battle: Battle, at: Tile) => NEIGHBORS.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })).filter((t) => onGrid(t.x, t.y) && HURLABLE.has(battle.props[t.y * GRID + t.x]))

/** Whether a hero standing on `at` could hurl something, for it to weigh the tile. */
export const canHurlFrom = (battle: Battle, unit: Unit, at: Tile) => isSoldier(unit) && usesLeft(unit) && hurlables(battle, at).length > 0

function strike(battle: Battle, unit: Unit, at: Tile, caught: Unit[], damage: number, label: string, events: GameEvent[]): void {
  unit.spent.push('throw')
  events.push({ type: 'rocket', id: unit.id, x: at.x, y: at.y, hits: caught.map((u) => ({ target: u.id, damage })), label })
  for (const alien of caught) wound(battle, alien, damage, events)
}

/** In place of a soldier's attack: sets off a fuel tank it can shoot with aliens beside it and no human; else hurls what stands beside it at the alien with the most others about it. */
export function leverage(battle: Battle, unit: Unit): GameEvent[] {
  if (!isSoldier(unit) || !usesLeft(unit)) return []
  const aliens = foes(battle, unit)
  const events: GameEvent[] = []
  const beside = (t: Tile, reach: number) => aliens.filter((a) => distance(a, t) <= reach)
  for (let t = 0; t < GRID * GRID; t++) {
    if (battle.props[t] !== 'fuel') continue
    const tank = { x: t % GRID, y: Math.floor(t / GRID) }
    if (distance(tank, unit) > unit.stats.range || !canShoot(battle, unit, tank, unit.stats.range) || beside(tank, 1).length === 0) continue
    if (battle.units.some((u) => u.side === 'human' && distance(u, tank) <= 1)) continue
    strike(battle, unit, tank, beside(tank, 1), FUEL_DAMAGE, 'TANK', events)
    wreck(battle, tank, 0)
    return events
  }
  const [object] = hurlables(battle, unit)
  if (!object) return []
  const targets = aliens.filter((a) => canShoot(battle, unit, a, HURL_RANGE)).sort((a, b) => beside(b, 1).length - beside(a, 1).length || distance(a, unit) - distance(b, unit))
  if (targets.length === 0) return []
  strike(battle, unit, targets[0], beside(targets[0], 1), THROW_DAMAGE, 'HURLED', events)
  wreck(battle, object, 0)
  return events
}
