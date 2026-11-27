// Alien kinds: their stats, stances and powers, and the packs they muster in.
import { BASE_STATS, type Stance, type Stats } from './battle'
import { TUNING } from './tuning'
import type { Resist } from './quantities'
import { randomInt } from './rng'

/** Alien turns after an incubator is seen before it hatches. */
export const HATCH_TURNS = 4
/** Health a regenerator heals each turn it is not burning. */
export const REGEN_HEAL = 3
/** Alien turns between a hive node's swarmlings. */
export const NODE_EVERY = 2
/** Swarmlings a hive node has in it. */
export const NODE_SPAWNS = 4
/** Tiles a leaper's pounce reaches; what a dreadhorn's ram adds; the most a kinhound's pack adds. */
export const POUNCE_REACH = 9
export const RAM_DAMAGE = 2
export const PACK_MAX = 3
/** Plates a juggernaut has over its equipment's armor. */
const PLATES = 3

/** The kinds of alien. Each fights by a rule no soldier has; combat applies the rules, and `text` states them. */
export type AlienKind =
  | 'trooper'
  | 'swarmling'
  | 'spitter'
  | 'burster'
  | 'brute'
  | 'psion'
  | 'juggernaut'
  | 'incubator'
  | 'wraith'
  | 'burrower'
  | 'feeder'
  | 'regenerator'
  | 'sprinter'
  | 'hiveNode'
  | 'mirror'
  | 'turret'
  | 'harvester'
  | 'husk'
  | 'leaper'
  | 'vise'
  | 'dreadhorn'
  | 'aegis'
  | 'kinhound'
  | 'zealot'

/** How much of a threat an alien is, as the map tells it before the fight. */
export const DANGERS = ['small', 'medium', 'large'] as const
type Danger = (typeof DANGERS)[number]

interface AlienType {
  name: string
  text: string
  danger: Danger
  /** What the hero sees the first time one appears: a calm line on what it will do. Only for kinds met later on. */
  intro?: string
  /** Whether it spawns swarmlings. */
  spawns?: boolean
  /** Its health as a multiple of a soldier's base health. It never grows. */
  hp: number
  /** Stats it has in place of the base stats. */
  stats: Partial<Stats>
  stance: Stance
  resists: Resist[]
}

