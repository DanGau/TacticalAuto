// Alien kinds: their stats, stances and powers, and the packs they muster in.
import { BASE_STATS, type Stance, type Stats } from './battle'
import { TUNING } from './tuning'
import type { Resist } from './keywords'
import { randomInt } from './rng'

/** Alien turns after an incubator is seen before it hatches. */
export const HATCH_TURNS = 4
/** Health a regenerator heals each turn it is not burning. */
export const REGEN_HEAL = 3
/** Alien turns between a hive node's swarmlings. */
export const NODE_EVERY = 2
/** Swarmlings a hive node has in it. */
export const NODE_SPAWNS = 4
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

/** How much of a threat an alien is, as the map tells it before the fight. */
export const DANGERS = ['small', 'medium', 'large'] as const
type Danger = (typeof DANGERS)[number]

interface AlienType {
  name: string
  text: string
  danger: Danger
  /** What the squad sees the first time one appears: a calm line on what it will do. Only for kinds met later on. */
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
  trooper: { name: 'Grunt', text: 'Shoots from range, picking its ground', danger: 'small', hp: 1, stats: {}, stance: 'balanced', resists: [] },
  swarmling: {
    name: 'Swarmling',
    text: 'Weak and fast; attacks only up close, and comes in numbers',
    danger: 'small',
    hp: 0.4,
    stats: { range: 1, move: 6, damage: 2 },
    stance: 'rush',
    resists: [],
  },
  spitter: {
    name: 'Spitter',
    text: 'Its spit leaves acid on the tile, which burns whoever is still in it after their side moves',
    danger: 'medium',
    hp: 0.8,
    stats: { range: 6 },
    stance: 'balanced',
    resists: ['ward'],
  },
  burster: {
    name: 'Burster',
    text: 'Runs at the squad and explodes, beside a soldier or wherever it dies, hurting everything near it',
    danger: 'medium',
    hp: 0.6,
    stats: { range: 0, move: 5 },
    stance: 'rush',
    resists: ['burn'],
  },
  brute: {
    name: 'Brute',
    text: 'Tough, and attacks only up close; each hit it survives sends it charging at the shooter',
    danger: 'large',
    hp: 2,
    stats: { range: 1, move: 3, damage: 5 },
    stance: 'rush',
    resists: ['frost'],
  },
  psion: {
    name: 'Psion',
    text: 'Panics a soldier, who loses a turn of action; when it dies, the aliens of its pod are hurt',
    danger: 'medium',
    hp: 0.8,
    stats: { damage: 2 },
    stance: 'standoff',
    resists: ['mark'],
  },
  juggernaut: {
    name: 'Juggernaut',
    text: `Plated: while it has armor, each hit is stopped whole and costs it one plate, however hard. It has ${PLATES} plates over its armor`,
    intro: 'Heavy plating. Every hit chips off one plate, no matter how hard it lands.',
    danger: 'large',
    hp: 1.4,
    stats: { armor: PLATES, move: 3, damage: 4, range: 4 },
    stance: 'rush',
    resists: [],
  },
  incubator: {
    name: 'Incubator',
    text: `Does nothing; ${HATCH_TURNS} alien turns after it is seen, it hatches into two Brutes`,
    intro: 'Something is growing in there. We have four turns, maybe less.',
    danger: 'medium',
    hp: 1.6,
    stats: { move: 0, range: 0, damage: 0 },
    stance: 'anchor',
    resists: [],
  },
  wraith: {
    name: 'Wraith',
    text: 'Only a crit hurts it in full; any other damage does 1',
    intro: 'Only half here. Ordinary rounds pass straight through. A clean, critical hit might not.',
    danger: 'medium',
    hp: 0.6,
    stats: { range: 6 },
    stance: 'standoff',
    resists: [],
  },
  burrower: {
    name: 'Burrower',
    text: 'Moves underground, unseen; once the squad comes near or the fight is on, it surfaces beside the soldier standing most alone, and attacks up close',
    intro: 'Tremors underfoot. It will come up beside whoever stands alone.',
    danger: 'medium',
    hp: 1,
    stats: { range: 1, move: 4, damage: 5 },
    stance: 'rush',
    resists: [],
  },
  feeder: {
    name: 'Feeder',
    text: 'Gains 1 damage each time a soldier uses its class ability, a grenade, or a once-per-battle effect, while it is in sight',
    intro: 'It feeds on our tricks. Every one we pull, it grows.',
    danger: 'medium',
    hp: 1.2,
    stats: { damage: 2 },
    stance: 'balanced',
    resists: [],
  },
  regenerator: {
    name: 'Regenerator',
    text: `Heals ${REGEN_HEAL} each turn it is not burning`,
    intro: 'Its wounds close as we watch. Fire seems to stop that.',
    danger: 'medium',
    hp: 1.4,
    stats: {},
    stance: 'balanced',
    resists: [],
  },
  sprinter: {
    name: 'Sprinter',
    text: 'Very fast, and attacks up close; while chilled it cannot move at all',
    intro: 'Fast. Very fast. It will be on us before we blink, unless something slows it.',
    danger: 'small',
    hp: 0.7,
    stats: { range: 1, move: 9, damage: 4 },
    stance: 'rush',
    resists: [],
  },
  hiveNode: {
    name: 'Hive Node',
    text: `Never moves or shoots; spawns a swarmling every ${NODE_EVERY} alien turns, up to ${NODE_SPAWNS}`,
    intro: 'A living nest, full of swarmlings. Kill it before it empties.',
    danger: 'large',
    hp: 1.5,
    stats: { move: 0, range: 0, damage: 0 },
    stance: 'anchor',
    spawns: true,
    resists: [],
  },
  mirror: {
    name: 'Mirror',
    text: "Each hit does the damage of the squad's hardest-hitting soldier",
    intro: 'It studies our strongest. However hard they hit, it hits back.',
    danger: 'large',
    hp: 1,
    stats: {},
    stance: 'balanced',
    resists: [],
  },
  turret: {
    name: 'Turret',
    text: 'An automated gun: never moves, and shoots any soldier in range it can see',
    intro: 'An automated gun emplacement. It will not move, so do not stand in its sights.',
    danger: 'medium',
    hp: 1.5,
    stats: { move: 0, range: 7, damage: 4 },
    stance: 'anchor',
    resists: [],
  },
  harvester: {
    name: 'Harvester',
    text: 'Fast, and attacks up close; a civilian it kills rises the next alien turn as a husk that fights for the aliens',
    intro: 'It is not killing them. It is harvesting them. Whoever it takes gets back up, on its side.',
    danger: 'medium',
    hp: 1,
    stats: { range: 1, move: 7, damage: 4 },
    stance: 'rush',
    resists: [],
  },
  husk: {
    name: 'Husk',
    text: 'A civilian a harvester killed, risen: weak, and attacks up close',
    danger: 'small',
    hp: 0.5,
    stats: { range: 1, move: 4, damage: 2 },
    stance: 'rush',
    resists: [],
  },
}


