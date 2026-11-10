// Gear: a hero's one item, a weapon with a mod or an effect, and generating it.
import type { GearEffect, Stats } from './battle'
import type { Rarity } from './base'
import type { Keyword } from './keywords'
import { randomInt } from './rng'
import { BURN_STACKS, CADENCE, EXPOSED, HIGH_CRIT } from './battle'
import { WEAPONS, type WeaponId } from './weapons'

/**
 * A piece of gear: a weapon, and one thing it does beyond what weapons.ts says. A common has a stat mod or feeds a
 * build; a rare has a simple effect; an epic, an elaborate one.
 */
export interface Gear {
  id: number
  rarity: Rarity
  name: string
  weapon: WeaponId
  /** Added to the stats of the hero who wields it. */
  stats: Partial<Stats>
  effect: GearEffect | null
}

/** A stat mod and the word it adds to a name. Some trade one stat for another. */
const MODS: { prefix: string; stats: Partial<Stats> }[] = [
  { prefix: 'Honed', stats: { damage: 1, range: -1 } },
  { prefix: 'Keen', stats: { crit: 0.2 } },
  { prefix: 'Long', stats: { range: 1 } },
  { prefix: 'Heavy', stats: { damage: 1, move: -1 } },
  { prefix: 'Wild', stats: { crit: 0.3, range: -1 } },
]

/** Each effect: the word it adds to a name, what it does, and the rarity that has it, rare unless set. Combat applies them. */
export const EFFECTS: Record<GearEffect, { prefix: string; text: string; tags?: Keyword[]; rarity?: Rarity }> = {
  incendiary: { prefix: 'Scorching', text: `Hits add ${BURN_STACKS} burn`, tags: ['burn'], rarity: 'common' },
  frostbite: { prefix: 'Rimed', text: 'Hits chill', tags: ['frost'], rarity: 'common' },
  cadence: { prefix: 'Cadenced', text: `Every ${CADENCE}th shot does double damage`, rarity: 'common' },
  lofty: { prefix: 'Lofty', text: `+${100 * HIGH_CRIT}% crit per level above the target`, tags: ['crit'], rarity: 'common' },
  topple: { prefix: 'Toppling', text: `Knocked off a ledge: +1 damage a level, then +50% damage taken for ${EXPOSED.turns} turns`, tags: ['force'] },
  kiln: { prefix: 'Kilned', text: 'Knocking an alien into something burns it', tags: ['force', 'burn'] },
  quench: { prefix: 'Hailing', text: 'Knocking an alien into something chills it', tags: ['force', 'frost'] },
  tracer: { prefix: 'Seeking', text: 'Hits mark the target', tags: ['mark'] },
  piercing: { prefix: 'Piercing', text: "Ignores the target's armor" },
  vampiric: { prefix: 'Leeching', text: 'Hits heal 1' },
  executioner: { prefix: 'Merciless', text: '+2 damage to targets at half HP or less', tags: ['kill'] },
  chain: { prefix: 'Frenzied', text: 'Kills grant another attack', tags: ['kill'], rarity: 'epic' },
  ricochet: { prefix: 'Ricocheting', text: 'Hits bounce to a second alien within 3, at half damage', rarity: 'epic' },
  arc: { prefix: 'Arcing', text: 'Crits chain twice to aliens within 3, at half damage', tags: ['crit'], rarity: 'epic' },
  volatile: { prefix: 'Volatile', text: 'Kills explode for 2 to adjacent aliens', tags: ['kill'], rarity: 'epic' },
  thunder: { prefix: 'Thundering', text: 'Knocks back 1 tile; 1 damage if it hits something', tags: ['force'], rarity: 'epic' },
  snare: { prefix: 'Snaring', text: 'Roots the target for a turn' },
  booming: { prefix: 'Booming', text: 'Targets hit take 3 if they move next turn', rarity: 'epic' },
  shove: { prefix: 'Shoving', text: 'Knocks back 1 tile', tags: ['force'] },
  tether: { prefix: 'Tethered', text: 'Pulls the target 1 tile closer', tags: ['force'] },
}

/** The weapon a hero starts with: any, with nothing added. */
export function plainGear(rng: { rng: number }, id: number): Gear {
  const weapon = (Object.keys(WEAPONS) as WeaponId[])[randomInt(rng, Object.keys(WEAPONS).length)]
  return { id, rarity: 'common', name: WEAPONS[weapon].name, weapon, stats: {}, effect: null }
}

/** A new piece of gear of the given rarity: any weapon. */
export function generateGear(rng: { rng: number }, id: number, rarity: Rarity): Gear {
  const pick = <T>(options: T[]): T => options[randomInt(rng, options.length)]
  const weapon = pick(Object.keys(WEAPONS) as WeaponId[])
  const base = WEAPONS[weapon].name
  const effects = (Object.keys(EFFECTS) as GearEffect[]).filter((e) => (EFFECTS[e].rarity ?? 'rare') === rarity)
  // Half of commons feed a build; the rest have a stat mod.
  if (rarity === 'common' && randomInt(rng, 2) === 0) {
    // Range is no mod for a melee weapon, which reaches the next tile whatever.
    const mod = pick(MODS.filter((m) => !(WEAPONS[weapon].melee && 'range' in m.stats)))
    return { id, rarity, name: `${mod.prefix} ${base}`, weapon, stats: { ...mod.stats }, effect: null }
  }
  const effect = pick(effects)
  return { id, rarity, name: `${EFFECTS[effect].prefix} ${base}`, weapon, stats: {}, effect }
}
