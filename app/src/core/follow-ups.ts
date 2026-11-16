// What a hero's turn can set off beyond its own attacks: Command's ally attack, Blade Dance's extra strikes.
import { shoot, weaponAttack } from './attack'
import { type Battle, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { aiming, has, shootable } from './fighters'
import { FAN_TARGETS } from './keystones'
import type { Secondary } from './secondaries'

/** Command: after a hero acts, the ally hitting hardest that has a shot makes an attack with its weapon; with none, the hero does. */
export function command(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (!has(unit, 'command')) return []
  const allies = battle.units.filter((u) => u.side === unit.side && u !== unit && u.hp > 0 && !u.civilian).sort((a, b) => b.stats.damage - a.stats.damage)
  const mates = [...allies, unit]
  const actor = battle.actor
  for (const mate of mates) {
    battle.actor = mate.id
    const events = weaponAttack(battle, mate, seen, 'command')
    if (events.length > 0) {
      battle.actor = actor
      return events
    }
  }
  battle.actor = actor
  return []
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
