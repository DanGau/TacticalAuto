// Party utilities: what each does, how many the party holds, and where it finds them.
import type { Keyword } from './keywords'

/** Kept for the run and never used up: at each deploy screen the player picks one held for that fight. */
export type UtilityId = 'thrusters' | 'hover' | 'overcharge' | 'crack' | 'tank' | 'smoke' | 'flashbang' | 'rangedShield' | 'meleeShield'

/** Move Thrusters add, and damage Overcharge adds. */
export const THRUST = 2
export const OVERCHARGE = 2
/** Rounds a smoke bomb lasts, and how far an alien in it can shoot. */
export const SMOKE = { rounds: 3, reach: 2 }
/** Alien turns a flashbang stuns the nearest cluster, its boss one fewer. */
export const STUN_TURNS = 2
/** A rigged tank: blows once `crowd` aliens stand within `near` tiles of it, or one beside it; `damage` to everyone within `radius`. */
export const RIG = { crowd: 3, near: 3, radius: 4, damage: 8 }

export const UTILITIES: Record<UtilityId, { name: string; icon: string; text: string; tags?: Keyword[] }> = {
  thrusters: { name: 'Thrusters', icon: '🚀', text: `Every hero has +${THRUST} move this fight` },
  hover: { name: 'Hover Rig', icon: '🛸', text: 'Heroes cross difficult terrain and steep ground at no extra cost' },
  overcharge: { name: 'Overcharge', icon: '⚡', text: `Every hero has +${OVERCHARGE} damage this fight` },
  crack: { name: 'Armor Crack', icon: '🔨', text: "Every hero's attacks ignore armor this fight" },
  tank: { name: 'Rigged Tank', icon: '🛢️', text: `Pick a fuel tank: it blows once ${RIG.crowd} aliens are within ${RIG.near} tiles or one is beside it, ${RIG.damage} damage to all within ${RIG.radius}, heroes too` },
  smoke: { name: 'Smoke Bomb', icon: '💨', text: `For ${SMOKE.rounds} rounds no alien shoots farther than ${SMOKE.reach} tiles` },
  flashbang: { name: 'Flashbang', icon: '✴️', text: `The first cluster is stunned for ${STUN_TURNS} turns as the squad comes in; a boss for 1` },
  rangedShield: { name: 'Ranged Shield', icon: '🛡️', text: 'Attacks from beyond arm\'s reach do half damage, rounded down' },
  meleeShield: { name: 'Melee Shield', icon: '🔰', text: 'Attacks and blasts from arm\'s reach do half damage, rounded down' },
}

export const UTILITY_IDS = Object.keys(UTILITIES) as UtilityId[]

/** Utilities the party holds at most, those a shop stocks, and what one costs. */
export const UTILITY_SLOTS = 3
export const SHOP_UTILITIES = 3
export const UTILITY_PRICE = 3