export const ALIENS: Record<AlienKind, AlienType> = {
  trooper: { name: 'Grunt', text: 'Shoots from range. Picks its ground.', danger: 'small', hp: 1, stats: { strength: 2, jump: 2 }, stance: 'balanced', resists: [] },
  swarmling: {
    name: 'Swarmling',
    text: 'Frail and fast. Melee only. Comes in numbers.',
    danger: 'small',
    hp: 0.4,
    stats: { range: 1, move: 6, damage: 2, strength: 1, jump: 3 },
    stance: 'rush',
    resists: [],
  },
  spitter: {
    name: 'Spitter',
    text: 'Spit leaves acid on the tile. Acid hurts whoever stays on it after their side moves.',
    danger: 'medium',
    hp: 0.8,
    stats: { range: 6, strength: 1, jump: 2 },
    stance: 'balanced',
    resists: ['armor'],
  },
  burster: {
    name: 'Burster',
    text: 'Runs at you and explodes when adjacent or killed, hurting everything near.',
    danger: 'medium',
    hp: 0.6,
    stats: { range: 0, move: 5, strength: 1, jump: 2 },
    stance: 'rush',
    resists: ['burn'],
  },
  brute: {
    name: 'Brute',
    text: 'Tough. Melee only. When hit and alive, it charges the attacker.',
    danger: 'large',
    hp: 2,
    stats: { range: 1, move: 3, damage: 5, strength: 4, jump: 2 },
    stance: 'rush',
    resists: ['chill'],
  },
  psion: {
    name: 'Psion',
    text: 'Applies Panic to the hardest hitter in reach. On death, hurts nearby aliens.',
    danger: 'medium',
    hp: 0.8,
    stats: { damage: 2, strength: 1, jump: 2 },
    stance: 'standoff',
    resists: ['mark'],
  },
  juggernaut: {
    name: 'Juggernaut',
    text: `${PLATES} plates over its Armor. While plated, each hit breaks only 1 plate.`,
    intro: 'Heavy plating. Every hit chips off one plate, no matter how hard it lands.',
    danger: 'large',
    hp: 1.4,
    stats: { armor: PLATES, move: 3, damage: 4, range: 4, strength: 5, jump: 1 },
    stance: 'rush',
    resists: [],
  },
  incubator: {
    name: 'Incubator',
    text: `Does nothing. Hatches into 2 Brutes ${HATCH_TURNS} alien turns after it is seen.`,
    intro: 'Something is growing in there. We have four turns, maybe less.',
    danger: 'medium',
    hp: 1.6,
    stats: { move: 0, range: 0, damage: 0, strength: 3, jump: 0 },
    stance: 'anchor',
    resists: [],
  },
  wraith: {
    name: 'Wraith',
    text: 'Only Crits deal full damage. Other hits deal 1.',
    intro: 'Only half here. Ordinary blows pass straight through. A critical hit might not.',
    danger: 'medium',
    hp: 0.6,
    stats: { range: 6, strength: 1, jump: 4 },
    stance: 'standoff',
    resists: [],
  },
  burrower: {
    name: 'Burrower',
    text: 'Moves underground, unseen. Surfaces adjacent to you when you come near or the fight starts.',
    intro: 'Tremors underfoot. It will come up beside whoever stands alone.',
    danger: 'medium',
    hp: 1,
    stats: { range: 1, move: 4, damage: 5, strength: 3, jump: 1 },
    stance: 'rush',
    resists: [],
  },
  feeder: {
    name: 'Feeder',
    text: 'While in sight, gains 1 damage each time you use a per-battle power or class ability.',
    intro: 'It feeds on our tricks. Every one we pull, it grows.',
    danger: 'medium',
    hp: 1.2,
    stats: { damage: 2, strength: 2, jump: 3 },
    stance: 'balanced',
    resists: [],
  },
  regenerator: {
    name: 'Regenerator',
    text: `Start of turn: unless Burning, heal ${REGEN_HEAL}.`,
    intro: 'Its wounds close as we watch. Fire seems to stop that.',
    danger: 'medium',
    hp: 1.4,
    stats: { strength: 3, jump: 2 },
    stance: 'balanced',
    resists: [],
  },
  sprinter: {
    name: 'Sprinter',
    text: 'Very fast. Melee only. Chilled, it cannot move.',
    intro: 'Fast. Very fast. It will be on us before we blink, unless something slows it.',
    danger: 'small',
    hp: 0.7,
    stats: { range: 1, move: 9, damage: 4, strength: 1, jump: 5 },
    stance: 'rush',
    resists: [],
  },
  hiveNode: {
    name: 'Hive Node',
    text: `Never moves or shoots. Spawns a Swarmling every ${NODE_EVERY} alien turns, up to ${NODE_SPAWNS}.`,
    intro: 'A living nest, full of swarmlings. Kill it before it empties.',
    danger: 'large',
    hp: 1.5,
    stats: { move: 0, range: 0, damage: 0, strength: 0, jump: 0 },
    stance: 'anchor',
    spawns: true,
    resists: [],
  },
  mirror: {
    name: 'Mirror',
    text: 'Its hits deal your damage, if higher.',
    intro: 'It studies our strongest. However hard they hit, it hits back.',
    danger: 'large',
    hp: 1,
    stats: { strength: 3, jump: 3 },
    stance: 'balanced',
    resists: [],
  },
  turret: {
    name: 'Turret',
    text: 'Automated gun. Never moves. Shoots anyone in range and sight.',
    intro: 'An automated gun. It will not move, so do not stand in its sights.',
    danger: 'medium',
    hp: 1.5,
    stats: { move: 0, range: 7, damage: 4, strength: 0, jump: 0 },
    stance: 'anchor',
    resists: [],
  },
  harvester: {
    name: 'Harvester',
    text: 'Fast. Melee only. Civilians it kills rise as Husks.',
    intro: 'It is not killing them. It is harvesting them. Whoever it takes gets back up, on its side.',
    danger: 'medium',
    hp: 1,
    stats: { range: 1, move: 7, damage: 4, strength: 2, jump: 4 },
    stance: 'rush',
    resists: [],
  },
  husk: {
    name: 'Husk',
    text: 'A risen civilian. Frail. Melee only.',
    danger: 'small',
    hp: 0.5,
    stats: { range: 1, move: 4, damage: 2, strength: 1, jump: 1 },
    stance: 'rush',
    resists: [],
  },
  leaper: {
    name: 'Leaper',
    text: `Melee only. Once a battle, pounces up to ${POUNCE_REACH} tiles over walls onto whoever shoots farthest.`,
    intro: 'It does not come through the front line. It comes over it, for whoever hangs back.',
    danger: 'medium',
    hp: 0.8,
    stats: { range: 1, move: 5, damage: 3, strength: 1, jump: 6 },
    stance: 'rush',
    resists: [],
  },
  vise: {
    name: 'Vise',
    text: 'Melee only. Its hit Roots.',
    intro: 'Claws like a clamp. Whoever it grabs is going nowhere.',
    danger: 'medium',
    hp: 1.2,
    stats: { range: 1, move: 3, damage: 3, strength: 3, jump: 1 },
    stance: 'rush',
    resists: [],
  },
  dreadhorn: {
    name: 'Dreadhorn',
    text: `Melee only. If it moved, its hit deals ${RAM_DAMAGE} more damage and Knockback 2.`,
    intro: 'It needs a run-up. Meet it before it gets one, and keep away from the edge.',
    danger: 'large',
    hp: 1.6,
    stats: { range: 1, move: 5, damage: 4, strength: 5, jump: 1 },
    stance: 'rush',
    resists: [],
  },
  aegis: {
    name: 'Aegis',
    text: 'Melee only. Its shield halves every hit but adjacent ones.',
    intro: 'A living shield. Shots glance off; someone has to get in close.',
    danger: 'medium',
    hp: 1.2,
    stats: { range: 1, move: 3, damage: 3, strength: 3, jump: 1 },
    stance: 'rush',
    resists: [],
  },
  kinhound: {
    name: 'Kinhound',
    text: `Fast. Melee only. Each other alien adjacent to its target adds 1 damage, up to ${PACK_MAX}.`,
    danger: 'small',
    hp: 0.6,
    stats: { range: 1, move: 6, damage: 2, strength: 2, jump: 3 },
    stance: 'rush',
    resists: [],
  },
  zealot: {
    name: 'Zealot',
    text: 'Melee only. Each quarter of its HP lost adds 1 damage.',
    intro: 'Wounding it only makes it angrier. Finish what you start.',
    danger: 'medium',
    hp: 1.2,
    stats: { range: 1, move: 4, damage: 3, strength: 3, jump: 2 },
    stance: 'rush',
    resists: [],
  },
}

