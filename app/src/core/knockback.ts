// Driving a unit back, and what it hits.
import type { Battle, Effect, Tile, Unit } from './battle'
import type { GameEvent } from './combat-event'
import { blocked, passable, unitAt } from './grid'
import { SLAM_DAMAGE, wound } from './wound'

/**
 * A knockback: the target is driven `tiles` straight back from `unit`; if something stops it, it slams into that for
 * `slam` damage, and an alien it slams into takes as much. With `way` -1, a tethered hit pulls it a tile toward the
 * shooter, as far as the way is free.
 */
export function knockback(battle: Battle, unit: Unit, target: Unit, events: GameEvent[], way = 1, tiles = 1, slam = SLAM_DAMAGE, effect: Effect = way > 0 ? 'thunder' : 'tether'): void {
  const step = { x: way * Math.sign(target.x - unit.x), y: way * Math.sign(target.y - unit.y) }
  const path: Tile[] = []
  let stopped = false
  for (let i = 0; i < tiles && !stopped; i++) {
    const from = path.at(-1) ?? target
    const to = { x: from.x + step.x, y: from.y + step.y }
    stopped = blocked(battle, to.x, to.y) || !passable(battle, from, to)
    if (!stopped) path.push(to)
  }
  const end = path.at(-1)
  if (end) {
    target.x = end.x
    target.y = end.y
    events.push({ type: 'move', id: target.id, path, with: effect })
  }
  if (!stopped || way < 0) return
  const into = unitAt(battle, target.x + step.x, target.y + step.y)
  events.push({ type: 'effect', id: target.id, effect, amount: -slam })
  wound(battle, target, slam, events)
  if (into && into.side === target.side) {
    events.push({ type: 'effect', id: into.id, effect, amount: -slam })
    wound(battle, into, slam, events)
  }
}