/**
 * An alien's stats: its kind's, with the equipment given. A kind's health is the same all game; what grows is its
 * armor, which shows as armor pips, and its weapon, each step of which adds a point of damage.
 * A burster has no weapon to improve.
 */
export function alienStats(kind: AlienKind, armor: number, weapon: number): Stats {
  const stats = { ...BASE_STATS, ...ALIENS[kind].stats }
  const armed = kind === 'burster' ? 0 : weapon
  return { ...stats, hp: Math.max(1, Math.round(BASE_STATS.hp * ALIENS[kind].hp * TUNING.alienHp)), armor: armor + (ALIENS[kind].stats.armor ?? 0), damage: stats.damage + armed + TUNING.alienDamage, crit: 0 }
}

/** A themed group of aliens that roams and fights as one pod. */
export interface Pack {
  name: string
  kinds: AlienKind[]
  /** What it costs of a mission's force. */
  cost: number
  /** The depth along the road at which it first appears. */
  from: number
}

export const PACKS: Pack[] = [
  { name: 'Scout', kinds: ['trooper'], cost: 1, from: 0 },
  { name: 'Patrol', kinds: ['trooper', 'trooper'], cost: 2, from: 0 },
  { name: 'Swarm', kinds: ['swarmling', 'swarmling', 'swarmling', 'swarmling'], cost: 2, from: 0 },
  { name: 'Acid team', kinds: ['spitter', 'spitter', 'trooper'], cost: 3, from: 1 },
  { name: 'Hunting pack', kinds: ['spitter', 'swarmling', 'swarmling'], cost: 2, from: 0 },
  { name: 'Brood', kinds: ['burster', 'burster', 'swarmling', 'swarmling'], cost: 3, from: 2 },
  { name: 'Shock troop', kinds: ['brute', 'swarmling', 'swarmling'], cost: 3, from: 2 },
  { name: 'Siege team', kinds: ['brute', 'spitter'], cost: 3, from: 3 },
  { name: 'Psi cell', kinds: ['psion', 'trooper', 'trooper'], cost: 4, from: 3 },
  { name: 'Warband', kinds: ['brute', 'brute', 'burster'], cost: 5, from: 4 },
  { name: 'Burrowers', kinds: ['burrower', 'burrower'], cost: 3, from: 1 },
  { name: 'Sprinters', kinds: ['sprinter', 'sprinter', 'sprinter'], cost: 3, from: 1 },
  { name: 'Juggernaut', kinds: ['juggernaut', 'trooper'], cost: 3, from: 2 },
  { name: 'Clutch', kinds: ['incubator', 'swarmling', 'swarmling'], cost: 3, from: 2 },
  { name: 'Regenerators', kinds: ['regenerator', 'regenerator'], cost: 3, from: 2 },
  { name: 'Wraiths', kinds: ['wraith', 'wraith'], cost: 3, from: 3 },
  { name: 'Feeder', kinds: ['feeder', 'trooper', 'trooper'], cost: 3, from: 3 },
  { name: 'Nest', kinds: ['hiveNode', 'trooper'], cost: 3, from: 3 },
  { name: 'Mirror', kinds: ['mirror', 'trooper'], cost: 3, from: 4 },
  { name: 'Emplacement', kinds: ['turret', 'trooper'], cost: 3, from: 1 },
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
