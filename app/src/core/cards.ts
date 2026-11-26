// Cards: every action the hero takes in battle. What each costs and does, and its text, at each level.
import type { Effect } from './battle'
import type { Rarity } from './base'
import type { ClassId } from './classes'
import { EFFECTS } from './gear'
import { RELICS, type RelicId } from './relics'
import type { Cancel, Flow } from './quantities'
import type { WeaponId } from './weapons'

/** A card in the deck: 1, or 2 once upgraded, its "+". */
export interface Card {
  id: CardId
  level: number
}

export type CardType = 'attack' | 'skill' | 'power'

/** A starting card is basic and never offered; the rest are drawn by rarity. */
export type CardRarity = Rarity | 'basic'

/** An amount, or the amount before an upgrade and after it. */
type Up = number | readonly [number, number]

interface Kind extends Flow {
  name: string
  type: CardType
  rarity: CardRarity
  /** The class it belongs to; any hero's without one. */
  cls?: ClassId
  cost: Up
  /** Damage each hit, and its hits. */
  damage?: Up
  hits?: Up
  /** Tiles it reaches; the weapon's reach without one. */
  range?: number
  /** Aliens within this many tiles of the target take the damage too. */
  area?: number
  /** Tiles the hero steps first, toward the target if it has one, else to the tile best placed for its weapon. */
  move?: Up
  /** Tiles the hero steps away from the aliens. */
  retreat?: Up
  knock?: Up
  pull?: Up
  burn?: Up
  chill?: Up
  mark?: Up
  /** The target, and every alien in its area, loses its next action, short of a boss. */
  stun?: true
  block?: Up
  armor?: Up
  heal?: Up
  draw?: Up
  energy?: Up
  /** Might: damage each of the hero's hits does more this battle. */
  might?: Up
  /** The effect a Power lends the hero for the battle, working as on gear or a relic. */
  lends?: Effect
  /** Text of the lent effect, read off its gear or relic when unset. */
  text?: string
  cloak?: true
  exhaust?: boolean | readonly [boolean, boolean]
  retain?: true
}

const gear = (id: keyof typeof EFFECTS) => ({ lends: id, text: EFFECTS[id].text, makes: EFFECTS[id].makes, reads: EFFECTS[id].reads })
/** A Power lending a relic's effect: its text and quantities are read off the relic when asked, below. */
const relic = (id: RelicId) => ({ relic: id })

const strike = (name: string, damage: Up, range?: number, more: Partial<Kind> = {}): Kind => ({ name, type: 'attack', rarity: 'basic', cost: 1, damage, range, ...more })

