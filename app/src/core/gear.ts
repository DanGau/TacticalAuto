// Gear: slots, effects, the starter rifle, and generating finds.
import type { GearEffect, Stats } from './battle'
import type { Rarity } from './base'
import type { Keyword } from './keywords'
import { randomInt } from './rng'
import { WEAPONS, type WeaponId } from './weapons'

export const SLOTS = ['weapon', 'armor', 'utility'] as const
export type Slot = (typeof SLOTS)[number]

/**
 * A piece of gear: a base that names it, and one thing it does. A common has a stat mod; a rare, a simple effect; an
 * epic, an elaborate one. On the weapon slot the base is a weapon, which does what weapons.ts says on top.
 */
export interface Gear {
  id: number
  slot: Slot
  rarity: Rarity
  name: string
  /** The weapon it is, on the weapon slot. */
  weapon?: WeaponId
  /** Added to the stats of the soldier it is equipped to. */
  stats: Partial<Stats>
  effect: GearEffect | null
}

/** A stat mod and the word it adds to a name. Some trade one stat for another. */
interface Mod {
  prefix: string
  stats: Partial<Stats>
}

const BASES: Record<Exclude<Slot, 'weapon'>, string[]> = {
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

/** Each effect: the slot it appears on, the word it adds to a name, what it does, and whether only epics have it. Combat applies them. */
export const EFFECTS: Record<GearEffect, { slot: Slot; prefix: string; text: string; tags?: Keyword[]; epic?: true }> = {
  incendiary: { slot: 'weapon', prefix: 'Scorching', text: 'Hits set the target burning', tags: ['burn'] },
  frostbite: { slot: 'weapon', prefix: 'Rimed', text: 'Hits chill the target', tags: ['frost'] },
  tracer: { slot: 'weapon', prefix: 'Tracer', text: 'Hits mark the target', tags: ['mark'] },
  piercing: { slot: 'weapon', prefix: 'Piercing', text: "Ignores the target's cover" },
  vampiric: { slot: 'weapon', prefix: 'Leeching', text: 'Each hit heals the shooter 1' },
  executioner: { slot: 'weapon', prefix: 'Merciless', text: '+2 damage to targets at half health or less', tags: ['kill'] },
  chain: { slot: 'weapon', prefix: 'Frenzied', text: 'A kill grants one more shot', tags: ['kill'], epic: true },
  thorns: { slot: 'armor', prefix: 'Barbed', text: 'Whoever hits the wearer takes 1 damage' },
  shield: { slot: 'armor', prefix: 'Warded', text: 'Absorbs the first hit each battle', tags: ['ward'] },
  rime: { slot: 'armor', prefix: 'Rimeguard', text: 'Whoever hits the wearer is chilled', tags: ['frost', 'ward'] },
  regen: { slot: 'armor', prefix: 'Mending', text: 'Heals 1 at the start of each turn' },
  lastStand: { slot: 'armor', prefix: 'Stubborn', text: 'Once per battle, survives a killing hit at 1 health', epic: true },
  medkit: { slot: 'utility', prefix: "Medic's", text: 'Once per battle, heals the carrier 4 at half health or less, and the carrier still shoots' },
  grenade: { slot: 'utility', prefix: "Bombardier's", text: 'Once per battle, throws a grenade at two or more aliens standing together, and the carrier still shoots' },
  ricochet: { slot: 'weapon', prefix: 'Ricocheting', text: 'A miss bounces to another alien within 3 tiles of the target and rolls again', epic: true },
  arc: { slot: 'weapon', prefix: 'Arcing', text: 'A crit leaps to the nearest alien within 3 tiles for half its damage, then leaps once more', tags: ['crit'], epic: true },
  volatile: { slot: 'weapon', prefix: 'Volatile', text: 'An alien it kills bursts, dealing 2 damage to every alien beside it', tags: ['kill'], epic: true },
  thunder: { slot: 'weapon', prefix: 'Thundering', text: 'Hits knock the target a tile back; if something stops it, it slams into that for 1 damage', epic: true },
  mirror: { slot: 'armor', prefix: 'Mirrored', text: 'Begins each battle with 2 mirror images; each hit on the wearer has a 50% chance to pop one instead', tags: ['ward'], epic: true },
  bond: { slot: 'armor', prefix: 'Bonded', text: 'Takes the hits meant for squadmates beside the wearer', tags: ['ward'], epic: true },
  guardians: { slot: 'armor', prefix: 'Haloed', text: 'Spirits strike each alien that ends its move within 2 tiles of the wearer for 1 damage', epic: true },
  blink: { slot: 'utility', prefix: 'Blinking', text: 'Once per battle, when hit to half health or less, the carrier blinks to the safest tile within 5', epic: true },
  polymorph: { slot: 'utility', prefix: 'Chicken', text: 'Once per battle, turns the toughest alien the carrier can shoot, a boss aside, into a chicken that loses its next action', epic: true },
  snare: { slot: 'weapon', prefix: 'Snaring', text: 'Hits root the target: it cannot move on its next turn' },
  booming: { slot: 'weapon', prefix: 'Booming', text: 'Hits charge the target: if it moves on its next turn, it takes 3 damage', epic: true },
  tether: { slot: 'weapon', prefix: 'Tethered', text: 'Hits pull the target a tile toward the shooter' },
  caltrops: { slot: 'utility', prefix: 'Spiked', text: 'Once per battle, strews caltrops across the path of an alien closing in; each tile costs 2 more move to cross and hurts an alien 1', epic: true },
  null: { slot: 'utility', prefix: 'Null', text: 'Aliens within 3 tiles of the carrier cannot spit, panic, spawn or burst' },
}

/** The plain assault rifle every soldier starts with. */
export const starterRifle = (id: number): Gear => ({ id, slot: 'weapon', rarity: 'common', name: WEAPONS.rifle.name, weapon: 'rifle', stats: {}, effect: null })

/** A new piece of gear of the given rarity, in a random slot; on the weapon slot, any weapon but the rifle every soldier starts with. */
export function generateGear(rng: { rng: number }, id: number, rarity: Rarity): Gear {
  const pick = <T>(options: T[]): T => options[randomInt(rng, options.length)]
  const slot = pick([...SLOTS])
  const weapon = slot === 'weapon' ? pick((Object.keys(WEAPONS) as WeaponId[]).filter((w) => w !== 'rifle')) : undefined
  const base = weapon ? WEAPONS[weapon].name : pick(BASES[slot as Exclude<Slot, 'weapon'>])
  const kind = weapon ? { weapon } : {}
  if (rarity === 'common') {
    // Range is no mod for a melee weapon, which reaches the next tile whatever.
    const mod = pick(MODS[slot].filter((m) => !(weapon && WEAPONS[weapon].melee && 'range' in m.stats)))
    return { id, slot, rarity, name: `${mod.prefix} ${base}`, ...kind, stats: { ...mod.stats }, effect: null }
  }
  const effect = pick((Object.keys(EFFECTS) as GearEffect[]).filter((e) => EFFECTS[e].slot === slot && !!EFFECTS[e].epic === (rarity === 'epic')))
  return { id, slot, rarity, name: `${EFFECTS[effect].prefix} ${base}`, ...kind, stats: {}, effect }
}
