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
 * What a soldier fights with, whatever its class: stat changes, its attack, and maybe a way it positions and one thing it does.
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
  /** What else it does. */
  note?: string
}

/** Damage a Shield takes off a shot from beyond arm's reach. */
export const BLOCK_SOAK = 2

const weapons = {
  rifle: { name: 'Assault Rifle', stats: {}, attack: { shots: 3, power: 0.6, ms: 150 } },
  sniper: { name: 'Sniper Rifle', stats: { range: 3, crit: 0.1, move: -1 }, attack: { shots: 1, power: 1.6, ms: 520 }, stance: 'standoff', note: 'Hangs back' },
  shotgun: { name: 'Shotgun', stats: { range: -1 }, attack: { shots: 1, power: 1.8, wide: 0.6 }, stance: 'rush', note: 'Closes in' },
  smg: { name: 'SMG', stats: { range: -1, move: 1 }, attack: { shots: 4, power: 0.4, ms: 90 } },
  lmg: { name: 'Machine Gun', stats: { range: 1, move: -1 }, attack: { shots: 5, power: 0.35, ms: 110 }, effect: 'suppress', note: 'A target it hits does 1 less damage on its next turn' },
  pistols: { name: 'Twin Pistols', stats: { move: 1 }, attack: { shots: 2, power: 0.7, ms: 220 }, note: 'Left, then right' },
  hammer: { name: 'Hammer', stats: { move: 2 }, attack: { shots: 1, power: 3, wide: 0.6 }, thrown: { shots: 1, power: 1.3, ms: 700, range: 5 }, melee: true, stance: 'rush', effect: 'thunder', note: 'Hits knock the target a tile back; if something stops it, it slams into that for 1 damage' },
  sword: { name: 'Sword', stats: { crit: 0.1, move: 2 }, attack: { shots: 1, power: 2.7 }, dash: 4, melee: true, stance: 'rush', effect: 'cleave', note: 'A kill does 2 damage to every alien beside the one killed' },
  shield: { name: 'Shield', stats: { armor: 2, move: 1 }, attack: { shots: 1, power: 1.7 }, thrown: { shots: 1, power: 0.8, ms: 700, range: 4 }, melee: true, stance: 'rush', effect: 'block', note: `A shot from beyond arm's reach does ${BLOCK_SOAK} less damage` },
  fists: { name: 'Power Fists', stats: { move: 2 }, attack: { shots: 2, power: 1, ms: 300 }, rocket: { shots: 2, power: 0.6, ms: 480, range: 5 }, dash: 3, melee: true, stance: 'rush' },
} satisfies Record<string, Weapon>

export type WeaponId = keyof typeof weapons
export const WEAPONS: Record<WeaponId, Weapon> = weapons

/** The range a melee weapon reaches. */
export const MELEE_RANGE = 1

const times = (n: number) => `${n}×`
const told = ({ shots, power, wide }: Kit) => `${shots > 1 ? `${shots} shots, each` : '1 shot,'} ${times(power)} damage${wide ? `; ${Math.round(100 * wide)}% to each alien beside the target` : ''}`
const blows = ({ shots, power, wide }: Kit) => `${shots > 1 ? `${shots} hits, each` : 'A hit of'} ${times(power)} damage${wide ? `; ${Math.round(100 * wide)}% to each alien beside the target` : ''}`

/** What a weapon does, told from its numbers, for a card. */
export function weaponText(w: Weapon): string {
  return [
    w.melee ? `Up close: ${blows(w.attack)}` : told(w.attack),
    w.dash && `Dashes ${w.dash} tiles to strike`,
    w.thrown && `Else thrown once a turn, range ${w.thrown.range}, ${times(w.thrown.power)} damage`,
    w.rocket && `Else both fists fly out and back, range ${w.rocket.range}, each ${times(w.rocket.power)} damage`,
    w.note,
  ]
    .filter(Boolean)
    .join('. ')
}
