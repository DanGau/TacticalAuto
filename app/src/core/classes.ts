import type { Ability, Stance, Stats } from './battle'

/** What a soldier becomes at first promotion: a weapon's stat changes, a way of positioning, and one ability used unprompted. */
export interface SoldierClass {
  name: string
  weapon: string
  /** Added to the soldier's stats. */
  stats: Partial<Stats>
  stance: Stance
  stanceText: string
  ability: Ability
  abilityName: string
  abilityText: string
  /** Times per battle the ability can be used; 0 for one always in effect. */
  charges: number
}

const classes = {
  assault: {
    name: 'Assault',
    weapon: 'Shotgun',
    stats: { range: -2, damage: 1, close: 0.06, hp: 1 },
    stance: 'rush',
    stanceText: 'Closes in for the surest shot, whatever the exposure',
    ability: 'runAndGun',
    abilityName: 'Run and Gun',
    abilityText: 'Moves twice as far when that is the only way to reach a shot',
    charges: 0,
  },
  heavy: {
    name: 'Heavy',
    weapon: 'Machine gun',
    stats: { move: -1, hp: 3, damage: 1, aim: -0.05 },
    stance: 'anchor',
    stanceText: 'Fights from the best cover it can find',
    ability: 'rocket',
    abilityName: 'Rocket',
    abilityText: 'Once per battle, in place of a shot, blasts two or more aliens standing together',
    charges: 1,
  },
  sniper: {
    name: 'Sniper',
    weapon: 'Sniper rifle',
    stats: { range: 2, move: -1, damage: 1, crit: 0.25, close: -0.06, hp: -1 },
    stance: 'standoff',
    stanceText: 'Hangs back out of reach and shoots from a distance',
    ability: 'squadsight',
    abilityName: 'Squadsight',
    abilityText: 'Shoots any alien a squadmate sees, at any distance, given a clear line',
    charges: 0,
  },
  support: {
    name: 'Support',
    weapon: 'Rifle',
    stats: { move: 1 },
    stance: 'escort',
    stanceText: 'Stays within reach of a squadmate',
    ability: 'medic',
    abilityName: 'Medic',
    abilityText: 'Twice per battle, heals a badly wounded soldier nearby, and still shoots',
    charges: 2,
  },
} satisfies Record<string, SoldierClass>

export type ClassId = keyof typeof classes
export const CLASSES: Record<ClassId, SoldierClass> = classes
