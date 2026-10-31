// How far along the run is, and the threat that builds as it goes.
import { type Run } from './run-state'

/** Stops on each leg before its satellite, whichever way the squad goes. */
export const LEG_STOPS = 9

/** Threat at which the next stop becomes an ambush. */
export const THREAT_MAX = 24

/** Threat each stop adds, and what losing a battle adds on top. */
export const STOP_THREAT = 2

export const LOSS_THREAT = 1

/** Whether the squad is in the second half of its leg, where aliens are stronger. */
export const late = (run: Run) => run.stop >= LEG_STOPS / 2

/** How far along the road the squad is, which sets which packs appear and how much armor aliens wear: two steps a leg, the second halfway. */
export function depth(run: Run): number {
  return run.keys * 2 + (late(run) ? 1 : 0)
}