const cards = {
  // The weapons' Strikes, 4 in every starter deck.
  burst: strike('Burst Fire', [2, 3], undefined, { hits: 2 }),
  aimedShot: strike('Aimed Shot', [6, 9]),
  buckshot: strike('Buckshot', [5, 7], undefined, { knock: 1, makes: ['moved', 'impact'] }),
  spray: strike('Spray', 1, undefined, { hits: [4, 6], makes: ['shots'] }),
  suppress: strike('Suppressing Fire', [1, 2], undefined, { hits: 3, makes: ['shots'] }),
  twinShot: strike('Twin Shot', [2, 3], undefined, { hits: 2, makes: ['shots'] }),
  hammerBlow: strike('Hammer Blow', [5, 7], undefined, { area: 1 }),
  slash: strike('Slash', [6, 9]),
  shieldBash: strike('Shield Bash', [4, 5], undefined, { block: [3, 4], makes: ['armor'] }),
  jab: strike('Jab', [2, 3], undefined, { hits: 2, knock: 1, makes: ['shots', 'moved'] }),
  defend: { name: 'Defend', type: 'skill', rarity: 'basic', cost: 1, block: [5, 8] },
  dash: { name: 'Dash', type: 'skill', rarity: 'basic', cost: [1, 0], move: 3, draw: 1 },
  // Each class's signature card, 1 in its starter deck.
  heroicLeap: { name: 'Heroic Leap', type: 'attack', rarity: 'basic', cls: 'assault', cost: 2, move: [4, 5], damage: [5, 7], range: 1, area: 1, makes: ['moved'] },
  meteor: { name: 'Meteor Strike', type: 'attack', rarity: 'basic', cls: 'heavy', cost: 2, damage: [6, 9], range: 6, area: 1 },
  headshot: { name: 'Headshot', type: 'attack', rarity: 'basic', cls: 'sniper', cost: 2, damage: [10, 14], range: 10, mark: 1, makes: ['mark'] },
  healingLight: { name: 'Healing Light', type: 'skill', rarity: 'basic', cls: 'support', cost: 1, heal: [3, 5], block: 3, exhaust: true },
  droneStrike: { name: 'Drone Strike', type: 'attack', rarity: 'basic', cls: 'engineer', cost: 1, damage: [2, 3], hits: 3, range: 8, makes: ['shots'] },
  fireball: { name: 'Fireball', type: 'attack', rarity: 'basic', cls: 'pyro', cost: 2, damage: [4, 6], range: 6, area: 1, burn: 2, makes: ['burn'] },
  frostRay: { name: 'Frost Ray', type: 'attack', rarity: 'basic', cls: 'cryo', cost: 1, damage: [4, 6], range: 5, chill: 2, makes: ['chill'] },
  cloak: { name: 'Cloak', type: 'skill', rarity: 'basic', cls: 'phantom', cost: [1, 0], cloak: true, draw: 1 },
  // Attacks any hero may find.
  pointBlank: { name: 'Point Blank', type: 'attack', rarity: 'common', cost: 0, damage: [4, 6], range: 1 },
  rush: { name: 'Rush', type: 'attack', rarity: 'common', cost: 1, move: 3, damage: [5, 7], range: 1, makes: ['moved'] },
  shoulder: { name: 'Shoulder Charge', type: 'attack', rarity: 'common', cost: 1, move: 2, damage: [3, 5], range: 1, knock: 2, makes: ['moved', 'impact'] },
  grapple: { name: 'Grapple Shot', type: 'attack', rarity: 'common', cost: 1, damage: [3, 5], range: 6, pull: 3, makes: ['moved'] },
  concussive: { name: 'Concussive Blast', type: 'attack', rarity: 'common', cost: 1, damage: [4, 6], range: 4, knock: 2, makes: ['moved', 'impact'] },
  frag: { name: 'Frag Charge', type: 'attack', rarity: 'common', cost: 1, damage: [3, 5], range: 5, area: 1 },
  doubleTap: { name: 'Double Tap', type: 'attack', rarity: 'common', cost: 1, damage: [3, 4], hits: 2, makes: ['shots'] },
  calledShot: { name: 'Called Shot', type: 'attack', rarity: 'common', cost: 1, damage: [3, 5], mark: 2, makes: ['mark'] },
  napalmGrenade: { name: 'Napalm Burst', type: 'attack', rarity: 'common', cost: 2, damage: [3, 4], range: 5, area: 1, burn: [3, 4], makes: ['burn'] },
  cryoGrenade: { name: 'Cryo Burst', type: 'attack', rarity: 'common', cost: 1, damage: [2, 3], range: 5, area: 1, chill: 2, makes: ['chill'] },
  haymaker: { name: 'Haymaker', type: 'attack', rarity: 'common', cost: 2, damage: [11, 15], range: 1 },
  overcharged: { name: 'Overcharged Shot', type: 'attack', rarity: 'rare', cost: 2, damage: [11, 15], exhaust: true, makes: ['overkill'] },
  barrage: { name: 'Barrage', type: 'attack', rarity: 'rare', cost: 2, damage: [3, 4], hits: 4, range: 6, makes: ['shots'] },
  uppercut: { name: 'Uppercut', type: 'attack', rarity: 'rare', cost: 1, damage: [6, 8], range: 1, knock: 3, makes: ['moved', 'impact'] },
  seismic: { name: 'Seismic Slam', type: 'attack', rarity: 'rare', cost: 2, damage: [6, 8], range: 1, area: 2, stun: true },
  railgun: { name: 'Railgun', type: 'attack', rarity: 'epic', cost: 3, damage: [16, 22], range: 12, exhaust: true, makes: ['overkill'] },
  // Skills any hero may find.
  takeCover: { name: 'Take Cover', type: 'skill', rarity: 'common', cost: 1, retreat: 3, block: [4, 6] },
  shieldWall: { name: 'Shield Wall', type: 'skill', rarity: 'common', cost: 2, block: [12, 16] },
  reload: { name: 'Tactical Reload', type: 'skill', rarity: 'common', cost: [1, 0], draw: 2 },
  lure: { name: 'Lure', type: 'skill', rarity: 'common', cost: 0, range: 6, pull: [2, 3], makes: ['moved'] },
  plating: { name: 'Plating', type: 'skill', rarity: 'common', cost: 1, armor: [3, 5], makes: ['armor'] },
  jumpJets: { name: 'Jump Jets', type: 'skill', rarity: 'common', cost: 1, move: [5, 7], block: 3 },
  adrenaline: { name: 'Adrenaline', type: 'skill', rarity: 'rare', cost: 0, energy: [1, 2], draw: 2, exhaust: true },
  flashbang: { name: 'Flashbang', type: 'skill', rarity: 'rare', cost: 1, range: 5, area: 1, stun: true, exhaust: [true, false] },
  medkit: { name: 'Field Medic', type: 'skill', rarity: 'rare', cost: 1, heal: [4, 6], exhaust: true },
  // Powers any hero may find: each lends a gear or relic effect, so most make or read a combo quantity.
  hotLoads: { name: 'Hot Loads', type: 'power', rarity: 'common', cost: 1, might: [1, 2] },
  incendiary: { name: 'Incendiary Rounds', type: 'power', rarity: 'common', cost: [1, 0], ...gear('incendiary') },
  cryoRounds: { name: 'Cryo Payload', type: 'power', rarity: 'common', cost: [1, 0], ...gear('frostbite') },
  tracer: { name: 'Tracer Feed', type: 'power', rarity: 'common', cost: [1, 0], ...gear('tracer') },
  piercing: { name: 'Plasma Lance', type: 'power', rarity: 'common', cost: [1, 0], ...gear('piercing') },
  hollowPoint: { name: 'Hollow Points', type: 'power', rarity: 'common', cost: [1, 0], ...gear('executioner') },
  sapping: { name: 'Sapping Rounds', type: 'power', rarity: 'common', cost: [1, 0], ...gear('sapping') },
  shove: { name: 'Shove Rounds', type: 'power', rarity: 'common', cost: [1, 0], ...gear('shove') },
  stagger: { name: 'Stagger Rounds', type: 'power', rarity: 'common', cost: [1, 0], ...relic('stagger') },
  leech: { name: 'Leech Rounds', type: 'power', rarity: 'rare', cost: [2, 1], ...gear('vampiric') },
  bracing: { name: 'Reactive Bracing', type: 'power', rarity: 'rare', cost: [1, 0], ...gear('braced') },
  thunder: { name: 'Concussion Shells', type: 'power', rarity: 'rare', cost: [2, 1], ...gear('thunder') },
  grappleLine: { name: 'Grapple Line', type: 'power', rarity: 'rare', cost: [1, 0], ...gear('tether') },
  topple: { name: 'Topple Charges', type: 'power', rarity: 'rare', cost: [1, 0], ...gear('topple') },
  overkill: { name: 'Overkill Relay', type: 'power', rarity: 'rare', cost: [1, 0], ...relic('overkill') },
  impetus: { name: 'Impact Driver', type: 'power', rarity: 'rare', cost: [1, 0], ...relic('impetus') },
  brittle: { name: 'Brittle Rounds', type: 'power', rarity: 'rare', cost: [1, 0], ...relic('brittle') },
  glacial: { name: 'Frost Snare', type: 'power', rarity: 'rare', cost: [1, 0], ...relic('glacial') },
  spores: { name: 'Spore Rounds', type: 'power', rarity: 'rare', cost: [1, 0], ...relic('wildfire') },
  ricochet: { name: 'Ricochet Rounds', type: 'power', rarity: 'epic', cost: [2, 1], ...gear('ricochet') },
  volatile: { name: 'Volatile Rounds', type: 'power', rarity: 'epic', cost: [2, 1], ...gear('volatile') },
  thermal: { name: 'Thermal Shock Rounds', type: 'power', rarity: 'epic', cost: [2, 1], ...relic('thermal') },
  shatter: { name: 'Shatter Charge', type: 'power', rarity: 'epic', cost: [2, 1], ...relic('shatter') },
  lockOn: { name: 'Lock-On Beacon', type: 'power', rarity: 'epic', cost: [2, 1], ...relic('lockOn') },
  // Each class's own cards.
  charge: { name: 'Charge', type: 'attack', rarity: 'common', cls: 'assault', cost: 1, move: 4, damage: [6, 8], range: 1, knock: 1, makes: ['moved', 'impact'] },
  rally: { name: 'Rally', type: 'skill', rarity: 'rare', cls: 'assault', cost: 1, block: [6, 9], draw: 1 },
  groundSlam: { name: 'Ground Slam', type: 'attack', rarity: 'common', cls: 'heavy', cost: 2, damage: [5, 7], range: 1, area: 2, knock: 1, makes: ['moved', 'impact'] },
  ironHide: { name: 'Iron Hide', type: 'power', rarity: 'rare', cls: 'heavy', cost: [2, 1], ...relic('shell') },
  huntersMark: { name: "Hunter's Mark", type: 'attack', rarity: 'common', cls: 'sniper', cost: 0, damage: [1, 2], range: 10, mark: [2, 3], makes: ['mark'] },
  spotter: { name: 'Spotter Drone', type: 'power', rarity: 'rare', cls: 'sniper', cost: [1, 0], ...relic('spotter') },
  holyShield: { name: 'Holy Shield', type: 'skill', rarity: 'common', cls: 'support', cost: 1, block: [7, 10], armor: 1, makes: ['armor'] },
  blindingLight: { name: 'Blinding Light', type: 'skill', rarity: 'rare', cls: 'support', cost: 1, range: 4, area: 1, stun: true, exhaust: true },
  shockCoil: { name: 'Shock Coil', type: 'attack', rarity: 'common', cls: 'engineer', cost: 1, damage: [3, 4], range: 4, area: 1 },
  overclock: { name: 'Overclock', type: 'skill', rarity: 'rare', cls: 'engineer', cost: 0, energy: 2, exhaust: [true, false] },
  flameJet: { name: 'Flame Jet', type: 'attack', rarity: 'common', cls: 'pyro', cost: 1, damage: 2, hits: [2, 3], range: 3, burn: 1, makes: ['burn', 'shots'] },
  napalm: { name: 'Napalm Sprayer', type: 'power', rarity: 'rare', cls: 'pyro', cost: [1, 0], ...gear('bellows') },
  flashFreeze: { name: 'Flash Freeze', type: 'attack', rarity: 'common', cls: 'cryo', cost: 1, damage: [2, 3], range: 4, area: 1, chill: 2, makes: ['chill'] },
  conductor: { name: 'Cryo Coil', type: 'power', rarity: 'rare', cls: 'cryo', cost: [1, 0], ...relic('conductor') },
  backstab: { name: 'Backstab', type: 'attack', rarity: 'common', cls: 'phantom', cost: 1, damage: [8, 11], range: 1 },
  shadowStep: { name: 'Shadow Step', type: 'skill', rarity: 'rare', cls: 'phantom', cost: 0, move: [4, 6], retain: true },
} satisfies Record<string, Kind | (Omit<Kind, 'lends' | 'text' | 'makes' | 'reads'> & { relic: RelicId })>

