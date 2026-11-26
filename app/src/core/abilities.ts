// Actions in place of a shot: alien powers; and cloaking.
import { alienSrc } from './sources'
import { type Battle, type Unit, CLOAK_TURNS, SPIT_DAMAGE, ACID_TURNS, PSI_RANGE, PSI_COOLDOWN } from './battle'
import { distance } from './grid'
import type { GameEvent } from './combat-event'
import { nearest } from './fighters'
import { canShoot, lineOfSight } from './sight'
import { wound } from './wound'

/** Spit: the nearest unit the spitter can shoot is hit, and acid is left on its tile. */
export function spit(battle: Battle, unit: Unit): GameEvent[] {
  const target = nearest(
    battle.units.filter((u) => u.side !== unit.side && !u.cloaked && canShoot(battle, unit, u, unit.stats.range)),
    unit,
  )
  if (!target) return []
  const events: GameEvent[] = [{ type: 'spit', src: alienSrc(unit), id: unit.id, target: target.id, damage: SPIT_DAMAGE }]
  battle.acid = [...battle.acid.filter((pool) => pool.x !== target.x || pool.y !== target.y), { x: target.x, y: target.y, turns: ACID_TURNS }]
  wound(battle, target, SPIT_DAMAGE, events, unit.resists.includes('armor'))
  return events
}

/** Panic: when ready, the psion panics the soldier in reach and sight who hits hardest, not already panicked. */
export function panic(battle: Battle, unit: Unit): GameEvent[] {
  if (unit.cooldown > 0) return []
  const targets = battle.units.filter((u) => u.side !== unit.side && !u.cloaked && !u.panicked && distance(unit, u) <= PSI_RANGE && lineOfSight(battle, unit, u))
  const target = targets.reduce<Unit | undefined>((best, u) => (!best || u.stats.damage > best.stats.damage ? u : best), undefined)
  if (!target) return []
  target.panicked = true
  unit.cooldown = PSI_COOLDOWN
  return [{ type: 'panic', src: alienSrc(unit), id: unit.id, target: target.id }]
}

/** What an alien does in place of a shot, by its kind; empty if it shoots, or has nothing to do. */
export function alienAction(battle: Battle, unit: Unit): GameEvent[] | null {
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

/** Each feeder in sight grows on a trick the hero's unit used in `events`: its ability or a once-per-battle effect. */
export function feed(battle: Battle, unit: Unit, events: GameEvent[]): GameEvent[] {
  const tricked = events.some((e) => (e.type === 'rocket' || e.type === 'heal' || e.type === 'spawn' || (e.type === 'effect' && e.amount >= 0)) && e.id === unit.id)
  if (!tricked) return []
  return battle.units
    .filter((u) => u.kind === 'feeder' && u.revealed)
    .map((u) => {
      u.might++
      return { type: 'feed', src: alienSrc(u), id: u.id, damage: u.might }
    })
}

/** Cloaks a unit for CLOAK_TURNS. */
export function cloakOn(unit: Unit): GameEvent {
  unit.cloaked = CLOAK_TURNS
  return { type: 'cloak', id: unit.id, on: true }
}
