// Boons: the hero's field kit, held for the run in a few slots, one activated each battle; what each does at each level.
import type { Effect, Stats } from './battle'
import { EFFECTS } from './gear'
import { PERKS } from './perks'
import type { Flow } from './quantities'

/** How a boon helps: the plain thing it raises. */
export type Category = 'damage' | 'soak' | 'mitigation' | 'speed' | 'jump height' | 'jump length' | 'knockback' | 'range'

export type UtilityId =
  | 'incendiary' | 'cryo' | 'overcharge' | 'plasma' | 'hollowPoint' | 'tracer'
  | 'nanoweave' | 'leech' | 'regen'
  | 'plating' | 'bracing' | 'ablative' | 'deflector' | 'riot'
  | 'afterburner' | 'hoverPack' | 'gravBoots' | 'jumpJets'
  | 'gauntlet' | 'concussion' | 'thermite' | 'cryoRams'
  | 'longshot' | 'suppression'

/** A boon held, at its level. */
export interface Held {
  id: UtilityId
  level: number
}

/** The highest level a boon reaches; one gained again while held rises a level. */
export const MAX_LEVEL = 3

/** What a boon adds that is no stat: damage each hit on the hero loses, health it heals a turn, tiles Force Gauntlet drives. */
export type Rider = 'guard' | 'regen' | 'push'

interface Kind extends Flow {
  name: string
  category: Category
  /** The effects it lends the hero, each working as on gear, a skill or a perk. */
  lends: Effect[]
  /** What it adds at levels 1, 2 and 3, to a stat or a rider. */
  adds: { to: keyof Stats | Rider; by: [number, number, number] }
  /** What its lent effects do, apart from what it adds. */
  text?: string
}

const gear = (id: keyof typeof EFFECTS) => ({ lends: [id], text: EFFECTS[id].text, makes: EFFECTS[id].makes, reads: EFFECTS[id].reads })

export const UTILITIES: Record<UtilityId, Kind> = {
  incendiary: { name: 'Incendiary Rounds', category: 'damage', ...gear('incendiary'), adds: { to: 'damage', by: [0, 1, 2] } },
  cryo: { name: 'Cryo Payload', category: 'damage', ...gear('frostbite'), adds: { to: 'damage', by: [0, 1, 2] } },
  overcharge: { name: 'Overcharged Cell', category: 'damage', ...gear('arc'), adds: { to: 'crit', by: [0.1, 0.2, 0.3] }, makes: ['crit'] },
  plasma: { name: 'Plasma Lance', category: 'damage', ...gear('piercing'), adds: { to: 'damage', by: [1, 2, 3] } },
  hollowPoint: { name: 'Hollow Points', category: 'damage', ...gear('executioner'), adds: { to: 'damage', by: [0, 1, 2] } },
  tracer: { name: 'Tracer Feed', category: 'damage', ...gear('tracer'), adds: { to: 'damage', by: [0, 1, 2] } },
  nanoweave: { name: 'Nanoweave', category: 'soak', lends: [], adds: { to: 'hp', by: [4, 7, 10] } },
  leech: { name: 'Leech Rounds', category: 'soak', ...gear('vampiric'), adds: { to: 'hp', by: [0, 3, 6] } },
  regen: { name: 'Regen Gel', category: 'soak', lends: [], adds: { to: 'regen', by: [1, 2, 3] } },
  plating: { name: 'Kinetic Plating', category: 'mitigation', lends: [], adds: { to: 'armor', by: [3, 5, 7] }, makes: ['armor'] },
  bracing: { name: 'Reactive Bracing', category: 'mitigation', ...gear('braced'), adds: { to: 'armor', by: [0, 2, 4] } },
  ablative: { name: 'Ablative Field', category: 'mitigation', lends: [], adds: { to: 'guard', by: [1, 2, 3] } },
  deflector: { name: 'Deflector Screen', category: 'mitigation', lends: ['rangedShield'], text: "Take half damage from ranged hits, rounded up.", adds: { to: 'armor', by: [0, 2, 4] } },
  riot: { name: 'Riot Shield', category: 'mitigation', lends: ['meleeShield'], text: "Take half damage from melee hits and blasts, rounded up.", adds: { to: 'armor', by: [0, 2, 4] } },
  afterburner: { name: 'Afterburners', category: 'speed', lends: [], adds: { to: 'move', by: [2, 3, 4] } },
  hoverPack: { name: 'Hover Pack', category: 'speed', lends: ['hover'], text: 'Cross mire, cliffs and steep ground at no extra cost. Float over chasms and water.', adds: { to: 'move', by: [0, 1, 2] } },
  gravBoots: { name: 'Grav Boots', category: 'jump height', ...gear('lofty'), adds: { to: 'jump', by: [1, 2, 3] } },
  jumpJets: { name: 'Jump Jets', category: 'jump length', lends: ['crashLanding'], text: PERKS.crashLanding.text, adds: { to: 'span', by: [1, 2, 3] } },
  gauntlet: { name: 'Force Gauntlet', category: 'knockback', lends: ['repulse'], adds: { to: 'push', by: [2, 3, 4] }, makes: ['moved', 'impact'] },
  concussion: { name: 'Concussion Shells', category: 'knockback', ...gear('thunder'), adds: { to: 'damage', by: [0, 1, 2] } },
  thermite: { name: 'Thermite Rams', category: 'knockback', lends: ['shove', 'kiln'], text: `${EFFECTS.shove.text} ${EFFECTS.kiln.text}`, makes: ['moved', 'impact', 'burn'], reads: ['impact'], adds: { to: 'damage', by: [0, 1, 2] } },
  cryoRams: { name: 'Cryo Rams', category: 'knockback', lends: ['shove', 'quench'], text: `${EFFECTS.shove.text} ${EFFECTS.quench.text}`, makes: ['moved', 'impact', 'chill'], reads: ['impact'], adds: { to: 'damage', by: [0, 1, 2] } },
  longshot: { name: 'Longshot Optics', category: 'range', lends: [], adds: { to: 'range', by: [2, 3, 4] } },
  suppression: { name: 'Suppression Scope', category: 'range', ...gear('sapping'), adds: { to: 'range', by: [1, 2, 3] } },
}

