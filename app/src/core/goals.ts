// Mission goals: what each asks of the hero, pays, and the numbers its rules use.
/** What a battle asks of the hero. Each pays differently, so where the hero goes shapes what it builds. */
import type { TerrainKind } from './terrain'
import type { ChallengeId } from './challenges'

export type Goal = 'exterminate' | 'assassinate' | 'hold' | 'rescue' | 'vip' | 'raid' | 'ambush'

/** How a battle plays: the hero pushes through clusters one at a time, or holds its ground as aliens flood in. */
export type Flow = 'push' | 'flood'

/** The flow of a battle: a swarm floods, and with no challenge to stage it, a hive's clearing and open or ruined raids too, for nothing there stands in the aliens' way. */
export function flowOf(goal: Goal, place: TerrainKind, challenge: ChallengeId | null = null): Flow {
  if (goal === 'hold' || goal === 'ambush' || goal === 'rescue' || challenge === 'swarm') return 'flood'
  if (challenge) return 'push'
  if (goal === 'exterminate' && place === 'hive') return 'flood'
  if (goal === 'raid' && (place === 'ruins' || place === 'countryside')) return 'flood'
  return 'push'
}

/** Rounds the hero must hold the uplink before it can extract. */
export const HOLD_ROUNDS = 6
/** How near the extraction zone a hero must come to lift off. */
export const EXTRACT_REACH = 3
/** Alien turns between waves on a flood. */
export const WAVE_EVERY = 2
/** Civilians on a rescue, the health of each, how far each flees in a turn, and the supplies each saved pays. */
export const CIVILIANS = 10
export const CIVILIAN_HP = 8
export const CIVILIAN_MOVE = 4
export const CIVILIAN_SUPPLIES = 2
/** Civilians left unsaved on a rescue for each point of threat they add. */
export const CIVILIANS_PER_THREAT = 4
/** A rescue is won, and pays, only when more than this many civilians are saved. */
export const RESCUE_QUORUM = CIVILIANS / 2

/** The health of a VIP, and how near a hero it keeps once freed. */
export const VIP_HP = 12
export const ESCORT_REACH = 2

/** `from` is the leg a goal is first drawn on: a fresh hero meets no hold or assassination. */
export const GOALS: Record<Goal, { name: string; text: string; reward: string; force: number; weight: number; from: number }> = {
  exterminate: { name: 'Clear Out', text: 'Kill every alien.', reward: 'supplies and gear', force: 2, weight: 3, from: 0 },
  assassinate: { name: 'Takedown', text: 'Kill the commander. It has Armor and guards, and blinks away when hurt. When it dies, the rest flee.', reward: 'supplies and rare gear', force: -3, weight: 1, from: 1 },
  hold: { name: 'Hold the Uplink', text: `Stand in the uplink zone for ${HOLD_ROUNDS} rounds as aliens pour in. Then reach the extraction zone.`, reward: 'a relic, no gear', force: -6, weight: 1, from: 1 },
  rescue: {
    name: 'Rescue',
    text: `Save more than half of the ${CIVILIANS} civilians, or the mission is lost. Reach a civilian to save it. Aliens shoot civilians when they have no shot at you. Hiders stay put, runners flee, and Harvesters raise the dead as Husks. Each civilian saved pays ${CIVILIAN_SUPPLIES} supplies and 1 XP. Every ${CIVILIANS_PER_THREAT} left behind add 1 threat.`,
    reward: 'supplies and experience, no gear',
    force: 1,
    weight: 1,
    from: 0,
  },
  vip: {
    name: 'VIP Rescue',
    text: `Reach the VIP in the guarded building. Then escort it to the extraction zone. Aliens shoot the VIP whenever they can. If the VIP dies, the mission is lost.`,
    reward: 'supplies and a relic, no gear',
    force: 2,
    weight: 1,
    from: 1,
  },
  raid: { name: 'Smash and Grab', text: 'Grab every supply cache. Each pays supplies.', reward: 'supplies by the cache, no gear', force: 1, weight: 1, from: 0 },
  // Never drawn: a full threat turns the next stop into an ambush.
  ambush: { name: 'Hunted', text: 'Kill the Hunter and every alien that floods in.', reward: 'the threat emptied', force: -7, weight: 0, from: 0 },
}
