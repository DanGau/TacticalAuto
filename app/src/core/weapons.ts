// Weapons: their stats and how each fights.
import type { Effect, Stance, Stats } from './battle'

/**
 * What a soldier fights with, whatever its class: stat changes, and maybe a way it positions and one thing it does.
 * A melee weapon reaches only the next tile.
 */
export interface Weapon {
  name: string
  text: string
  stats: Partial<Stats>
  melee?: true
  /** How its wielder positions, in place of its class's way. */
  stance?: Stance
  effect?: Effect
}

const weapons = {
  rifle: { name: 'Assault Rifle', text: 'A soldier\'s rifle', stats: {} },
  sniper: { name: 'Sniper Rifle', text: 'Hangs back and shoots from afar', stats: { range: 3, damage: 1, crit: 0.1, move: -1 }, stance: 'standoff' },
  shotgun: { name: 'Shotgun', text: 'Closes in, hitting hard at short range', stats: { range: -2, damage: 2 }, stance: 'rush' },
  smg: { name: 'SMG', text: 'Fires a third time each turn', stats: { range: -1, damage: -1, move: 1 }, effect: 'twin' },
  lmg: { name: 'Machine Gun', text: 'A target it hits does 1 less damage on its next turn', stats: { range: 1, damage: 1, move: -1 }, effect: 'suppress' },
  hammer: { name: 'Hammer', text: 'Melee. Hits knock the target a tile back; if something stops it, it slams into that for 1 damage', stats: { damage: 4, move: 1 }, melee: true, stance: 'rush', effect: 'thunder' },
  sword: { name: 'Sword', text: 'Melee. A kill does 2 damage to every alien beside the one killed', stats: { damage: 3, crit: 0.1, move: 2 }, melee: true, stance: 'rush', effect: 'cleave' },
  shield: { name: 'Shield', text: "Melee. A shot from beyond arm's reach does 1 less damage", stats: { damage: 1, armor: 4, move: 1 }, melee: true, stance: 'rush', effect: 'parry' },
  fists: { name: 'Power Fists', text: 'Melee. A kill grants one more attack', stats: { damage: 2, move: 2 }, melee: true, stance: 'rush', effect: 'frenzy' },
} satisfies Record<string, Weapon>

export type WeaponId = keyof typeof weapons
export const WEAPONS: Record<WeaponId, Weapon> = weapons

/** The range a melee weapon reaches. */
export const MELEE_RANGE = 1