export const UTILITY_IDS = Object.keys(UTILITIES) as UtilityId[]

/** What boon `id` adds at `level`. */
export const amountOf = (id: UtilityId, level: number) => UTILITIES[id].adds.by[Math.min(level, MAX_LEVEL) - 1]

/** What each stat or rider's amount reads as. */
const ADDS: Record<keyof Stats | Rider, (n: number) => string> = {
  hp: (n) => `${n} more max HP.`,
  armor: (n) => `Gain ${n} Armor.`,
  damage: (n) => `Deal ${n} more damage.`,
  range: (n) => `${n} more range.`,
  move: (n) => `${n} more move.`,
  crit: (n) => `${Math.round(n * 100)}% more Crit chance.`,
  strength: (n) => `${n} more strength.`,
  jump: (n) => `Leap ${n} more levels up or down.`,
  span: (n) => `Leap gaps ${n} more tiles wide.`,
  guard: (n) => `Take ${n} less damage per hit, down to 1.`,
  regen: (n) => `Start of turn: heal ${n}.`,
  push: (n) => `On hit, Knockback ${n}.`,
}

/** What boon `id` does at `level`. */
export function boonText(id: UtilityId, level = 1): string {
  const { text, adds } = UTILITIES[id]
  const n = amountOf(id, level)
  return [text, n > 0 ? ADDS[adds.to](n) : ''].filter(Boolean).join(' ')
}

/** A boon's name with its level past the first, as II or III. */
export const boonName = (id: UtilityId, level = 1) => `${UTILITIES[id].name}${level > 1 ? ` ${'I'.repeat(level)}` : ''}`



/** What the boons `held` add to the hero's stat `key`. */
export const boonStat = (held: Held[], key: keyof Stats | Rider) => held.reduce((sum, h) => sum + (UTILITIES[h.id].adds.to === key ? amountOf(h.id, h.level) : 0), 0)

/** Boons the hero holds at most and starts the run with; those a shop stocks, and what one costs. */
export const UTILITY_SLOTS = 3
export const SHOP_UTILITIES = 1
export const UTILITY_PRICE = 6

/** Boons offered at the run's start, of which the hero takes UTILITY_SLOTS. */
export const START_OFFERS = 5