// Relics import combat, which imports this module, so a relic is read only once everything has loaded.
for (const kind of Object.values(cards)) {
  if (!('relic' in kind)) continue
  const of = () => RELICS[kind.relic]
  Object.defineProperties(kind, {
    lends: { get: () => of().effect },
    text: { get: () => of().text },
    makes: { get: () => of().makes },
    reads: { get: () => of().reads },
    bridge: { get: () => of().bridge },
  })
}

export type CardId = keyof typeof cards
export const CARDS = cards as unknown as Record<CardId, Kind & { bridge?: Cancel }>
export const CARD_IDS = Object.keys(CARDS) as CardId[]

/** Each weapon's Strike. */
export const STRIKES: Record<WeaponId, CardId> = { rifle: 'burst', sniper: 'aimedShot', shotgun: 'buckshot', smg: 'spray', lmg: 'suppress', pistols: 'twinShot', hammer: 'hammerBlow', sword: 'slash', shield: 'shieldBash', fists: 'jab' }

/** Each class's signature card. */
export const SIGNATURES: Record<ClassId, CardId> = { assault: 'heroicLeap', heavy: 'meteor', sniper: 'headshot', support: 'healingLight', engineer: 'droneStrike', pyro: 'fireball', cryo: 'frostRay', phantom: 'cloak' }

