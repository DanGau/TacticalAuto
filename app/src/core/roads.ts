import { apply, type Result } from './apply'
import { spacedTile, ZONE_CLEARANCE, type Battle, type Plan } from './battle'
import { createRun, legOf, type Run, type Stop } from './run'

/** For tests: lays the rest of the leg as a road of `stops` one after another, the first entered, then the satellite. */
export function road(run: Run, stops: Stop[]): void {
  const leg = legOf(run)
  leg.columns = [...leg.columns.slice(0, run.stop), ...stops.map((stop) => [{ row: 2, next: [0], stop }]), leg.columns.at(-1)!]
  leg.path = [...leg.path.slice(0, run.stop), 0]
}

/** For tests: puts the squad at its leg's satellite, its leg's stops drawn or not. */
export function atKey(run: Run): void {
  const leg = legOf(run)
  leg.columns.at(-1)![0].stop ??= { kind: 'key', risk: 'standard', goal: 'exterminate', terrain: 'compound', twist: null, packs: [] }
  run.stop = leg.columns.length - 1
  leg.path = [...Array<number>(run.stop).fill(-1), 0]
}

/** For tests: lands at `zone`, or on a rescue, as one squad. */
export function deploy(run: Run, zone: number): Result {
  return apply(run, run.battle?.goal === 'rescue' ? { type: 'split', teams: 1 } : { type: 'land', zone })
}

/** For tests: the index of a zone of `plan`, making zone 0 one if none is: on a pod for a hot drop, else clear of all. */
export function zoneOf(battle: Battle, plan: Plan): number {
  if (battle.plans.includes(plan)) return battle.plans.indexOf(plan)
  const alien = battle.units.find((u) => u.side === 'alien')!
  battle.zones[0] = plan === 'hot' ? { x: alien.x, y: alien.y } : spacedTile(battle, battle.units, ZONE_CLEARANCE)
  battle.plans[0] = plan
  return 0
}

/** For tests: a run of `seed` under way, its first soldier the plain recruit, with no trait. */
export function begun(seed: number): Run {
  const run = createRun(seed)
  apply(run, { type: 'recruit', index: run.recruits.findIndex((r) => r.trait === null) })
  return run
}
