// Mission goals: what each asks of the hero, pays, and the numbers its rules use.
/** What a battle asks of the hero. Each pays differently, so where the hero goes shapes what it builds. */
import type { ChallengeId } from './challenges'

export type Goal = 'cross' | 'assassinate' | 'hold' | 'rescue' | 'ambush'

/** How a battle plays: the hero pushes through clusters one at a time, or holds its ground as aliens flood in. */
export type Flow = 'push' | 'flood'

/** The flow of a battle: aliens flood in on a hold, a rescue, an ambush and a swarm; on any other the hero pushes through them. */
export function flowOf(goal: Goal, challenge: ChallengeId | null = null): Flow {
  return goal === 'hold' || goal === 'ambush' || goal === 'rescue' || challenge === 'swarm' ? 'flood' : 'push'
}

/** Rounds the hero must hold the uplink. */
export const HOLD_ROUNDS = 6
/** How near the extraction zone a hero must come to lift off. */
export const EXTRACT_REACH = 3
/** Alien turns between waves on a flood. */
export const WAVE_EVERY = 2
/** Civilians on a rescue, the health of each, how far each flees in a turn, and the supplies and experience each saved pays. */
export const CIVILIANS = 3
export const CIVILIAN_HP = 24
export const CIVILIAN_MOVE = 4
export const CIVILIAN_SUPPLIES = 6
export const CIVILIAN_XP = 3
/** Civilians left unsaved on a rescue for each point of threat they add. */
export const CIVILIANS_PER_THREAT = 2
/** A rescue is won, and pays, only when more than this many civilians are saved. */
export const RESCUE_QUORUM = 1

/** `from` is the leg a goal is first drawn on: a fresh hero meets no hold or assassination. */
export const GOALS: Record<Goal, { name: string; text: string; reward: string; force: number; weight: number; from: number }> = {
  cross: { name: 'Break Through', text: 'Reach the extraction zone.', reward: 'supplies and gear', force: 2, weight: 3, from: 0 },
  assassinate: { name: 'Takedown', text: 'Kill the commander at the far end. It has Armor and guards, and blinks away when hurt. Its death routs the rest.', reward: 'supplies and rare gear', force: -3, weight: 1, from: 1 },
  hold: { name: 'Hold the Uplink', text: `Reach the uplink. Hold its zone for ${HOLD_ROUNDS} rounds.`, reward: 'a relic, no gear', force: -6, weight: 1, from: 1 },
  rescue: {
    name: 'Rescue',
    text: `Reach the ${CIVILIANS} civilians to save them. Save ${RESCUE_QUORUM + 1}, or fail. Each pays ${CIVILIAN_SUPPLIES} supplies and ${CIVILIAN_XP} XP. Every ${CIVILIANS_PER_THREAT} lost: 1 threat.`,
    reward: 'supplies and experience, no gear',
    force: -3,
    weight: 1,
    from: 0,
  },
  // Never drawn: a full threat turns the next stop into an ambush.
  ambush: { name: 'Hunted', text: 'Reach the extraction zone, or kill the Hunter.', reward: 'the threat emptied', force: -10, weight: 0, from: 0 },
}
