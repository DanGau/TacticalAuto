import { BASE_STATS, type Stance, type Stats } from './battle'
import { randomInt } from './rng'

/** The kinds of alien. Each fights by a rule no soldier has; combat applies the rules, and `text` states them. */
export type AlienKind = 'trooper' | 'swarmling' | 'spitter' | 'burster' | 'brute' | 'psion'

export interface AlienType {
  name: string
  text: string
  /** Its health as a multiple of a soldier's base health. It never grows. */
  hp: number
  /** Stats it has in place of the base stats. */
  stats: Partial<Stats>
  stance: Stance
}

export const ALIENS: Record<AlienKind, AlienType> = {
  trooper: { name: 'Trooper', text: 'Shoots from cover, as a soldier does', hp: 1, stats: {}, stance: 'balanced' },
  swarmling: {
    name: 'Swarmling',
    text: 'Weak and fast; attacks only up close, and comes in numbers',
    hp: 0.4,
    stats: { range: 1, move: 6, damage: 2, aim: 0.85, close: 0 },
    stance: 'rush',
  },
  spitter: {
    name: 'Spitter',
    text: 'Its spit never misses and leaves acid on the tile, which burns whoever starts a turn in it',
    hp: 0.8,
    stats: { range: 6 },
    stance: 'balanced',
  },
  burster: {
    name: 'Burster',
    text: 'Runs at the squad and explodes, beside a soldier or wherever it dies, hurting everything near it',
    hp: 0.6,
    stats: { range: 0, move: 5 },
    stance: 'rush',
  },
  brute: {
    name: 'Brute',
    text: 'Tough, and attacks only up close; each hit it survives sends it charging at the shooter',
    hp: 2,
    stats: { range: 1, move: 3, damage: 5, aim: 0.85, close: 0 },
    stance: 'rush',
  },
  psion: {
    name: 'Psion',
    text: 'Panics a soldier, who loses a turn of action; when it dies, the aliens of its pod are hurt',
    hp: 0.8,
    stats: { damage: 2 },
    stance: 'standoff',
  },
}

/**
 * An alien's stats: its kind's, with the equipment given. A kind's health and aim are the same all game; what grows
 * is its armor, which shows as armor pips, and its weapon, which adds damage. A burster has no weapon to improve.
 */
export function alienStats(kind: AlienKind, armor: number, weapon: number): Stats {
  const stats = { ...BASE_STATS, ...ALIENS[kind].stats }
  return { ...stats, hp: Math.max(1, Math.round(BASE_STATS.hp * ALIENS[kind].hp)), armor, damage: stats.damage + (kind === 'burster' ? 0 : weapon) }
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
  { name: 'Hunting pack', kinds: ['spitter', 'swarmling', 'swarmling'], cost: 2, from: 1 },
  { name: 'Brood', kinds: ['burster', 'burster', 'swarmling', 'swarmling'], cost: 3, from: 2 },
  { name: 'Shock troop', kinds: ['brute', 'swarmling', 'swarmling'], cost: 3, from: 2 },
  { name: 'Siege team', kinds: ['brute', 'spitter'], cost: 3, from: 3 },
  { name: 'Psi cell', kinds: ['psion', 'trooper', 'trooper'], cost: 4, from: 3 },
  { name: 'Warband', kinds: ['brute', 'brute', 'burster'], cost: 5, from: 4 },
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
