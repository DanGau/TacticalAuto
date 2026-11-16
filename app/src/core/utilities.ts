// Boons: what each does, how long it lasts, how rare it is, how many the hero holds, and where it finds them.
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
/** Health Mending gives back a turn; armor Stoneskin adds; range Farsight adds; crit Keen adds; move Gravity Well and damage Dampener take. */
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
  thrusters: (n) => `Have ${n} more move.`,
  overcharge: (n) => `Deal ${n} more damage.`,
  ironSkin: (n) => `Have ${n} more Armor.`,
  farsight: (n) => `Have ${n} more range.`,
  keen: (n) => `Have ${Math.round(n * 100)}% more Crit chance.`,
  gravity: (n) => `Aliens have ${n} less move.`,
  dampener: (n) => `Aliens deal ${n} less damage, down to 1.`,
  mending: (n) => `At the start of your turn, heal ${n}.`,
}
const full = (id: MinorId) => SCALED[id](STRENGTH[id])

interface Kind {
  name: string
  icon: string
  text: string
  rounds: number
  rarity: Rarity
}

const SINGLES: Record<EffectId, Kind> = {
  thrusters: { name: 'Swiftness', icon: '💨', text: full('thrusters'), rounds: 3, rarity: 'common' },
  hover: { name: 'Levitation', icon: '🪽', text: 'Cross mire, cliffs and steep ground at no extra cost. Float over chasms and water.', rounds: 6, rarity: 'common' },
  overcharge: { name: 'Overcharge', icon: '⚡', text: full('overcharge'), rounds: 3, rarity: 'common' },
  crack: { name: 'Sunder', icon: '🔨', text: 'Ignore Armor.', rounds: 2, rarity: 'rare' },
  tank: { name: 'Rigged Tank', icon: '🛢️', text: `Choose a fuel tank. Once ${RIG.crowd} aliens are within ${RIG.near} tiles of it, it explodes: ${RIG.damage} damage to each alien within ${RIG.radius} tiles and to you within ${RIG.close}, and fire.`, rounds: 4, rarity: 'rare' },
  smoke: { name: 'Obscuring Mist', icon: '🌫️', text: `Aliens cannot shoot farther than ${SMOKE_REACH} tiles.`, rounds: 3, rarity: 'common' },
  flashbang: { name: 'Blinding Flash', icon: '✴️', text: `When you land, Stun the nearest cluster for ${STUN_TURNS} rounds, a boss for ${STUN_TURNS - 1}.`, rounds: STUN_TURNS, rarity: 'rare' },
  rangedShield: { name: 'Ranged Shield', icon: '🛡️', text: "Hits on you from beyond arm's reach deal half damage, rounded up.", rounds: 3, rarity: 'common' },
  meleeShield: { name: 'Melee Shield', icon: '🔰', text: "Hits and blasts on you from arm's reach deal half damage, rounded up.", rounds: 3, rarity: 'common' },
  mending: { name: 'Mending', icon: '💚', text: full('mending'), rounds: 4, rarity: 'common' },
  ironSkin: { name: 'Stoneskin', icon: '🪨', text: full('ironSkin'), rounds: 3, rarity: 'common' },
  farsight: { name: 'Farsight', icon: '🔭', text: full('farsight'), rounds: 3, rarity: 'common' },
  keen: { name: 'Keen Eye', icon: '👁️', text: full('keen'), rounds: 3, rarity: 'common' },
  coldSnap: { name: 'Cold Snap', icon: '❄️', text: 'Turn the water on your route to ice. At the start of your turn, apply 1 Chill to each alien in the fight.', rounds: 3, rarity: 'rare' },
  blaze: { name: 'Wildfire', icon: '🔥', text: `At the start of your turn, apply 1 Burn to each alien within ${BLAZE_REACH} tiles of your landing.`, rounds: 2, rarity: 'common' },
  hunted: { name: 'Prey', icon: '🎯', text: 'The alien with the most max HP takes 50% more damage.', rounds: 3, rarity: 'common' },
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
  skyborne: { name: 'Skyborne', icon: '🪂', rounds: 6, major: 'hover', minor: ['farsight'] },
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
      { ...kind, rarity: minor.length > 1 ? 'epic' : 'rare', parts: [{ id: major }, ...minor.map((m) => ({ id: m, minor: true }))], text: [SINGLES[major].text, ...minor.map((m) => SCALED[m](MINOR[m]))].join(' ') },
    ]),
  ),
} as Record<UtilityId, Utility>

/** The effects a boon carries, major first. */
export const effectsOf = (id: UtilityId): EffectId[] => UTILITIES[id].parts.map((p) => p.id)

/** Whether boon `id` carries one of the effects `of`. */
export const carries = (id: UtilityId, of: readonly EffectId[]) => effectsOf(id).some((e) => of.includes(e))

/** What a boon does, and for how long. */
export const boonText = (id: UtilityId) => `${UTILITIES[id].text} Lasts ${UTILITIES[id].rounds} rounds.`

export const UTILITY_IDS = Object.keys(UTILITIES) as UtilityId[]

/** Utilities the hero holds at most, those a shop stocks, and what one costs. */
export const UTILITY_SLOTS = 3
export const SHOP_UTILITIES = 1
export const UTILITY_PRICE = 6

/** How often each rarity of boon is drawn against the others. */
export const BOON_WEIGHT: Record<Rarity, number> = { common: 6, rare: 3, epic: 1 }

/** Commons offered at the run's start, and how many the hero takes. */
export const START_OFFERS = 3
export const START_PICKS = 2
