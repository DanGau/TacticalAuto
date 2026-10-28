/** What a battle asks of the squad. Each pays differently, so where the squad goes shapes what it builds. */
export type Goal = 'exterminate' | 'assassinate' | 'hold' | 'rescue' | 'raid'

export const HOLD_ROUNDS = 6
/** Alien turns between waves on a hold. */
export const WAVE_EVERY = 2
/** Civilians hidden on a rescue, the health of each, and the supplies each saved pays. */
export const CIVILIANS = 10
export const CIVILIAN_HP = 5
export const CIVILIAN_SUPPLIES = 2

export const GOALS: Record<Goal, { name: string; text: string; reward: string; force: number; weight: number }> = {
  exterminate: { name: 'Exterminate', text: 'Kill every alien', reward: 'supplies and gear', force: 0, weight: 3 },
  assassinate: { name: 'Assassinate', text: 'Kill the commander; the rest flee', reward: 'supplies and rare gear', force: -1, weight: 1 },
  hold: { name: 'Hold the uplink', text: `Reach the uplink and hold it for ${HOLD_ROUNDS} rounds as waves arrive`, reward: 'a relic, no gear', force: 2, weight: 1 },
  rescue: {
    name: 'Rescue',
    text: `${CIVILIANS} civilians hide about the map, and the aliens hunt them. A soldier who reaches one gets them out. Save who you can; each saved pays ${CIVILIAN_SUPPLIES} supplies and every soldier 1 experience`,
    reward: 'supplies and experience, no gear',
    force: 0,
    weight: 1,
  },
  raid: { name: 'Supply raid', text: 'A weak guard over a supply cache', reward: 'triple supplies, no gear', force: -1, weight: 1 },
}
