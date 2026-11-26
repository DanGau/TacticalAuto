// Test helpers that lay a leg's stops and send the hero in.
import { apply, type Result } from './apply'
import { createRun, legOf } from './run'
import { type Run } from './run-state'
import { type Stop } from './run-state'
import { powerOf } from './skills'
import type { Battle } from './battle'
import type { GameEvent } from './combat-event'
import { awaiting, stepBattle } from './combat'
import { endTurn, heroOf } from './turn'
import { weaponAttack } from './attack'
import { spotted } from './fighters'
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
  run.candidates[0].skills = [powerOf('sniper')]
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
  const events = hero ? weaponAttack(battle, hero, spotted(battle)) : []
  battle.actor = null
  endTurn(battle)
  return events
}

/** For tests: one beat of the run's battle, played as beat plays it, settling the battle into the run when it ends. */
export function fight(run: Run): GameEvent[] {
  if (run.battle && awaiting(run.battle)) beat(run.battle)
  return step(run)
}
