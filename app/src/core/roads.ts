// Test helpers that lay a leg's stops and send the squad in.
import { apply, type Result } from './apply'
import { type Battle } from './battle'
import { type EntranceKind } from './entrances'
import { createRun, legOf } from './run'
import { type Run } from './run-state'
import { type Stop } from './run-state'
import { roots } from './skills'

/** For tests: lays the rest of the leg as a road of `stops` one after another, the first entered, then the satellite. */
export function road(run: Run, stops: Stop[]): void {
  const leg = legOf(run)
  leg.columns = [...leg.columns.slice(0, run.stop), ...stops.map((stop) => [{ row: 2, next: [0], stop, town: null, at: null }]), leg.columns.at(-1)!]
  leg.path = [...leg.path.slice(0, run.stop), 0]
}

/** For tests: puts the squad at its leg's satellite, its leg's stops drawn or not. */
export function atKey(run: Run): void {
  const leg = legOf(run)
  leg.columns.at(-1)![0].stop ??= { kind: 'key', risk: 'standard', goal: 'exterminate', terrain: 'compound', twist: null, aliens: [] }
  run.stop = leg.columns.length - 1
  leg.path = [...Array<number>(run.stop).fill(-1), 0]
}

/** For tests: makes the entrance at `entrance`. */
export function enterAt(run: Run, entrance: number): Result {
  return apply(run, { type: 'enter', entrance })
}

/** For tests: the index of an entrance of `kind`, making entrance 0 one where it stands if none is. */
export function entranceOf(battle: Battle, kind: EntranceKind): number {
  const found = battle.entrances.findIndex((e) => e.kind === kind)
  if (found >= 0) return found
  battle.entrances[0].kind = kind
  return 0
}

/** For tests: a run of `seed` under way, its first soldier the first recruit, a Deadeye with a plain rifle. */
export function begun(seed: number): Run {
  const run = createRun(seed)
  run.recruits[0].cls = 'sniper'
  run.recruits[0].skills = [roots('sniper')[0]]
  run.recruits[0].gear.weapon = { id: 0, slot: 'weapon', rarity: 'common', name: 'Assault Rifle', weapon: 'rifle', stats: {}, effect: null }
  apply(run, { type: 'recruit', index: 0 })
  return run
}
