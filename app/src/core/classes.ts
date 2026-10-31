// Soldier classes: stats, positioning, and the ability each uses unprompted.
import { CLOAK_DAMAGE, CLOAK_TURNS, MECH_STATS, type Ability, type Stance, type Stats } from './battle'

/** What a hero becomes at first promotion: stat changes, a way of positioning, and one ability used unprompted. */
export interface SoldierClass {
  name: string
  /** Added to the hero's stats. */
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
    name: 'Vanguard',
    stats: { damage: 1, hp: 1, move: 1 },
    stance: 'rush',
    stanceText: 'Closes in for the hardest hit',
    ability: 'runAndGun',
    abilityName: 'Run and Gun',
    abilityText: 'Moves twice as far when that is the only way to reach a shot',
    charges: 0,
  },
  heavy: {
    name: 'Powerhouse',
    stats: { move: -1, hp: 3, damage: 1 },
    stance: 'anchor',
    stanceText: 'Plants itself and holds its ground',
    ability: 'rocket',
    abilityName: 'Rocket',
    abilityText: 'Once per battle, in place of a shot, blasts two or more aliens standing together',
    charges: 1,
  },
  sniper: {
    name: 'Deadeye',
    stats: { move: -1, damage: 1, crit: 0.25, hp: -1 },
    stance: 'standoff',
    stanceText: 'Hangs back out of reach and shoots from a distance',
    ability: 'squadsight',
    abilityName: 'Squadsight',
    abilityText: 'Shoots any alien a squadmate sees, at any distance, given a clear line',
    charges: 0,
  },
  support: {
    name: 'Beacon',
    stats: { move: 1 },
    stance: 'escort',
    stanceText: 'Stays within reach of a squadmate',
    ability: 'medic',
    abilityName: 'Medic',
    abilityText: 'Twice per battle, heals a badly wounded soldier nearby, and still shoots',
    charges: 2,
  },
  engineer: {
    name: 'Gadgeteer',
    stats: { hp: -1, damage: -1 },
    stance: 'anchor',
    stanceText: 'Hangs back while its machines take the front',
    ability: 'mech',
    abilityName: 'Deploy Mech',
    abilityText: `Once per battle, once aliens are in sight, deploys a frail combat mech beside it, ${MECH_STATS.hp} health, that every alien able to shoot it must shoot, and still shoots`,
    charges: 1,
  },
  pyro: {
    name: 'Pyro',
    stats: { hp: 2, armor: 1 },
    stance: 'rush',
    stanceText: 'Closes in to bring its flames to bear',
    ability: 'napalm',
    abilityName: 'Napalm',
    abilityText: 'Twice per battle, in place of a shot, sprays napalm over two or more aliens standing together: 3 damage, and they burn on ground set alight',
    charges: 2,
  },
  cryo: {
    name: 'Cryo',
    stats: {},
    stance: 'standoff',
    stanceText: 'Hangs back and slows whatever comes on',
    ability: 'cryo',
    abilityName: 'Cryo Rounds',
    abilityText: 'Its hits chill the target',
    charges: 0,
  },
  phantom: {
    name: 'Phantom',
    stats: { move: 1, damage: 1, hp: -1 },
    stance: 'rush',
    stanceText: 'Closes in, unseen, for the strike',
    ability: 'cloak',
    abilityName: 'Cloak',
    abilityText: `Twice per battle, in place of its attacks when aliens can shoot it, it cloaks: no alien sees or targets it for ${CLOAK_TURNS} turns. Its next attack, out of cloak, ignores armor, has +${CLOAK_DAMAGE} damage, and reveals it`,
    charges: 2,
  },
} satisfies Record<string, SoldierClass>

export type ClassId = keyof typeof classes
export const CLASSES: Record<ClassId, SoldierClass> = classes
