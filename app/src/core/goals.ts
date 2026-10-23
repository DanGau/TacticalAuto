/** What a battle asks of the squad. Each pays differently, so where the squad goes shapes what it builds. */
export type Goal = 'exterminate' | 'assassinate' | 'hold' | 'rescue' | 'raid'

export const HOLD_ROUNDS = 6
/** Alien turns between waves on a hold. */
export const WAVE_EVERY = 2
export const CIVILIANS = 3
export const CIVILIAN_HP = 5

export const GOALS: Record<Goal, { name: string; text: string; reward: string; force: number; weight: number }> = {
  exterminate: { name: 'Exterminate', text: 'Kill every alien', reward: 'supplies and gear', force: 0, weight: 3 },
  assassinate: { name: 'Assassinate', text: 'Kill the commander; the rest flee', reward: 'supplies and rare gear', force: 0, weight: 1 },
  hold: { name: 'Hold the uplink', text: `Land on the uplink and survive ${HOLD_ROUNDS} rounds as waves arrive`, reward: 'a relic, no gear', force: 1, weight: 1 },
  rescue: { name: 'Rescue', text: `Kill every alien; each of ${CIVILIANS} civilians kept alive gives every soldier 1 experience`, reward: 'experience, no gear', force: 0, weight: 1 },
  raid: { name: 'Supply raid', text: 'A weak guard over a supply cache', reward: 'triple supplies, no gear', force: -1, weight: 1 },
}