/** Whether a kind fights only up close. */
export const melee = (kind: AlienKind) => (ALIENS[kind].stats.range ?? BASE_STATS.range) <= 1 && (ALIENS[kind].stats.move ?? 1) > 0

/**
 * An alien's stats: its kind's, with the equipment given. A kind's health is the same all game; what grows is its
 * armor, which shows as armor pips, and its weapon, each step of which adds a point of damage.
 * A burster has no weapon to improve.
 */
export function alienStats(kind: AlienKind, armor: number, weapon: number): Stats {
  const stats = { ...BASE_STATS, ...ALIENS[kind].stats }
  const armed = kind === 'burster' ? 0 : weapon
  return { ...stats, hp: Math.max(1, Math.round(BASE_STATS.hp * ALIENS[kind].hp * TUNING.alienHp)), armor: armor + (ALIENS[kind].stats.armor ?? 0), damage: Math.max(1, Math.round(stats.damage * TUNING.alienDamage)) + armed, crit: 0 }
}

/** A themed handful of aliens a mission's force buys together. */
export interface Pack {
  kinds: AlienKind[]
  /** What it costs of a mission's force. */
  cost: number
  /** The depth along the road at which it first appears. */
  from: number
}

export const PACKS: Pack[] = [
  { kinds: ['trooper'], cost: 1, from: 0 },
  { kinds: ['kinhound', 'kinhound', 'kinhound'], cost: 2, from: 0 },
  { kinds: ['swarmling', 'swarmling', 'swarmling', 'swarmling'], cost: 2, from: 0 },
  { kinds: ['zealot', 'swarmling', 'swarmling'], cost: 2, from: 0 },
  { kinds: ['vise', 'zealot'], cost: 2, from: 0 },
  { kinds: ['spitter', 'swarmling', 'swarmling'], cost: 2, from: 0 },
  { kinds: ['trooper', 'swarmling', 'swarmling'], cost: 2, from: 0 },
  { kinds: ['aegis', 'spitter'], cost: 3, from: 1 },
  { kinds: ['spitter', 'kinhound', 'kinhound'], cost: 3, from: 2 },
  { kinds: ['burster', 'burster', 'swarmling', 'swarmling'], cost: 3, from: 2 },
  { kinds: ['brute', 'swarmling', 'swarmling'], cost: 3, from: 2 },
  { kinds: ['leaper', 'leaper'], cost: 3, from: 2 },
  { kinds: ['dreadhorn', 'kinhound', 'kinhound'], cost: 3, from: 2 },
  { kinds: ['aegis', 'aegis', 'spitter'], cost: 3, from: 2 },
  { kinds: ['brute', 'spitter'], cost: 3, from: 3 },
  { kinds: ['psion', 'vise', 'aegis'], cost: 4, from: 3 },
  { kinds: ['brute', 'brute', 'burster'], cost: 5, from: 4 },
  { kinds: ['burrower', 'burrower'], cost: 3, from: 1 },
  { kinds: ['sprinter', 'sprinter', 'sprinter'], cost: 3, from: 1 },
  { kinds: ['juggernaut', 'aegis'], cost: 3, from: 2 },
  { kinds: ['incubator', 'swarmling', 'swarmling'], cost: 3, from: 2 },
  { kinds: ['regenerator', 'regenerator'], cost: 3, from: 2 },
  { kinds: ['wraith', 'wraith'], cost: 3, from: 3 },
  { kinds: ['feeder', 'zealot', 'kinhound'], cost: 3, from: 3 },
  { kinds: ['hiveNode', 'vise'], cost: 3, from: 3 },
  { kinds: ['mirror', 'zealot'], cost: 3, from: 4 },
  { kinds: ['turret', 'vise'], cost: 3, from: 1 },
]

/** The packs a mission of the given force sends, at the given depth: random picks that the force can pay for. */
export function muster(rng: { rng: number }, force: number, depth: number): Pack[] {
  const packs: Pack[] = []
  const open = PACKS.filter((pack) => pack.from <= depth)
  let left = force
  while (left > 0) {
    // A lone scout is the last resort, so a force is mostly themed packs.
    const affordable = open.filter((pack) => pack.cost <= left && (pack.cost > 1 || left === 1))
    const pack = affordable[randomInt(rng, affordable.length)]
    left -= pack.cost
    packs.push(pack)
  }
  return packs
}
