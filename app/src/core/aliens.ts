import type { Stance, Stats } from './battle'
import { randomInt } from './rng'

/** The kinds of alien. Each fights by a rule no soldier has; combat applies the rules, and `text` states them. */
export type AlienKind = 'trooper' | 'swarmling' | 'spitter' | 'burster' | 'brute' | 'psion'

export interface AlienType {
  name: string
  text: string
  /** Its health as a multiple of an alien's base health. */
  hp: number
  /** Stats it has in place of an alien's base stats. */
  stats: Partial<Stats>
  stance: Stance
  /** What it costs of a mission's force, and how many arrive for that cost. */
  cost: number
  pack: number
  /** The depth along the road at which it first appears. */
  from: number
}

export const ALIENS: Record<AlienKind, AlienType> = {
  trooper: { name: 'Trooper', text: 'Shoots from cover, as a soldier does', hp: 1, stats: {}, stance: 'balanced', cost: 1, pack: 1, from: 0 },
  swarmling: {
    name: 'Swarmling',
    text: 'Weak and fast; attacks only up close, and comes in pairs',
    hp: 0.4,
    stats: { range: 1, move: 6, damage: 2, aim: 0.85, close: 0 },
    stance: 'rush',
    cost: 1,
    pack: 2,
    from: 0,
  },
  spitter: {
    name: 'Spitter',
    text: 'Its spit never misses and leaves acid on the tile, which burns whoever starts a turn in it',
    hp: 0.8,
    stats: { range: 6 },
    stance: 'balanced',
    cost: 1,
    pack: 1,
    from: 1,
  },
  burster: {
    name: 'Burster',
    text: 'Runs at the squad and explodes, beside a soldier or wherever it dies, hurting everything near it',
    hp: 0.6,
    stats: { range: 0, move: 5 },
    stance: 'rush',
    cost: 1,
    pack: 1,
    from: 2,
  },
  brute: {
    name: 'Brute',
    text: 'Tough, and attacks only up close; each hit it survives sends it charging at the shooter',
    hp: 2,
    stats: { range: 1, move: 3, damage: 5, aim: 0.85, close: 0 },
    stance: 'rush',
    cost: 2,
    pack: 1,
    from: 2,
  },
  psion: {
    name: 'Psion',
    text: 'Panics a soldier, who loses a turn of action; when it dies, the aliens of its pod are hurt',
    hp: 0.8,
    stats: { damage: 2 },
    stance: 'standoff',
    cost: 2,
    pack: 1,
    from: 3,
  },
}

/** An alien's stats: the base for its depth, with its kind's health and stats. */
export function alienStats(kind: AlienKind, base: Stats): Stats {
  const type = ALIENS[kind]
  return { ...base, ...type.stats, hp: Math.max(1, Math.round(base.hp * type.hp)) }
}

/** The kinds of alien a mission of the given force sends, at the given depth: random picks that the force can pay for. */
export function muster(rng: { rng: number }, force: number, depth: number): AlienKind[] {
  const kinds: AlienKind[] = []
  const open = (Object.keys(ALIENS) as AlienKind[]).filter((kind) => ALIENS[kind].from <= depth)
  let left = force
  while (left > 0) {
    const affordable = open.filter((kind) => ALIENS[kind].cost <= left)
    const kind = affordable[randomInt(rng, affordable.length)]
    left -= ALIENS[kind].cost
    for (let i = 0; i < ALIENS[kind].pack; i++) kinds.push(kind)
  }
  return kinds
}
