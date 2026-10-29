import { apply, type Result } from './apply'
import { legOf, type Run, type Stop } from './run'

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
