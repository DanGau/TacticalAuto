// Party utilities: what each does, how long it lasts, how rare it is, how many the party holds, and where it finds them.
import type { Rarity } from './base'

/** What a boon can do: a common boon does one; a combo one at full strength and one or two MinorIds at less. */
export type EffectId =
  | 'thrusters' | 'hover' | 'overcharge' | 'crack' | 'tank' | 'smoke' | 'flashbang' | 'rangedShield' | 'meleeShield'
  | 'mending' | 'ironSkin' | 'farsight' | 'keen' | 'coldSnap' | 'blaze' | 'hunted' | 'gravity' | 'dampener'
export type ComboId = 'stormfront' | 'bulwark' | 'warpath' | 'deadeye' | 'smokescreen' | 'skyborne' | 'executioner' | 'inferno' | 'siegebreaker' | 'phalanx' | 'eclipse' | 'tempest'
/** Kept for the run and never used up: at each deploy screen the player picks one held for that fight. */
export type UtilityId = EffectId | ComboId

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

/** What each effect a combo can carry as minor gives at full strength, and as minor. */
export const STRENGTH = { thrusters: THRUST, overcharge: OVERCHARGE, ironSkin: IRON_SKIN, farsight: FARSIGHT, keen: KEEN, gravity: GRAVITY, dampener: DAMPEN, mending: MEND }
export type MinorId = keyof typeof STRENGTH
export const MINOR: Record<MinorId, number> = { thrusters: 2, overcharge: 1, ironSkin: 2, farsight: 1, keen: 0.15, gravity: 1, dampener: 1, mending: 1 }

const SCALED: Record<MinorId, (n: number) => string> = {
  thrusters: (n) => `heroes have +${n} move`,
  overcharge: (n) => `heroes have +${n} damage`,
  ironSkin: (n) => `heroes have +${n} armor`,
  farsight: (n) => `heroes have +${n} range`,
  keen: (n) => `heroes have +${Math.round(n * 100)}% crit chance`,
  gravity: (n) => `aliens have -${n} move`,
  dampener: (n) => `aliens have -${n} damage, to at least 1`,
  mending: (n) => `heroes heal ${n} each turn`,
}
const full = (id: MinorId) => SCALED[id](STRENGTH[id]).replace(/^./, (c) => c.toUpperCase())

interface Kind {
  name: string
  icon: string
  text: string
  rounds: number
  rarity: Rarity
}

const SINGLES: Record<EffectId, Kind> = {
  thrusters: { name: 'Swiftness', icon: '💨', text: full('thrusters'), rounds: 3, rarity: 'common' },
  hover: { name: 'Levitation', icon: '🪽', text: 'Heroes cross difficult terrain and steep ground at no extra cost, float over chasms and never fall', rounds: 3, rarity: 'common' },
  overcharge: { name: 'Overcharge', icon: '⚡', text: full('overcharge'), rounds: 3, rarity: 'common' },
  crack: { name: 'Sunder', icon: '🔨', text: "Heroes' attacks ignore armor", rounds: 2, rarity: 'rare' },
  tank: { name: 'Rigged Tank', icon: '🛢️', text: `Pick a fuel tank: it blows once ${RIG.crowd} aliens are within ${RIG.near} tiles, ${RIG.damage} damage to every alien within ${RIG.radius} and any hero within ${RIG.close}, and leaves fire`, rounds: 4, rarity: 'rare' },
  smoke: { name: 'Obscuring Mist', icon: '🌫️', text: `No alien shoots farther than ${SMOKE_REACH} tiles`, rounds: 3, rarity: 'common' },
  flashbang: { name: 'Blinding Flash', icon: '✴️', text: 'The first cluster is stunned as the party comes in; a boss a round less', rounds: STUN_TURNS, rarity: 'rare' },
  rangedShield: { name: 'Ranged Shield', icon: '🛡️', text: "Attacks from beyond arm's reach do half damage, rounded up", rounds: 3, rarity: 'common' },
  meleeShield: { name: 'Melee Shield', icon: '🔰', text: "Attacks and blasts from arm's reach do half damage, rounded up", rounds: 3, rarity: 'common' },
  mending: { name: 'Mending', icon: '💚', text: full('mending'), rounds: 4, rarity: 'common' },
  ironSkin: { name: 'Iron Skin', icon: '🪨', text: full('ironSkin'), rounds: 3, rarity: 'common' },
  farsight: { name: 'Farsight', icon: '🔭', text: full('farsight'), rounds: 3, rarity: 'common' },
  keen: { name: 'Keen Eye', icon: '👁️', text: full('keen'), rounds: 3, rarity: 'common' },
  coldSnap: { name: 'Cold Snap', icon: '❄️', text: 'Each turn every alien in the fight takes a stack of chill', rounds: 3, rarity: 'rare' },
  blaze: { name: 'Wildfire', icon: '🔥', text: `Each turn aliens within ${BLAZE_REACH} tiles of the way in catch fire`, rounds: 2, rarity: 'common' },
  hunted: { name: "Hunter's Mark", icon: '🎯', text: 'The toughest alien is exposed: hits on it do half again', rounds: 3, rarity: 'common' },
  gravity: { name: 'Gravity Well', icon: '🌀', text: full('gravity'), rounds: 3, rarity: 'common' },
  dampener: { name: 'Dampener', icon: '🔇', text: full('dampener'), rounds: 2, rarity: 'rare' },
}

