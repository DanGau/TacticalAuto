// Hero classes: how each moves and where it stands. Its cards are in cards.ts.
import type { Stance, Stats } from './battle'

/** A hero's calling: its movement, and a way of positioning. */
export interface SoldierClass {
  name: string
  /** Added to the hero's stats. */
  stats: Partial<Stats>
  stance: Stance
}

const classes = {
  assault: {
    name: 'Vanguard',
    stats: { move: 1, strength: 1, jump: 2 },
    stance: 'rush',
  },
  heavy: {
    name: 'Powerhouse',
    stats: { move: -1, strength: 3 },
    stance: 'anchor',
  },
  sniper: {
    name: 'Deadeye',
    stats: { move: -1, strength: -1 },
    stance: 'standoff',
  },
  support: {
    name: 'Beacon',
    stats: { move: 1, jump: 1 },
    stance: 'balanced',
  },
  engineer: {
    name: 'Gadgeteer',
    stats: {},
    stance: 'anchor',
  },
  pyro: {
    name: 'Pyro',
    stats: { strength: 1, jump: 1 },
    stance: 'rush',
  },
  cryo: {
    name: 'Cryo',
    stats: {},
    stance: 'standoff',
  },
  phantom: {
    name: 'Phantom',
    stats: { move: 1, jump: 3 },
    stance: 'rush',
  },
} satisfies Record<string, SoldierClass>

export type ClassId = keyof typeof classes

export const CLASSES: Record<ClassId, SoldierClass> = classes
