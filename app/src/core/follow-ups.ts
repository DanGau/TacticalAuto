// What a hero's turn can set off beyond its own attacks: Command's second attack, Blade Dance's extra strikes.
import { shoot, weaponAttack } from './attack'
import { type Battle, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { aiming, has, shootable } from './fighters'
import { FAN_TARGETS } from './keystones'
import type { Secondary } from './secondaries'

/** Command: after a hero acts, it attacks again with its weapon. */
export function command(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  return has(unit, 'command') ? weaponAttack(battle, unit, seen, 'command') : []
}

/** Blade Dance: a bonus attack that landed, `first`, goes on to strike more aliens in its reach. */
export function bladeDance(battle: Battle, unit: Unit, seen: Set<number>, secondary: Secondary, first: GameEvent[]): GameEvent[] {
  if (!has(unit, 'bladeDance') || unit.hp <= 0) return []
  const struck = new Set(first.flatMap((e) => (e.type === 'shot' ? [e.target] : [])))
  const aim = aiming(unit, secondary)
  const events: GameEvent[] = []
  for (let i = 0; i < FAN_TARGETS; i++) {
    const next = battle.units.find((u) => u.side !== unit.side && u.hp > 0 && !struck.has(u.id) && shootable(battle, aim, unit, u, seen))
    if (!next) break
    struck.add(next.id)
    events.push(...shoot(battle, unit, seen, 'bladeDance', next, secondary))
  }
  return events
}