/** Combos: the major effect, then the minor ones. One minor makes a combo rare, two epic. */
const COMBOS: Record<ComboId, { name: string; icon: string; rounds: number; major: EffectId; minor: MinorId[] }> = {
  stormfront: { name: 'Stormfront', icon: '🌨️', rounds: 3, major: 'coldSnap', minor: ['gravity'] },
  bulwark: { name: 'Bulwark', icon: '🏰', rounds: 3, major: 'ironSkin', minor: ['mending'] },
  warpath: { name: 'Warpath', icon: '🐗', rounds: 3, major: 'overcharge', minor: ['thrusters'] },
  deadeye: { name: 'Deadeye', icon: '🦅', rounds: 3, major: 'farsight', minor: ['keen'] },
  smokescreen: { name: 'Smokescreen', icon: '☁️', rounds: 3, major: 'smoke', minor: ['dampener'] },
  skyborne: { name: 'Skyborne', icon: '🪂', rounds: 3, major: 'hover', minor: ['farsight'] },
  executioner: { name: 'Executioner', icon: '🪓', rounds: 3, major: 'hunted', minor: ['overcharge'] },
  inferno: { name: 'Inferno', icon: '🌋', rounds: 2, major: 'blaze', minor: ['overcharge', 'keen'] },
  siegebreaker: { name: 'Siegebreaker', icon: '⚒️', rounds: 2, major: 'crack', minor: ['overcharge', 'keen'] },
  phalanx: { name: 'Phalanx', icon: '🪖', rounds: 3, major: 'meleeShield', minor: ['ironSkin', 'mending'] },
  eclipse: { name: 'Eclipse', icon: '🌑', rounds: 2, major: 'flashbang', minor: ['dampener', 'gravity'] },
  tempest: { name: 'Tempest', icon: '🌪️', rounds: 3, major: 'rangedShield', minor: ['thrusters', 'farsight'] },
}

/** One effect of a boon; a minor one gives MINOR in place of STRENGTH. */
export interface Part {
  id: EffectId
  minor?: true
}

type Utility = Kind & { parts: Part[] }

/** `rounds`: the rounds its bonus lasts from the landing. `parts`: what it does, its major effect first. */
export const UTILITIES = {
  ...Object.fromEntries(Object.entries(SINGLES).map(([id, kind]) => [id, { ...kind, parts: [{ id }] }])),
  ...Object.fromEntries(
    Object.entries(COMBOS).map(([id, { major, minor, ...kind }]) => [
      id,
      { ...kind, rarity: minor.length > 1 ? 'epic' : 'rare', parts: [{ id: major }, ...minor.map((m) => ({ id: m, minor: true }))], text: [SINGLES[major].text, ...minor.map((m) => SCALED[m](MINOR[m]))].join('; ') },
    ]),
  ),
} as Record<UtilityId, Utility>

/** The effects a boon carries, major first. */
export const effectsOf = (id: UtilityId): EffectId[] => UTILITIES[id].parts.map((p) => p.id)

/** Whether boon `id` carries one of the effects `of`. */
export const carries = (id: UtilityId, of: readonly EffectId[]) => effectsOf(id).some((e) => of.includes(e))

/** What a boon does, and for how long. */
export const boonText = (id: UtilityId) => `${UTILITIES[id].text}, for ${UTILITIES[id].rounds} rounds`

export const UTILITY_IDS = Object.keys(UTILITIES) as UtilityId[]

/** Utilities the party holds at most, those a shop stocks, and what one costs. */
export const UTILITY_SLOTS = 3
export const SHOP_UTILITIES = 1
export const UTILITY_PRICE = 6

/** How often each rarity of boon is drawn against the others. */
export const BOON_WEIGHT: Record<Rarity, number> = { common: 6, rare: 3, epic: 1 }

/** Commons offered at the run's start, and how many the party takes. */
export const START_OFFERS = 3
export const START_PICKS = 2
