// Objectives: each battle's order to the squad in a few words, true to its rules, and the threat it poses.
import type { ChallengeId } from './challenges'
import type { Goal } from './goals'
import type { Mission, Run } from './run-state'
import { ZONE_TERRAINS, type TerrainKind } from './terrain'

/** What a goal orders, but a clear-out, whose order follows its challenge or ground. */
const GOAL_ORDERS: Record<Exclude<Goal, 'exterminate'>, string> = {
  assassinate: 'Kill the commander',
  hold: 'Hold the uplink',
  rescue: 'Save the civilians',
  vip: 'Extract the VIP',
  raid: 'Seize the caches',
  recover: 'Bring them back',
  ambush: 'Survive the hunt',
}

/** A clear-out's orders by its challenge, one chosen by the ground. */
const CHALLENGE_ORDERS: Record<ChallengeId, string[]> = {
  slog: ['Cross the mire', 'Clear the mire'],
  firingLine: ['Take the ridge', 'Silence the guns'],
  ironWall: ['Break the wall', 'Crack the armor'],
  swarm: ['Stem the swarm', 'Burn the brood'],
  scattered: ['Hunt the sentries', 'Sweep the outposts'],
  bigOne: ['Fell the giant', 'Slay the giant'],
  killBox: ['Break the ambush', 'Survive the trap'],
}

/** A clear-out's order with no challenge, by its ground. */
const GROUND_ORDERS: Record<TerrainKind, string> = {
  town: 'Clear the streets',
  city: 'Clear the blocks',
  countryside: 'Sweep the fields',
  industrial: 'Clear the yards',
  ruins: 'Purge the ruins',
  compound: 'Storm the compound',
  hive: 'Purge the hive',
}

/** What a challenge throws at the squad, and how to meet it. */
export const THREATS: Record<ChallengeId, string> = {
  slog: 'Mire under fire. Levitate or shield.',
  firingLine: 'Snipers. Mist or ranged shield.',
  ironWall: 'Heavy armor. Sunder or overcharge.',
  swarm: 'Swarm. Melee shield or tank.',
  scattered: 'Scattered sentries, on a clock. Swiftness.',
  bigOne: 'Armored giant. Overcharge or sunder.',
  killBox: 'Hot landing. Flash, mist or shield.',
}

/** The squad's order at a battle: a key frees its hero or storms the stronghold, the final takes the hub. */
export function objective(kind: Mission['kind'], goal: Goal, challenge: ChallengeId | null, place: TerrainKind, hero: string | null = null): string {
  if (kind === 'final') return 'Take the hub'
  if (kind === 'key') return hero ? `Free ${hero}` : 'Storm the stronghold'
  if (goal !== 'exterminate') return GOAL_ORDERS[goal]
  if (!challenge) return GROUND_ORDERS[place]
  const orders = CHALLENGE_ORDERS[challenge]
  return orders[Math.max(0, (ZONE_TERRAINS as readonly string[]).indexOf(place)) % orders.length]
}

/** The order for the battle under way. */
export const missionOrder = (run: Run): string => objective(run.mission!.kind, run.mission!.goal, run.battle!.challenge, run.battle!.place, run.route[run.keys].hero?.name)
