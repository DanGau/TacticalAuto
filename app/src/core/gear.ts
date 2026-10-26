import type { GearEffect, Stats } from './battle'
import type { Rarity } from './base'
import type { Keyword } from './keywords'
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
  effect: GearEffect | null
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
    { prefix: 'Sturdy', stats: { armor: 2 } },
    { prefix: 'Plated', stats: { armor: 4, move: -1 } },
    { prefix: 'Light', stats: { armor: 1, move: 1 } },
  ],
  utility: [
    { prefix: 'Fleet', stats: { move: 1 } },
    { prefix: 'Targeting', stats: { aim: 0.05 } },
    { prefix: 'Deadeye', stats: { crit: 0.15 } },
    { prefix: 'Ranging', stats: { range: 1 } },
  ],
}

/** Each effect: the slot it appears on, the word it adds to a name, and what it does. Combat applies them. */
export const EFFECTS: Record<GearEffect, { slot: Slot; prefix: string; text: string; tags?: Keyword[] }> = {
  incendiary: { slot: 'weapon', prefix: 'Scorching', text: 'Hits set the target burning', tags: ['burn'] },
  frostbite: { slot: 'weapon', prefix: 'Rimed', text: 'Hits chill the target', tags: ['frost'] },
  tracer: { slot: 'weapon', prefix: 'Tracer', text: 'Hits mark the target', tags: ['mark'] },
  piercing: { slot: 'weapon', prefix: 'Piercing', text: "Ignores the target's cover" },
  vampiric: { slot: 'weapon', prefix: 'Leeching', text: 'Each hit heals the shooter 1' },
  executioner: { slot: 'weapon', prefix: 'Merciless', text: '+2 damage to targets at half health or less', tags: ['kill'] },
  chain: { slot: 'weapon', prefix: 'Frenzied', text: 'A kill grants one more shot', tags: ['kill'] },
  thorns: { slot: 'armor', prefix: 'Barbed', text: 'Whoever hits the wearer takes 1 damage' },
  shield: { slot: 'armor', prefix: 'Warded', text: 'Absorbs the first hit each battle', tags: ['ward'] },
  rime: { slot: 'armor', prefix: 'Rimeguard', text: 'Whoever hits the wearer is chilled', tags: ['frost', 'ward'] },
  regen: { slot: 'armor', prefix: 'Mending', text: 'Heals 1 at the start of each turn' },
  lastStand: { slot: 'armor', prefix: 'Stubborn', text: 'Once per battle, survives a killing hit at 1 health' },
  medkit: { slot: 'utility', prefix: "Medic's", text: 'Once per battle, heals the carrier 4 at half health or less, and the carrier still shoots' },
  grenade: { slot: 'utility', prefix: "Bombardier's", text: 'Once per battle, throws a grenade at two or more aliens standing together, and the carrier still shoots' },
  ricochet: { slot: 'weapon', prefix: 'Ricocheting', text: 'A miss bounces to another alien within 3 tiles of the target and rolls again' },
  arc: { slot: 'weapon', prefix: 'Arcing', text: 'A crit leaps to the nearest alien within 3 tiles for half its damage, then leaps once more', tags: ['crit'] },
  volatile: { slot: 'weapon', prefix: 'Volatile', text: 'An alien it kills bursts, dealing 2 damage to every alien beside it', tags: ['kill'] },
  thunder: { slot: 'weapon', prefix: 'Thundering', text: 'Hits knock the target a tile back; if something stops it, it slams into that for 1 damage' },
  mirror: { slot: 'armor', prefix: 'Mirrored', text: 'Begins each battle with 2 mirror images; each hit on the wearer has a 50% chance to pop one instead', tags: ['ward'] },
  bond: { slot: 'armor', prefix: 'Bonded', text: 'Takes the hits meant for squadmates beside the wearer', tags: ['ward'] },
  guardians: { slot: 'armor', prefix: 'Haloed', text: 'Spirits strike each alien that ends its move within 2 tiles of the wearer for 1 damage' },
  blink: { slot: 'utility', prefix: 'Blinking', text: 'Once per battle, when hit to half health or less, the carrier blinks to the safest tile within 5' },
  polymorph: { slot: 'utility', prefix: 'Chicken', text: 'Once per battle, turns the toughest alien the carrier can shoot, a boss aside, into a chicken that loses its next action' },
  snare: { slot: 'weapon', prefix: 'Snaring', text: 'Hits root the target: it cannot move on its next turn' },
  booming: { slot: 'weapon', prefix: 'Booming', text: 'Hits charge the target: if it moves on its next turn, it takes 3 damage' },
  tether: { slot: 'weapon', prefix: 'Tethered', text: 'Hits pull the target a tile toward the shooter' },
  caltrops: { slot: 'utility', prefix: 'Spiked', text: 'Once per battle, strews caltrops across the path of an alien closing in; each tile costs 2 more move to cross and hurts an alien 1' },
  null: { slot: 'utility', prefix: 'Null', text: 'Aliens within 3 tiles of the carrier cannot spit, panic, spawn or burst' },
}

/** A new piece of gear of the given rarity, in a random slot, built from random parts. */
export function generateGear(rng: { rng: number }, id: number, rarity: Rarity): Gear {
  const pick = <T>(options: T[]): T => options[randomInt(rng, options.length)]
  const slot = pick([...SLOTS])
  const mods = [pick(MODS[slot])]
  if (rarity === 'epic') mods.push(pick(MODS[slot].filter((mod) => mod !== mods[0])))
  const effects = (Object.keys(EFFECTS) as GearEffect[]).filter((effect) => EFFECTS[effect].slot === slot)
  const effect = rarity === 'common' ? null : pick(effects)
  const stats: Partial<Stats> = {}
  for (const mod of mods) {
    for (const key of Object.keys(mod.stats) as (keyof Stats)[]) stats[key] = (stats[key] ?? 0) + mod.stats[key]!
  }
  const words = [...(effect ? [EFFECTS[effect].prefix] : []), ...mods.map((mod) => mod.prefix), pick(BASES[slot])]
  return { id, slot, rarity, name: words.join(' '), stats, effect }
}