/** Amount `of` card `id` at `level`: its upgraded amount from level 2. */
export function amount(id: CardId, level: number, of: keyof Kind): number {
  const value = CARDS[id][of] as Up | boolean | undefined
  if (value === undefined || value === false) return 0
  if (value === true) return 1
  return typeof value === 'number' ? value : value[level > 1 ? 1 : 0]
}

export const costOf = (card: Card) => amount(card.id, card.level, 'cost')
export const exhausts = (card: Card) => amount(card.id, card.level, 'exhaust') > 0

/** Whether the card is aimed at an alien: it hurts, moves, marks or stuns one. A move alone is aimed too, toward its target. */
export const aimed = (id: CardId) => {
  const k = CARDS[id]
  return !!(k.damage || k.knock || k.pull || k.mark || k.stun || k.burn || k.chill || (k.move && k.type === 'skill'))
}

/** A card's name, a + once upgraded. */
export const cardName = (id: CardId, level = 1) => `${CARDS[id].name}${level > 1 ? '+' : ''}`

/** What card `id` does at `level`, as its face says, action first. */
export function cardText(id: CardId, level = 1): string {
  const k = CARDS[id]
  const n = (of: keyof Kind) => amount(id, level, of)
  const hits = n('hits')
  const parts = [
    n('move') && `Move ${n('move')}.`,
    n('damage') && `Deal ${n('damage')} damage${hits > 1 ? ` ${hits} times` : ''}${k.area ? ` to the target and aliens within ${k.area}` : ''}.`,
    n('knock') && `Knockback ${n('knock')}.`,
    n('pull') && `Pull ${n('pull')}.`,
    n('burn') && `Apply ${n('burn')} Burn.`,
    n('chill') && `Apply ${n('chill')} Chill.`,
    n('mark') && `Apply ${n('mark')} Mark.`,
    k.stun && (k.area && !n('damage') ? `Stun the target and aliens within ${k.area}.` : 'Stun.'),
    n('retreat') && `Retreat ${n('retreat')}.`,
    n('block') && `Gain ${n('block')} Block.`,
    n('armor') && `Gain ${n('armor')} Armor.`,
    n('heal') && `Heal ${n('heal')}.`,
    k.cloak && 'Cloak.',
    n('energy') && `Gain ${n('energy')} Energy.`,
    n('draw') && `Draw ${n('draw')}.`,
    n('might') && `Gain ${n('might')} Might.`,
    k.text,
    k.retain && 'Retain.',
    n('exhaust') && 'Exhaust.',
  ]
  return parts.filter(Boolean).join(' ')
}
