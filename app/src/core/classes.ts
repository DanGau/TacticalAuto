// Hero classes: stats, positioning, the bonus attack each starts with, and the ability each can learn.
import type { Power, Use } from './powers'
import type { SecondaryId } from './secondaries'
import { CLOAK_DAMAGE, CLOAK_TURNS, MECH_STATS, MEDIC_HEAL, MEDIC_REACH, NAPALM_DAMAGE, ROCKET_DAMAGE, type Ability, type Stance, type Stats } from './battle'

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

const classes = {
  assault: {
    name: 'Vanguard',
    stats: { damage: 1, hp: 1, move: 1, strength: 1, jump: 2 },
    stance: 'rush',
    stanceText: 'Closes in for the hardest hit',
    ability: 'runAndGun',
    abilityName: 'Mighty Bound',
    abilityText: 'Moves twice as far when that is the only way to reach a target',
    charges: 0,
    secondary: 'frag',
  },
  heavy: {
    name: 'Powerhouse',
    stats: { move: -1, hp: 3, damage: 1, strength: 3 },
    stance: 'anchor',
    stanceText: 'Plants itself and holds its ground',
    ability: 'rocket',
    abilityName: 'Meteor Strike',
    target: '2+ aliens together',
    abilityText: `Replaces an attack. ${ROCKET_DAMAGE} damage in a blast`,
    charges: 1,
    secondary: 'slug',
  },
  sniper: {
    name: 'Deadeye',
    stats: { move: -1, damage: 1, crit: 0.25, hp: -1, strength: -1 },
    stance: 'standoff',
    stanceText: 'Hangs back out of reach',
    ability: 'squadsight',
    abilityName: 'Far Sight',
    abilityText: 'Bonus attack reaches any alien an ally sees, at any distance, given a clear line',
    charges: 0,
    secondary: 'pistol',
  },
  support: {
    name: 'Beacon',
    stats: { move: 1, hp: 2, jump: 1 },
    stance: 'escort',
    stanceText: 'Stays within reach of an ally; alone, fights as its weapon does',
    ability: 'medic',
    abilityName: 'Healing Light',
    range: `${MEDIC_REACH}`,
    target: 'Ally or self at half HP',
    abilityText: `Heals ${MEDIC_HEAL}, and it still attacks`,
    charges: 2,
    secondary: 'flare',
  },
  engineer: {
    name: 'Gadgeteer',
    stats: {},
    stance: 'anchor',
    stanceText: 'Stands its ground and lets the fight come to it',
    ability: 'mech',
    abilityName: 'Deploy Mech',
    target: 'Beside it',
    abilityText: `With aliens in sight, deploys a mech of ${MECH_STATS.hp} HP that every alien able must shoot; it still attacks`,
    charges: 1,
    secondary: 'shockCoil',
  },
  pyro: {
    name: 'Pyro',
    stats: { hp: 2, armor: 1, strength: 1, jump: 1 },
    stance: 'rush',
    stanceText: 'Closes in to bring its flames to bear',
    ability: 'napalm',
    abilityName: 'Fireball',
    target: '2+ aliens together',
    abilityText: `Replaces an attack. ${NAPALM_DAMAGE} damage; they burn, on ground set alight`,
    charges: 2,
    secondary: 'flameBurst',
  },
  cryo: {
    name: 'Cryo',
    stats: {},
    stance: 'standoff',
    stanceText: 'Hangs back out of reach',
    ability: 'cryo',
    abilityName: 'Chill Touch',
    abilityText: 'Its hits chill the target',
    charges: 0,
    secondary: 'iceShard',
  },
  phantom: {
    name: 'Phantom',
    stats: { move: 1, damage: 1, hp: -1, jump: 3 },
    stance: 'rush',
    stanceText: 'Closes in for the strike',
    ability: 'cloak',
    abilityName: 'Cloak',
    target: 'Self, when aliens can shoot it',
    abilityText: `Replaces its attacks. Unseen for ${CLOAK_TURNS} turns; its next attack ignores armor, has +${CLOAK_DAMAGE} damage and reveals it`,
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
