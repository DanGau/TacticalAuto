// What a hero's turn can set off beyond its own attacks: Command's ally attack, Blade Dance's extra strikes.
import { shoot, weaponAttack } from './attack'
import { isSoldier, type Battle, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { aiming, has, shootable } from './fighters'
import { FAN_TARGETS } from './keystones'
import type { Secondary } from './secondaries'
import { pinced, pincerOn } from './duo-effects'

/** Pincer: the Phantom strikes the alien the Vanguard last hit, once a round. */
export function pincer(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  const on = pincerOn(battle, unit)
  if (!on) return []
  const actor = battle.actor
  battle.actor = on.pair[1].id
  const events = weaponAttack(battle, on.pair[1], seen, 'pincer', on.target)
  battle.actor = actor
  return events.length > 0 ? [pinced(battle, on.pair, on.target), ...events] : []
}

/** Command: after a hero acts, the squadmate hitting hardest that has a shot makes an attack with its weapon. */
export function command(battle: Battle, unit: Unit, seen: Set<number>): GameEvent[] {
  if (!has(unit, 'command')) return []
  const mates = battle.units.filter((u) => isSoldier(u) && u !== unit && u.hp > 0).sort((a, b) => b.stats.damage - a.stats.damage)
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
