import type { Effect, Stats } from './battle'
import type { Rarity } from './base'
import { randomInt } from './rng'

export const SLOTS = ['weapon', 'armor', 'utility'] as const
export type Slot = (typeof SLOTS)[number]

/**
 * A piece of gear, built from parts: a base that names it, stat mods, and on rare and epic gear one effect.
 * A common has one mod; a rare, one mod and an effect; an epic, two mods and an effect.
 */
export interface Gear {
  id: number
  slot: Slot
  rarity: Rarity
  name: string
  /** Added to the stats of the soldier it is equipped to. */
  stats: Partial<Stats>
  effect: Effect | null
}

/** A stat mod and the word it adds to a name. Some trade one stat for another. */
interface Mod {
  prefix: string
  stats: Partial<Stats>
}

const BASES: Record<Slot, string[]> = {
  weapon: ['Carbine', 'Repeater', 'Lancer', 'Blaster', 'Longarm'],
  armor: ['Vest', 'Plate', 'Weave', 'Harness'],
  utility: ['Rig', 'Module', 'Kit', 'Charm'],
}

const MODS: Record<Slot, Mod[]> = {
  weapon: [
    { prefix: 'Steady', stats: { aim: 0.08 } },
    { prefix: 'Keen', stats: { crit: 0.2 } },
    { prefix: 'Long', stats: { range: 1 } },
    { prefix: 'Heavy', stats: { damage: 1, aim: -0.05 } },
    { prefix: 'Snub', stats: { close: 0.04, range: -1 } },
  ],
  armor: [
    { prefix: 'Sturdy', stats: { hp: 2 } },
    { prefix: 'Plated', stats: { hp: 5, move: -1 } },
    { prefix: 'Light', stats: { move: 1, hp: -1 } },
  ],
  utility: [
    { prefix: 'Fleet', stats: { move: 1 } },
    { prefix: 'Targeting', stats: { aim: 0.05 } },
    { prefix: 'Deadeye', stats: { crit: 0.15 } },
    { prefix: 'Ranging', stats: { range: 1 } },
  ],
}

/** Each effect: the slot it appears on, the word it adds to a name, and what it does. Combat applies them. */
export const EFFECTS: Record<Effect, { slot: Slot; prefix: string; text: string }> = {
  incendiary: { slot: 'weapon', prefix: 'Scorching', text: 'Hits set the target burning: 1 damage at the start of its next 2 turns' },
  piercing: { slot: 'weapon', prefix: 'Piercing', text: "Ignores the target's cover" },
  vampiric: { slot: 'weapon', prefix: 'Leeching', text: 'Each hit heals the shooter 1' },
  executioner: { slot: 'weapon', prefix: 'Merciless', text: '+2 damage to targets at half health or less' },
  chain: { slot: 'weapon', prefix: 'Frenzied', text: 'A kill grants one more shot' },
  thorns: { slot: 'armor', prefix: 'Barbed', text: 'Whoever hits the wearer takes 1 damage' },
  shield: { slot: 'armor', prefix: 'Warded', text: 'Absorbs the first hit each battle' },
  regen: { slot: 'armor', prefix: 'Mending', text: 'Heals 1 at the start of each turn' },
  lastStand: { slot: 'armor', prefix: 'Stubborn', text: 'Once per battle, survives a killing hit at 1 health' },
  medkit: { slot: 'utility', prefix: "Medic's", text: 'Once per battle, heals the carrier 4 at half health or less, and the carrier still shoots' },
  grenade: { slot: 'utility', prefix: "Bombardier's", text: 'Once per battle, throws a grenade at two or more aliens standing together, and the carrier still shoots' },
}

/** A new piece of gear of the given rarity, in a random slot, built from random parts. */
export function generateGear(rng: { rng: number }, id: number, rarity: Rarity): Gear {
  const pick = <T>(options: T[]): T => options[randomInt(rng, options.length)]
  const slot = pick([...SLOTS])
  const mods = [pick(MODS[slot])]
  if (rarity === 'epic') mods.push(pick(MODS[slot].filter((mod) => mod !== mods[0])))
  const effects = (Object.keys(EFFECTS) as Effect[]).filter((effect) => EFFECTS[effect].slot === slot)
  const effect = rarity === 'common' ? null : pick(effects)
  const stats: Partial<Stats> = {}
  for (const mod of mods) {
    for (const key of Object.keys(mod.stats) as (keyof Stats)[]) stats[key] = (stats[key] ?? 0) + mod.stats[key]!
  }
  const words = [...(effect ? [EFFECTS[effect].prefix] : []), ...mods.map((mod) => mod.prefix), pick(BASES[slot])]
  return { id, slot, rarity, name: words.join(' '), stats, effect }
}
