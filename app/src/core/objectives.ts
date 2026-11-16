// Objectives: each battle's order to the hero in a few words, true to its rules, and the threat it poses.
import type { ChallengeId } from './challenges'
import type { Goal } from './goals'
import type { Mission, Run } from './run-state'

/** What each goal orders: every crossing ends at its objective. */
const GOAL_ORDERS: Record<Goal, string> = {
  cross: 'Reach the extraction zone',
  assassinate: 'Kill the commander',
  hold: 'Hold the uplink',
  rescue: 'Save the civilians',
  ambush: 'Survive the hunt',
}

/** What a challenge throws at the hero, and how to meet it. */
export const THREATS: Record<ChallengeId, string> = {
  slog: 'Swamp, foes scattered. Levitate, shield or reach.',
  firingLine: 'Snipers. Mist, shield or dampener.',
  ironWall: 'Heavy armor. Sunder, overcharge or fire.',
  swarm: 'Swarm. Shield, tank, cold or gravity.',
  scattered: 'Scattered sentries, on a clock. Swiftness or reach.',
  bigOne: 'Armored giant. Overcharge, sunder or mark.',
  killBox: 'Hot landing. Flash, mist, shield or dampener.',
}

/** The hero's order at a battle: a key storms the satellite, the final takes the hub; a crossing a Big One guards fells it. */
export function objective(kind: Mission['kind'], goal: Goal, challenge: ChallengeId | null = null): string {
  if (kind === 'final') return 'Take the hub'
  if (kind === 'key') return 'Storm the satellite'
  if (goal === 'cross' && challenge === 'bigOne') return 'Fell the giant'
  return GOAL_ORDERS[goal]
}

/** The order for the battle under way. */
export const missionOrder = (run: Run): string => objective(run.mission!.kind, run.mission!.goal, run.battle!.challenge)
