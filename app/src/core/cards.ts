// Cards: the field kit the hero's deck holds, one played each battle; what each does at each level.
import type { Effect, Stats } from './battle'
import type { Rarity } from './base'
import { EFFECTS } from './gear'
import { PERKS } from './perks'
import { RELICS, type RelicId } from './relics'
import { SPRINT } from './challenges'
import type { Cancel, Flow, Quantity } from './quantities'

/** A card in the deck, at its level: 1, or 2 once upgraded. Fused, it plays a level higher. */
export interface Card {
  id: CardId
  level: number
  /** Fused away: out of the deck until the next leg. */
  out?: boolean
}

/** The highest level a card plays at: upgraded, then fused. */
export const MAX_LEVEL = 3

/** What a card adds that is no stat: damage each hit on the hero loses, health it heals a turn, tiles Force Gauntlet drives, Temp HP it lands with. */
export const RIDERS = ['guard', 'regen', 'push', 'temp'] as const
export type Rider = (typeof RIDERS)[number]

/** What on the board a card plays to, which its line on the deploy screen counts. */
export type Sign = keyof Stats | Rider | Quantity | 'pierce' | 'ranged' | 'melee' | 'hover' | 'landing' | 'rescue' | 'hold' | 'extract' | 'boss'

/** A starting card is basic and never offered; the rest are drawn by rarity. */
export type CardRarity = Rarity | 'basic'

interface Kind extends Flow {
  name: string
  rarity: CardRarity
  /** The effects it lends the hero, each working as on gear, a skill or a relic. */
  lends: Effect[]
  /** What it adds at levels 1, 2 and 3, to a stat or a rider. */
  adds: { to: keyof Stats | Rider; by: readonly [number, number, number] }
  /** What its lent effects do, apart from what it adds. */
  text?: string
  /** What it plays to, when that is not the first quantity it makes or reads, else what it adds to. */
  shows?: Sign
}

/** A card lending a relic's effect: the fields it shares with the relic are read off it when asked, below. */
type FromRelic = Omit<Kind, 'lends' | 'text' | 'makes' | 'reads'> & { relic: RelicId }

const gear = (id: keyof typeof EFFECTS) => ({ lends: [id], text: EFFECTS[id].text, makes: EFFECTS[id].makes, reads: EFFECTS[id].reads })
const relic = (id: RelicId) => ({ relic: id })
const damage = { to: 'damage', by: [1, 2, 3] } as const
const armor = { to: 'armor', by: [2, 3, 5] } as const
const move = { to: 'move', by: [1, 2, 3] } as const

