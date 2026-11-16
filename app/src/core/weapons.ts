// Weapons: their stats and how each fights.
import type { Effect, Stance, Stats } from './battle'

/** One way of attacking with a weapon: its shots, each `power` times its wielder's damage. */
export interface Kit {
  shots: number
  power: number
  /** Ms the view plays each shot; a shot's own full length without one. */
  ms?: number
  /** Its reach, if not the weapon's. */
  range?: number
  /** The share of a shot's damage that also lands on each alien beside the target. */
  wide?: number
}

/**
 * What a hero fights with, whatever its class: stat changes, its attack, and maybe a way it positions and one thing it does.
 * A melee weapon reaches only the next tile; `thrown`, `rocket` and `dash` are how it makes its attack from farther off.
 */
export interface Weapon {
  name: string
  stats: Partial<Stats>
  attack: Kit
  melee?: true
  /** With nothing in reach, thrown once and back. Grants of a further attack never throw, so never twice a turn. */
  thrown?: Kit
  /** With nothing in reach, the fists fly out and back. */
  rocket?: Kit
  /** Tiles it dashes to bring its melee attack to bear. */
  dash?: number
  /** How its wielder positions, in place of its class's way. */
  stance?: Stance
  effect?: Effect
  /** What it does beyond its look, as a card says. */
  special?: string
  guard?: Guard
  /** Its blow's shockwave: each foe within `reach` tiles of the target, the target too if it lives, is stunned at `chance`, short of a boss, and loses its next action. */
  stun?: { chance: number; reach: number }
  /** Temp HP its wielder gains with each kill its attack makes, to at most `cap`. */
  surge?: { gain: number; cap: number }
}

/** A melee weapon's save each turn: the first hit on its wielder does `lands` of its damage. Each further hit lands whole. */
export interface Guard {
  /** The word over its wielder when it saves. */
  word: string
  lands: number
  /** Whether it saves the first hit from beside and the first from afar, not the first of all. */
  each?: true
}

/** Damage a Shield takes off a shot from beyond arm's reach. */
export const BLOCK_SOAK = 2

const HAMMER_SURGE = { gain: 3, cap: 4 }

const weapons = {
  rifle: { name: 'Rifle', stats: {}, attack: { shots: 3, power: 0.6, ms: 150 } },
  sniper: { name: 'Sniper Rifle', stats: { range: 3, crit: 0.1, move: -1 }, attack: { shots: 1, power: 1.6, ms: 520 }, stance: 'standoff' },
  shotgun: { name: 'Shotgun', stats: { range: -1 }, attack: { shots: 1, power: 1.8, wide: 0.6 }, stance: 'rush', effect: 'thunder', special: 'Knock the target back 1 tile. If it hits something, deal 1 damage to both.' },
  smg: { name: 'SMG', stats: { range: -1, move: 1 }, attack: { shots: 4, power: 0.4, ms: 90 } },
  lmg: { name: 'Machine Gun', stats: { range: 1, move: -1 }, attack: { shots: 5, power: 0.35, ms: 110 }, effect: 'suppress', special: 'Whenever you hit, apply Weak.' },
  pistols: { name: 'Twin Pistols', stats: { move: 1 }, attack: { shots: 2, power: 0.7, ms: 220 } },
  hammer: { name: 'Hammer', stats: { move: 2, strength: 2 }, attack: { shots: 1, power: 3, wide: 0.6 }, thrown: { shots: 1, power: 1.3, ms: 700, range: 5 }, melee: true, stance: 'rush', effect: 'thunder', stun: { chance: 1, reach: 2 }, surge: HAMMER_SURGE, special: `Stun aliens within 2 tiles of the target. Knock the target back 1 tile. Whenever you kill an alien, gain ${HAMMER_SURGE.gain} Temp HP, up to ${HAMMER_SURGE.cap}.` },
  sword: { name: 'Sword', stats: { crit: 0.1, move: 2 }, attack: { shots: 1, power: 2.7 }, dash: 4, melee: true, stance: 'rush', effect: 'cleave', guard: { word: 'Parry', lands: 0 }, special: 'Ignore the first hit on you each turn. Whenever you kill an alien, deal 2 damage to each alien beside it.' },
  shield: { name: 'Shield', stats: { armor: 2, move: 1 }, attack: { shots: 1, power: 1.7 }, thrown: { shots: 1, power: 0.8, ms: 700, range: 4 }, melee: true, stance: 'rush', effect: 'block', guard: { word: 'Block', lands: 0 }, special: `Ignore the first hit on you each turn. Ranged hits deal ${BLOCK_SOAK} less damage to you.` },
  fists: { name: 'Fists', stats: { move: 2, strength: 2 }, attack: { shots: 2, power: 1, ms: 300 }, rocket: { shots: 2, power: 0.6, ms: 480, range: 5 }, dash: 3, melee: true, stance: 'rush', effect: 'thunder', guard: { word: 'Slip', lands: 0, each: true }, special: 'Ignore the first melee hit and the first ranged hit on you each turn. Knock the target back 1 tile.' },
} satisfies Record<string, Weapon>

export type WeaponId = keyof typeof weapons
export const WEAPONS: Record<WeaponId, Weapon> = weapons

/** The range a melee weapon reaches. */
export const MELEE_RANGE = 1
