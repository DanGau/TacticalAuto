// Test helpers that lay a leg's stops and send the hero in.
import { apply, type Result } from './apply'
import { createRun, legOf } from './run'
import { type Run } from './run-state'
import { type Stop } from './run-state'
import { isSoldier, type Battle, type Unit } from './battle'
import { WEAPONS, type WeaponId } from './weapons'
import type { GameEvent } from './combat-event'
import { awaiting, stepBattle } from './combat'
import { endTurn, heroOf } from './turn'
import { shoot } from './attack'
import { step } from './step'

/** For tests: lays the rest of the leg as a road of `stops` one after another, the first entered, then the satellite. */
export function road(run: Run, stops: Stop[]): void {
  const leg = legOf(run)
  leg.columns = [...leg.columns.slice(0, run.stop), ...stops.map((stop) => [{ row: 2, next: [0], stop, town: null, at: null }]), leg.columns.at(-1)!]
  leg.path = [...leg.path.slice(0, run.stop), 0]
}

/** For tests: puts the hero at its leg's satellite, its leg's stops drawn or not. */
export function atKey(run: Run): void {
  const leg = legOf(run)
  leg.columns.at(-1)![0].stop ??= { kind: 'key', risk: 'standard', goal: 'cross', terrain: 'compound', challenge: null, twist: null, aliens: [] }
  run.stop = leg.columns.length - 1
  leg.path = [...Array<number>(run.stop).fill(-1), 0]
}

/** For tests: makes the landing. */
export function enterAt(run: Run): Result {
  return apply(run, { type: 'enter' })
}

/** For tests: a run of `seed` under way, its hero the first candidate, a Deadeye with a plain rifle and its starter deck. */
export function begun(seed: number): Run {
  const run = createRun(seed)
  run.candidates[0].cls = 'sniper'
  run.candidates[0].gear = { id: 0, rarity: 'common', name: 'Rifle', weapon: 'rifle', stats: {}, effect: null }
  apply(run, { type: 'hero', index: 0 })
  return run
}

/**
 * For tests: one beat of the battle. On the hero's turn the hero makes its weapon's attack, as a plain shot with every
 * effect it carries, and ends the turn: the tests of effects read a hit, not a card.
 */
export function beat(battle: Battle): GameEvent[] {
  if (!awaiting(battle)) return stepBattle(battle)
  const hero = heroOf(battle)
  battle.actor = hero?.id ?? null
  const events = hero ? shoot(battle, hero) : []
  battle.actor = null
  endTurn(battle)
  return events
}

/** For tests: one beat of the run's battle, played as beat plays it, settling the battle into the run when it ends. */
export function fight(run: Run): GameEvent[] {
  if (run.battle && awaiting(run.battle)) beat(run.battle)
  return step(run)
}

/** For tests: a hero with `weapon`, its base damage 10, and aliens at `at` on open ground, too tough to fall. */
export function field(weapon: WeaponId, at: [number, number][], range = WEAPONS[weapon].melee ? 1 : 5): { b: Battle; hero: Unit; aliens: Unit[] } {
  const run = begun(1)
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  enterAt(run)
  const b = run.battle!
  const hero = b.units.find(isSoldier)!
  const template = b.units.find((u) => u.side === 'alien')!
  const aliens = at.map(([x, y], i) => ({ ...template, effects: [], spent: [], resists: [], id: 900 + i, x, y, hp: 500, armor: 0, kind: 'trooper' as const, boss: false, target: false, surprised: 0, panicked: false, revealed: true, engaged: true, stats: { ...template.stats, hp: 500, move: 0, range: 0 } }))
  b.units = [hero, ...aliens]
  b.ground.fill('pavement')
  b.props.fill('none')
  b.bulk.fill(0 as never)
  b.height.fill(0)
  b.north.fill('none' as never)
  b.west.fill('none' as never)
  Object.assign(b, { goal: 'cross', uplink: null, extract: null, quarry: false, waves: [], twist: null, opening: false })
  Object.assign(hero, { x: 10, y: 10, weapon, effects: [], stats: { ...hero.stats, damage: 10, crit: 0, range, move: 0 }, stance: 'anchor' })
  return { b, hero, aliens }
}