const cards = {
  hotLoads: { name: 'Hot Loads', rarity: 'basic', lends: [], adds: { to: 'damage', by: [1, 2, 3] } },
  fieldPlating: { name: 'Field Plating', rarity: 'basic', lends: [], adds: { to: 'armor', by: [2, 3, 4] }, makes: ['armor'] },
  medPatch: { name: 'Med Patch', rarity: 'basic', lends: [], adds: { to: 'temp', by: [3, 5, 7] } },
  sprint: { name: 'Sprint Servos', rarity: 'basic', lends: [], adds: { to: 'move', by: [1, 2, 3] } },
  scope: { name: 'Spotting Scope', rarity: 'basic', lends: [], adds: { to: 'range', by: [1, 2, 3] } },
  steady: { name: 'Steady Aim', rarity: 'basic', lends: [], adds: { to: 'crit', by: [0.1, 0.15, 0.2] }, makes: ['crit'] },
  plasma: { name: 'Plasma Lance', rarity: 'common', ...gear('piercing'), adds: { to: 'damage', by: [1, 2, 3] }, shows: 'pierce' },
  plating: { name: 'Kinetic Plating', rarity: 'common', lends: [], adds: { to: 'armor', by: [3, 5, 7] }, makes: ['armor'] },
  nanoweave: { name: 'Nanoweave', rarity: 'common', lends: [], adds: { to: 'temp', by: [4, 7, 10] } },
  afterburner: { name: 'Afterburners', rarity: 'common', lends: [], adds: { to: 'move', by: [SPRINT, SPRINT + 1, SPRINT + 2] } },
  longshot: { name: 'Longshot Optics', rarity: 'common', lends: [], adds: { to: 'range', by: [2, 3, 4] } },
  regen: { name: 'Regen Gel', rarity: 'common', lends: [], adds: { to: 'regen', by: [1, 2, 3] } },
  incendiary: { name: 'Incendiary Rounds', rarity: 'common', ...gear('incendiary'), adds: damage },
  cryo: { name: 'Cryo Payload', rarity: 'common', ...gear('frostbite'), adds: damage },
  hollowPoint: { name: 'Hollow Points', rarity: 'common', ...gear('executioner'), adds: damage },
  tracer: { name: 'Tracer Feed', rarity: 'common', ...gear('tracer'), adds: damage },
  ablative: { name: 'Ablative Field', rarity: 'common', lends: [], adds: { to: 'guard', by: [1, 2, 3] } },
  deflector: { name: 'Deflector Screen', rarity: 'common', lends: ['rangedShield'], text: 'Take half damage from ranged hits, rounded up.', adds: { to: 'armor', by: [0, 2, 4] }, shows: 'ranged' },
  riot: { name: 'Riot Shield', rarity: 'common', lends: ['meleeShield'], text: 'Take half damage from melee hits and blasts, rounded up.', adds: { to: 'armor', by: [0, 2, 4] }, shows: 'melee' },
  cadence: { name: 'Cadence Driver', rarity: 'common', ...gear('cadence'), adds: damage, shows: 'shots' },
  snare: { name: 'Snare Rounds', rarity: 'common', ...gear('snare'), adds: damage, shows: 'melee' },
  grapple: { name: 'Grapple Line', rarity: 'common', ...gear('tether'), adds: damage },
  stagger: { name: 'Stagger Rounds', rarity: 'common', ...relic('stagger'), adds: damage },
  breach: { name: 'Breaching Charge', rarity: 'common', ...relic('charges'), adds: damage, shows: 'landing' },
  cryoBurst: { name: 'Frost Burst', rarity: 'common', ...relic('cryo'), adds: damage, shows: 'landing' },
  barricade: { name: 'Pop-up Cover', rarity: 'common', ...relic('bulwark'), adds: armor, shows: 'landing' },
  shell: { name: 'Reactive Weave', rarity: 'common', ...relic('shell'), adds: armor },
  evac: { name: 'Evac Line', rarity: 'common', ...relic('beacon'), adds: move, shows: 'rescue' },
  liftFlare: { name: 'Lift Flare', rarity: 'common', ...relic('flare'), adds: move, shows: 'extract' },
  uplinkSpike: { name: 'Uplink Spike', rarity: 'common', ...relic('relay'), adds: armor, shows: 'hold' },
  sentinel: { name: 'Sentinel Mode', rarity: 'common', ...relic('sentinel'), adds: armor, shows: 'melee' },
  opener: { name: 'Opening Shot', rarity: 'common', ...relic('capacitor'), adds: damage },
  overcharge: { name: 'Overcharged Cell', rarity: 'rare', ...gear('arc'), adds: { to: 'crit', by: [0.15, 0.25, 0.35] }, makes: ['crit'] },
  leech: { name: 'Leech Rounds', rarity: 'rare', ...gear('vampiric'), adds: { to: 'temp', by: [2, 4, 6] } },
  bracing: { name: 'Reactive Bracing', rarity: 'rare', ...gear('braced'), adds: armor },
  hoverPack: { name: 'Hover Pack', rarity: 'rare', lends: ['hover'], text: 'Cross mire, cliffs and steep ground at no extra cost. Float over chasms and water.', adds: { to: 'move', by: [0, 1, 2] }, shows: 'hover' },
  gravBoots: { name: 'Grav Boots', rarity: 'rare', ...gear('lofty'), adds: { to: 'jump', by: [1, 2, 3] }, shows: 'jump' },
  jumpJets: { name: 'Jump Jets', rarity: 'rare', lends: ['crashLanding'], text: PERKS.crashLanding.text, adds: { to: 'span', by: [1, 2, 3] } },
  gauntlet: { name: 'Force Gauntlet', rarity: 'rare', lends: ['repulse'], adds: { to: 'push', by: [2, 3, 4] }, makes: ['moved', 'impact'] },
  thermite: { name: 'Thermite Rams', rarity: 'rare', lends: ['shove', 'kiln'], text: `${EFFECTS.shove.text} ${EFFECTS.kiln.text}`, makes: ['moved', 'impact', 'burn'], reads: ['impact'], adds: damage },
  cryoRams: { name: 'Cryo Rams', rarity: 'rare', lends: ['shove', 'quench'], text: `${EFFECTS.shove.text} ${EFFECTS.quench.text}`, makes: ['moved', 'impact', 'chill'], reads: ['impact'], adds: damage },
  suppression: { name: 'Suppression Scope', rarity: 'rare', ...gear('sapping'), adds: { to: 'range', by: [1, 2, 3] }, shows: 'ranged' },
  napalm: { name: 'Napalm Sprayer', rarity: 'rare', ...gear('bellows'), adds: damage, shows: 'burn' },
  topple: { name: 'Topple Charges', rarity: 'rare', ...gear('topple'), adds: damage },
  booming: { name: 'Shock Primer', rarity: 'rare', ...gear('booming'), adds: damage },
  twinned: { name: 'Twin Feed', rarity: 'rare', ...gear('twinned'), adds: damage },
  overkill: { name: 'Overkill Relay', rarity: 'rare', ...relic('overkill'), adds: damage },
  spotter: { name: 'Spotter Drone', rarity: 'rare', ...relic('spotter'), adds: damage },
  impetus: { name: 'Impact Driver', rarity: 'rare', ...relic('impetus'), adds: damage },
  shredder: { name: 'Shred Burst', rarity: 'rare', ...relic('shredder'), adds: damage, shows: 'landing' },
  turret: { name: 'Turret Kit', rarity: 'rare', ...relic('turrets'), adds: armor, shows: 'landing' },
  dropPod: { name: 'Drop Pod', rarity: 'rare', ...relic('encore'), adds: damage, shows: 'landing' },
  hunger: { name: 'Hunger Rounds', rarity: 'rare', ...relic('nanites'), adds: damage },
  lodestone: { name: 'Lodestone Coil', rarity: 'rare', ...relic('lodestone'), adds: armor },
  ram: { name: 'Ram Spikes', rarity: 'rare', ...relic('ram'), adds: armor },
  bounty: { name: 'Hunter Rounds', rarity: 'rare', ...relic('bounty'), adds: damage, shows: 'boss' },
  glacial: { name: 'Frost Snare', rarity: 'rare', ...relic('glacial'), adds: damage },
  brittle: { name: 'Brittle Rounds', rarity: 'rare', ...relic('brittle'), adds: damage },
  adrenal: { name: 'Adrenal Shot', rarity: 'rare', ...relic('adrenal'), adds: damage, shows: 'boss' },
  domino: { name: 'Domino Shells', rarity: 'rare', ...relic('domino'), adds: damage },
  conductor: { name: 'Cryo Coil', rarity: 'rare', ...relic('conductor'), adds: damage },
  spores: { name: 'Spore Rounds', rarity: 'rare', ...relic('wildfire'), adds: damage },
  concussion: { name: 'Concussion Shells', rarity: 'epic', ...gear('thunder'), adds: damage },
  chain: { name: 'Chain Trigger', rarity: 'epic', ...gear('chain'), adds: damage },
  ricochet: { name: 'Ricochet Rounds', rarity: 'epic', ...gear('ricochet'), adds: damage, shows: 'shots' },
  volatile: { name: 'Volatile Rounds', rarity: 'epic', ...gear('volatile'), adds: damage },
  thermal: { name: 'Thermal Shock Rounds', rarity: 'epic', ...relic('thermal'), adds: damage },
  shatter: { name: 'Shatter Charge', rarity: 'epic', ...relic('shatter'), adds: damage },
  lockOn: { name: 'Lock-On Beacon', rarity: 'epic', ...relic('lockOn'), adds: damage },
  accelerant: { name: 'Accelerant Canister', rarity: 'epic', ...relic('accelerant'), adds: damage },
  split: { name: 'Split Barrel', rarity: 'epic', ...relic('split'), adds: damage },
  phoenix: { name: 'Revival Stim', rarity: 'epic', ...relic('phoenix'), adds: { to: 'temp', by: [2, 4, 6] }, shows: 'temp' },
} satisfies Record<string, Kind | FromRelic>

