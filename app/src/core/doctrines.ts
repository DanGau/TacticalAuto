// Doctrines: run-long changes to how battles work.
import type { Lasting } from './base'
import type { Effect, Stance, Stats } from './battle'
import type { WeaponId } from './weapons'

/** A change to how battles work, which the battle checks where it applies. */
export type Rule = 'fortified' | 'reckoning'

/** A way of attacking a weapon doctrine gives every hero; combat applies it. */
export type DoctrineEffect = 'parry' | 'psionic' | 'demolish' | 'twin'

/**
 * A way of fighting the squad adopts at an event and keeps for the run. Each helps and hurts; `text` says how.
 * Some change soldiers' stats, some how the squad grows, some how battles work.
 */
export interface Doctrine extends Lasting {
  name: string
  text: string
  rule?: Rule
  /** Whether winning a key no longer brings a hero. */
  noRecruits?: boolean
  /** Whether a new soldier takes a class no squadmate has, while one is left. */
  uniqueClasses?: boolean
  /** Whether it is how the squad fights. The squad fights one way: adopting one sets aside the last. */
  weapon?: boolean
  /** Stats every hero has in place of its own, after everything else is counted. */
  set?: Partial<Stats>
  /** How every hero positions, in place of its class's way. */
  stance?: Stance
  effect?: DoctrineEffect
  /** What every hero fights with, in place of its own weapon. */
  fights?: WeaponId
}

/** Damage a parrying soldier takes off a shot from beyond arm's reach. */
export const PARRY_SOAK = 1

/** Kills a squad makes under Executioner's Oath for each Might it gives, and what a kill no longer pays a hero under it. */
export const RECKONING_KILLS = 3
export const KILL_REWARDS: Effect[] = ['feast', 'momentum', 'bloodRite', 'bloodbath', 'frenzy', 'chain', 'afterimage', 'firestorm']

/** Damage every hit loses under the fortified rule. */
export const FORTIFIED_SOAK = 1

const doctrines = {
  massCloning: { name: 'Mass Cloning', text: 'Every hero has 2 less HP', stats: { hp: -2 } },
  loneWolf: { name: 'Lone Wolf', text: 'Every hero has +40 HP, +4 armor, +5 damage, +25% crit and +2 move; no new hero ever joins', stats: { hp: 40, armor: 4, damage: 5, crit: 0.25, move: 2 }, noRecruits: true },
  specialists: { name: 'Specialists', text: 'No two heroes share a class while a class is left unused', uniqueClasses: true },
  exosuits: { name: 'Power Armor', text: 'Every hero has +3 armor and 1 less move', stats: { armor: 3, move: -1 } },
  fortified: { name: 'Iron Skin', text: 'Every hit, on either side, does 1 less damage, down to 1', rule: 'fortified' },
  scatterguns: { name: 'Brawlers', text: 'Every hero has +2 damage and 2 less range', stats: { damage: 2, range: -2 }, weapon: true },
  blades: {
    name: 'Blademasters',
    text: "Every hero fights with a Sunblade and charges in: range 1, +2 move, a dash to strike. An attack from beyond arm's reach does a hero 1 less damage",
    stats: { move: 2 },
    set: { range: 1 },
    fights: 'sword',
    stance: 'rush',
    effect: 'parry',
    weapon: true,
  },
  psionics: {
    name: 'Psi Awakened',
    text: 'Every hero attacks with the mind: range 6 and 1 less damage, but attacks pass through walls and ignore armor, at any alien whose cluster is revealed',
    stats: { damage: -1 },
    set: { range: 6 },
    effect: 'psionic',
    weapon: true,
  },
  demolitions: {
    name: 'Wreckers',
    text: 'Every hero has +1 damage and 1 less range, and each hit blows apart the objects around its target',
    stats: { damage: 1, range: -1 },
    effect: 'demolish',
    weapon: true,
  },
  reckoning: {
    name: "Executioner's Oath",
    text: `Kills give a hero nothing: no heal, armor, Might, extra attack or experience. Every ${RECKONING_KILLS}rd kill of a battle gives every hero 1 Might`,
    rule: 'reckoning',
  },
  gunslingers: { name: 'Gunslingers', text: 'Every hero has 1 less damage and 2 less range, but attacks with its weapon a third time each turn', stats: { damage: -1, range: -2 }, effect: 'twin', weapon: true },
} satisfies Record<string, Doctrine>

export type DoctrineId = keyof typeof doctrines
export const DOCTRINES: Record<DoctrineId, Doctrine> = doctrines
