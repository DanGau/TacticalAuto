/** What a battle asks of the squad. Each pays differently, so where the squad goes shapes what it builds. */
export type Goal = 'exterminate' | 'assassinate' | 'hold' | 'rescue' | 'raid' | 'escape' | 'recover'

/** Rounds the squad must hold the uplink before it can extract. */
export const HOLD_ROUNDS = 8
/** How near the escape zone a soldier must come to lift off. */
export const ESCAPE_REACH = 3
/** Alien turns between waves on an escape, and on a hold or a recovery. */
export const WAVE_EVERY = 3
export const HOLD_WAVE_EVERY = 3
/** Civilians on a rescue, the health of each, how far each flees in a turn, and the supplies each saved pays. */
export const CIVILIANS = 10
export const CIVILIAN_HP = 8
export const CIVILIAN_MOVE = 4
export const CIVILIAN_SUPPLIES = 2
/** Civilians left unsaved on a rescue for each point of threat they add. */
export const CIVILIANS_PER_THREAT = 4
/** A rescue is won, and pays, only when more than this many civilians are saved. */
export const RESCUE_QUORUM = CIVILIANS / 2

/** `from` is the leg a goal is first drawn on: a lone first soldier meets no hold or assassination. */
export const GOALS: Record<Goal, { name: string; text: string; reward: string; force: number; weight: number; from: number }> = {
  exterminate: { name: 'Exterminate', text: 'Kill every alien', reward: 'supplies and gear', force: 0, weight: 3, from: 0 },
  assassinate: { name: 'Assassinate', text: 'Kill the commander, armored and guarded, which blinks away when wounded; the rest flee', reward: 'supplies and rare gear', force: -3, weight: 1, from: 1 },
  hold: { name: 'Hold the uplink', text: `Reach the uplink and stand in its zone for ${HOLD_ROUNDS} rounds as ever larger waves come in from the edges, then get every soldier left to the extraction zone`, reward: 'a relic, no gear', force: -2, weight: 1, from: 1 },
  rescue: {
    name: 'Rescue',
    text: `A terror site: ${CIVILIANS} civilians flee aliens that are killing them, and harvesters raise the dead as husks. Aliens with no soldier to fight hunt civilians, so land near them. A soldier who reaches one gets them out. Split the squad to reach more. Save more than half or it is lost and pays nothing; then each saved pays ${CIVILIAN_SUPPLIES} supplies and every soldier 1 experience; every ${CIVILIANS_PER_THREAT} left behind add a threat`,
    reward: 'supplies and experience, no gear',
    force: -4,
    weight: 1,
    from: 0,
  },
  raid: { name: 'Supply raid', text: 'Guarded supply caches. Choose how many to go for; each pays supplies, and each beyond the first adds a threat', reward: 'supplies by the cache, no gear', force: -1, weight: 1, from: 0 },
  // Never drawn: a full threat turns the next stop into an escape.
  // Never drawn: soldiers left behind turn the next stop into a recovery.
  recover: { name: 'Recovery', text: 'The aliens hold your downed soldiers among their pods, and more keep coming. Reach each to get them up, and kill every alien. Lose and the run is over', reward: 'your soldiers back', force: 0, weight: 0, from: 0 },
  escape: { name: 'Escape', text: 'Ambushed on patrol and hunted. Get to the escape zone and lift off; any soldier out wins it', reward: 'the threat emptied', force: -7, weight: 0, from: 0 },
}