// Relics import combat, which imports this module, so a relic is read only once everything has loaded.
for (const kind of Object.values(cards)) {
  if (!('relic' in kind)) continue
  const of = () => RELICS[kind.relic]
  Object.defineProperties(kind, {
    lends: { get: () => [of().effect!] },
    text: { get: () => of().text },
    makes: { get: () => of().makes },
    reads: { get: () => of().reads },
    bridge: { get: () => of().bridge },
  })
}

export type CardId = keyof typeof cards
export const CARDS = cards as unknown as Record<CardId, Kind & { bridge?: Cancel }>
export const CARD_IDS = Object.keys(CARDS) as CardId[]

/** What a card plays to: its own sign, else the first quantity it makes or reads, else what it adds to. */
export const signOf = (id: CardId): Sign => CARDS[id].shows ?? CARDS[id].makes?.[0] ?? CARDS[id].reads?.[0] ?? CARDS[id].adds.to

/** What card `id` adds at `level`. */
export const amountOf = (id: CardId, level: number) => CARDS[id].adds.by[Math.min(level, MAX_LEVEL) - 1]

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
  temp: (n) => `Start of battle: gain ${n} Temp HP.`,
}

/** What card `id` does at `level`. */
export function cardText(id: CardId, level = 1): string {
  const { text, adds } = CARDS[id]
  const n = amountOf(id, level)
  return [text, n > 0 ? ADDS[adds.to](n) : ''].filter(Boolean).join(' ')
}

/** A card's name, a + for each level past the first. */
export const cardName = (id: CardId, level = 1) => `${CARDS[id].name}${'+'.repeat(Math.max(0, level - 1))}`

/** What the card `played` adds to the hero's stat or rider `key`. */
export const cardStat = (played: Card | null, key: keyof Stats | Rider) => (played && CARDS[played.id].adds.to === key ? amountOf(played.id, played.level) : 0)
