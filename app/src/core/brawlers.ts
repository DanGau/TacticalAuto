// The rules of aliens that fight up close: a brute's charge, a leaper's pounce, a vise's hold, a dreadhorn's ram, an aegis's shield, a kinhound's pack and a zealot's fury.
import { GRID, isSoldier, type Battle, type Tile, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { blocked, distance, freeTilesNear, walkingDistances } from './grid'
import { bestPath, paths, walk } from './pathing'
import { PACK_MAX, POUNCE_REACH, RAM_DAMAGE } from './aliens'

/** A hero's turns a vise's hold lasts: rooting wears off a turn as its side's turn begins. */
const HOLD_TURNS = 2

/** A brute that survives a hit charges: it moves at once as near the shooter as its move allows. */
export function charge(battle: Battle, brute: Unit, shooter: Unit, events: GameEvent[]): void {
  const toShooter = walkingDistances(battle, shooter, brute.stats.jump)
  walk(battle, brute, bestPath(paths(battle, brute, brute.stats.move), brute, (end) => [toShooter[end.y * GRID + end.x]]), events)
}

/** The hero a leaper pounces on: of those in reach, the one that shoots farthest, the nearest among equals. */
export function prey(battle: Battle, leaper: Unit): Unit | undefined {
  const heroes = battle.units.filter((u) => isSoldier(u) && distance(u, leaper) <= POUNCE_REACH)
  return heroes.sort((a, b) => b.stats.range - a.stats.range || distance(a, leaper) - distance(b, leaper))[0]
}

/** A leaper's one pounce, over walls and heights, onto a free tile beside its prey; [] once spent or with none in reach. */
export function pounce(battle: Battle, leaper: Unit): Tile[] {
  const target = leaper.kind === 'leaper' && !leaper.spent.includes('leap') ? prey(battle, leaper) : undefined
  const to = target && freeTilesNear(battle, target, 1).find((t) => distance(t, target) <= 1 && !blocked(battle, t.x, t.y))
  if (!to) return []
  leaper.spent.push('leap')
  return [to]
}

/** Whether an aegis's shield turns `attacker`'s hit: it does unless the attacker stands beside it. */
export const turned = (attacker: Tile, target: Unit) => target.kind === 'aegis' && distance(attacker, target) > 1

/** What an alien's own rule adds to its hit on `enemy`: a ram after moving, a pack's allies beside the prey, a zealot's wounds. */
export function fury(battle: Battle, unit: Unit, enemy: Unit): number {
  if (unit.kind === 'dreadhorn') return unit.moved ? RAM_DAMAGE : 0
  if (unit.kind === 'kinhound') return Math.min(PACK_MAX, battle.units.filter((u) => u.side === unit.side && u !== unit && u.hp > 0 && distance(u, enemy) <= 1).length)
  if (unit.kind === 'zealot') return Math.floor((4 * (unit.stats.hp - unit.hp)) / unit.stats.hp)
  return 0
}

/** A vise's hit holds a hero where it stands through the hero's next turn. */
export function hold(unit: Unit, enemy: Unit, events: GameEvent[]): void {
  if (unit.kind !== 'vise' || enemy.hp <= 0 || enemy.side !== 'human') return
  enemy.rooted = Math.max(enemy.rooted, HOLD_TURNS)
  events.push({ type: 'effect', id: enemy.id, effect: 'snare', amount: 0 })
}
