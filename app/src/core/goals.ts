// Mission goals: what each asks of the squad, pays, and the numbers its rules use.
/** What a battle asks of the squad. Each pays differently, so where the squad goes shapes what it builds. */
export type Goal = 'exterminate' | 'assassinate' | 'hold' | 'rescue' | 'vip' | 'raid' | 'ambush' | 'recover'

/** Rounds the squad must hold the uplink before it can extract. */
export const HOLD_ROUNDS = 6
/** How near the extraction zone a soldier must come to lift off. */
export const EXTRACT_REACH = 3
/** Alien turns between waves on a hold or a recovery. */
export const HOLD_WAVE_EVERY = 2
/** Civilians on a rescue, the health of each, how far each flees in a turn, and the supplies each saved pays. */
export const CIVILIANS = 10
export const CIVILIAN_HP = 8
export const CIVILIAN_MOVE = 4
export const CIVILIAN_SUPPLIES = 2
/** Civilians left unsaved on a rescue for each point of threat they add. */
export const CIVILIANS_PER_THREAT = 4
/** A rescue is won, and pays, only when more than this many civilians are saved. */
export const RESCUE_QUORUM = CIVILIANS / 2

/** The health of a VIP, and how near a soldier it keeps once freed. */
export const VIP_HP = 12
export const ESCORT_REACH = 2

/** `from` is the leg a goal is first drawn on: a lone first soldier meets no hold or assassination. */
export const GOALS: Record<Goal, { name: string; text: string; reward: string; force: number; weight: number; from: number }> = {
  exterminate: { name: 'Exterminate', text: 'Kill every alien', reward: 'supplies and gear', force: 0, weight: 3, from: 0 },
  assassinate: { name: 'Assassinate', text: 'Kill the commander, armored and guarded, which blinks away when wounded; the rest flee', reward: 'supplies and rare gear', force: -3, weight: 1, from: 1 },
  hold: { name: 'Hold the uplink', text: `Reach the uplink and stand in its zone for ${HOLD_ROUNDS} rounds as packs come at it one after another, then get every soldier left to the extraction zone`, reward: 'a relic, no gear', force: -4, weight: 1, from: 1 },
  rescue: {
    name: 'Rescue',
    text: `A terror site: aliens are killing ${CIVILIANS} civilians. Hiders, squat and amber, huddle and stay put; runners, tall and pale, flee the aliens; and harvesters raise the dead as husks. The squad bursts in among them: aliens shoot civilians when they have no good shot at a soldier, so push in. A soldier who reaches a civilian gets them out. Save more than half or it is lost and pays nothing; then each saved pays ${CIVILIAN_SUPPLIES} supplies and every soldier 1 experience; every ${CIVILIANS_PER_THREAT} left behind add a threat`,
    reward: 'supplies and experience, no gear',
    force: 3,
    weight: 1,
    from: 0,
  },
  vip: {
    name: 'VIP rescue',
    text: `A VIP is trapped in a building, under guard. Breach it, clear the aliens fighting near them, reach them, and escort them to the extraction zone that then appears. The aliens shoot the VIP whenever they can. Lose the VIP and the mission is lost`,
    reward: 'supplies and a relic, no gear',
    force: 2,
    weight: 1,
    from: 1,
  },
  raid: { name: 'Supply raid', text: 'Guarded supply caches. Choose how many to go for; each pays supplies, and each beyond the first adds a threat', reward: 'supplies by the cache, no gear', force: -1, weight: 1, from: 0 },
  // Never drawn: a full threat turns the next stop into an ambush.
  // Never drawn: soldiers left behind turn the next stop into a recovery.
  recover: { name: 'Recovery', text: 'The aliens hold your downed soldiers among their pods, and more keep coming. Reach each to get them up, and kill every alien. Lose and the run is over', reward: 'your soldiers back', force: 0, weight: 0, from: 0 },
  ambush: { name: 'Survive the ambush', text: 'Hunted down on the road, with no time to plan. Stand and fight the Hunter and its packs to the last alien', reward: 'the threat emptied', force: -7, weight: 0, from: 0 },
}
