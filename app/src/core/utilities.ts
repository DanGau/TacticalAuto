// Party utilities: what each does, how long it lasts, how many the party holds, and where it finds them.

/** Kept for the run and never used up: at each deploy screen the player picks one held for that fight. */
export type UtilityId =
  | 'thrusters' | 'hover' | 'overcharge' | 'crack' | 'tank' | 'smoke' | 'flashbang' | 'rangedShield' | 'meleeShield'
  | 'mending' | 'ironSkin' | 'farsight' | 'keen' | 'coldSnap' | 'blaze' | 'hunted' | 'gravity' | 'dampener'

/** Move Thrusters add, and damage Overcharge adds. */
export const THRUST = 3
export const OVERCHARGE = 2
/** How far an alien in smoke can shoot. */
export const SMOKE_REACH = 2
/** Alien turns a flashbang stuns the nearest cluster, its boss one fewer. */
export const STUN_TURNS = 2
/** A rigged tank: blows once `crowd` aliens stand within `near` tiles of it; `damage` to every alien within `radius` and every hero within `close`, and fire within `fireReach` for `fireTurns`. */
export const RIG = { crowd: 3, near: 4, radius: 6, close: 2, damage: 10, fireReach: 4, fireTurns: 4 }
/** Health Mending gives back a turn; armor Iron Skin adds; range Farsight adds; crit Keen adds; move Gravity Well and damage Dampener take. */
export const MEND = 2
export const IRON_SKIN = 3
export const FARSIGHT = 2
export const KEEN = 0.25
export const GRAVITY = 2
export const DAMPEN = 2
/** Tiles of the way in Wildfire sets aliens burning within. */
export const BLAZE_REACH = 6

/** `rounds`: the rounds its bonus lasts from the landing. */
export const UTILITIES: Record<UtilityId, { name: string; icon: string; text: string; rounds: number }> = {
  thrusters: { name: 'Swiftness', icon: '💨', text: `Heroes have +${THRUST} move`, rounds: 3 },
  hover: { name: 'Levitation', icon: '🪽', text: 'Heroes cross difficult terrain and steep ground at no extra cost, float over chasms and never fall', rounds: 3 },
  overcharge: { name: 'Overcharge', icon: '⚡', text: `Heroes have +${OVERCHARGE} damage`, rounds: 3 },
  crack: { name: 'Sunder', icon: '🔨', text: "Heroes' attacks ignore armor", rounds: 2 },
  tank: { name: 'Rigged Tank', icon: '🛢️', text: `Pick a fuel tank: it blows once ${RIG.crowd} aliens are within ${RIG.near} tiles, ${RIG.damage} damage to every alien within ${RIG.radius} and any hero within ${RIG.close}, and leaves fire`, rounds: 4 },
  smoke: { name: 'Obscuring Mist', icon: '🌫️', text: `No alien shoots farther than ${SMOKE_REACH} tiles`, rounds: 3 },
  flashbang: { name: 'Blinding Flash', icon: '✴️', text: 'The first cluster is stunned as the party comes in; a boss a round less', rounds: STUN_TURNS },
  rangedShield: { name: 'Ranged Shield', icon: '🛡️', text: "Attacks from beyond arm's reach do half damage, rounded up", rounds: 3 },
  meleeShield: { name: 'Melee Shield', icon: '🔰', text: "Attacks and blasts from arm's reach do half damage, rounded up", rounds: 3 },
  mending: { name: 'Mending', icon: '💚', text: `Heroes heal ${MEND} each turn`, rounds: 4 },
  ironSkin: { name: 'Iron Skin', icon: '🪨', text: `Heroes have +${IRON_SKIN} armor`, rounds: 3 },
  farsight: { name: 'Farsight', icon: '🔭', text: `Heroes have +${FARSIGHT} range`, rounds: 3 },
  keen: { name: 'Keen Eye', icon: '👁️', text: `Heroes have +${KEEN * 100}% crit chance`, rounds: 3 },
  coldSnap: { name: 'Cold Snap', icon: '❄️', text: 'Each turn every alien in the fight takes a stack of chill', rounds: 3 },
  blaze: { name: 'Wildfire', icon: '🔥', text: `Each turn aliens within ${BLAZE_REACH} tiles of the way in catch fire`, rounds: 2 },
  hunted: { name: "Hunter's Mark", icon: '🎯', text: 'The toughest alien is exposed: hits on it do half again', rounds: 3 },
  gravity: { name: 'Gravity Well', icon: '🌀', text: `Aliens have -${GRAVITY} move`, rounds: 3 },
  dampener: { name: 'Dampener', icon: '🔇', text: `Aliens have -${DAMPEN} damage, to at least 1`, rounds: 2 },
}

/** What a boon does, and for how long. */
export const boonText = (id: UtilityId) => `${UTILITIES[id].text}, for ${UTILITIES[id].rounds} rounds`

export const UTILITY_IDS = Object.keys(UTILITIES) as UtilityId[]

/** Utilities the party holds at most, those a shop stocks, and what one costs. */
export const UTILITY_SLOTS = 3
export const SHOP_UTILITIES = 2
export const UTILITY_PRICE = 4
