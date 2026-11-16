// Hero classes: stats, positioning, the bonus attack each starts with, and the ability each can learn.
import type { Power, Use } from './powers'
import type { SecondaryId } from './secondaries'
import { CLOAK_TURNS, MECH_STATS, MEDIC_HEAL, MEDIC_REACH, NAPALM_DAMAGE, ROCKET_DAMAGE, BURN_STACKS, type Ability, type Stance, type Stats } from './battle'

/** A hero's calling: stat changes, a way of positioning, a bonus attack, and one ability its tree teaches, used unprompted. */
export interface SoldierClass {
  name: string
  /** Added to the hero's stats. */
  stats: Partial<Stats>
  stance: Stance
  stanceText: string
  ability: Ability
  abilityName: string
  abilityText: string
  /** How far the ability reaches and whom it affects, where it says. */
  range?: string
  target?: string
  /** Times per battle the ability can be used; 0 for one always in effect. */
  charges: number
  /** The attack after its weapon's each turn. */
  secondary: SecondaryId
}

/** Tiles from which a Far Sight bonus attack always crits. */
export const FAR_SIGHT_CRIT = 5

const classes = {
  assault: {
    name: 'Vanguard',
    stats: { damage: 1, hp: 1, move: 1, strength: 1, jump: 2 },
    stance: 'rush',
    stanceText: 'Close in for the hardest hit.',
    ability: 'runAndGun',
    abilityName: 'Mighty Bound',
    abilityText: 'If no alien is in reach, move double your move.',
    charges: 0,
    secondary: 'frag',
  },
  heavy: {
    name: 'Powerhouse',
    stats: { move: -1, hp: 3, damage: 1, strength: 3 },
    stance: 'anchor',
    stanceText: 'Hold your ground.',
    ability: 'rocket',
    abilityName: 'Meteor Strike',
    target: '2+ aliens together',
    abilityText: `Instead of an attack, deal ${ROCKET_DAMAGE} damage to each alien in a blast.`,
    charges: 1,
    secondary: 'slug',
  },
  sniper: {
    name: 'Deadeye',
    stats: { move: -1, damage: 1, crit: 0.25, hp: -1, strength: -1 },
    stance: 'standoff',
    stanceText: 'Hang back out of reach.',
    ability: 'eagleEye',
    abilityName: 'Far Sight',
    abilityText: `Your bonus attack reaches any alien in sight. From ${FAR_SIGHT_CRIT} or more tiles away, it Crits.`,
    charges: 0,
    secondary: 'pistol',
  },
  support: {
    name: 'Beacon',
    stats: { move: 1, hp: 2, jump: 1 },
    stance: 'balanced',
    stanceText: 'Take the best exchange of fire.',
    ability: 'medic',
    abilityName: 'Healing Light',
    range: `${MEDIC_REACH}`,
    target: 'You or an ally at half HP',
    abilityText: `Heal ${MEDIC_HEAL}. Then attack.`,
    charges: 2,
    secondary: 'flare',
  },
  engineer: {
    name: 'Gadgeteer',
    stats: {},
    stance: 'anchor',
    stanceText: 'Hold your ground and let the fight come to you.',
    ability: 'mech',
    abilityName: 'Deploy Mech',
    target: 'Beside you',
    abilityText: `Deploy a ${MECH_STATS.hp} HP mech. Aliens attack it first. Then attack.`,
    charges: 1,
    secondary: 'shockCoil',
  },
  pyro: {
    name: 'Pyro',
    stats: { hp: 2, armor: 1, strength: 1, jump: 1 },
    stance: 'rush',
    stanceText: 'Close in to bring your flames to bear.',
    ability: 'napalm',
    abilityName: 'Fireball',
    target: '2+ aliens together',
    abilityText: `Instead of an attack, deal ${NAPALM_DAMAGE} damage to each alien in a blast. Apply ${BURN_STACKS} Burn to each and set the ground on fire.`,
    charges: 2,
    secondary: 'flameBurst',
  },
  cryo: {
    name: 'Cryo',
    stats: {},
    stance: 'standoff',
    stanceText: 'Hang back out of reach.',
    ability: 'cryo',
    abilityName: 'Chill Touch',
    abilityText: 'Whenever you attack an alien, apply 1 Chill.',
    charges: 0,
    secondary: 'iceShard',
  },
  phantom: {
    name: 'Phantom',
    stats: { move: 1, damage: 1, hp: -1, jump: 3 },
    stance: 'rush',
    stanceText: 'Close in for the strike.',
    ability: 'cloak',
    abilityName: 'Cloak',
    target: 'You, when aliens can shoot you',
    abilityText: `Instead of your attacks, Cloak for ${CLOAK_TURNS} turns.`,
    charges: 2,
    secondary: 'knives',
  },
} satisfies Record<string, SoldierClass>

export type ClassId = keyof typeof classes

export const CLASSES: Record<ClassId, SoldierClass> = classes

/** A class's ability as a power, with `uses` a battle; Chill Touch rides on each attack, the rest with no uses sit on the sheet. */
export function classPower(cls: SoldierClass, uses: number): Power {
  const use: Use = uses > 0 ? `${uses}/battle` : cls.ability === 'cryo' ? 'At will' : 'Passive'
  return { name: cls.abilityName, use, range: cls.range, target: cls.target, text: cls.abilityText }
}

