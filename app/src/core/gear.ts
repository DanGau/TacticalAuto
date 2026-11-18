// Gear: a hero's one item, a weapon with a mod or an effect, and generating it.
import type { GearEffect, Stats } from './battle'
import type { Rarity } from './base'
import { feeds, type Flow, type Quantity } from './quantities'
import { random, randomInt } from './rng'
import { BURN_STACKS, CADENCE, EXECUTE_BONUS, EXPOSED, GUARD_MAX, HIGH_CRIT, VOLATILE_DAMAGE } from './battle'
import { TUNING } from './tuning'
import { SLAM_DAMAGE } from './wound'
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
export const EFFECTS: Record<GearEffect, Flow & { prefix: string; text: string; rarity?: Rarity }> = {
  bellows: { prefix: 'Billowing', text: 'On hit on a Burning alien, apply half its Burn to adjacent aliens.', reads: ['burn'], makes: ['burn'] },
  incendiary: { prefix: 'Scorching', text: `On hit, apply 1 Burn. First hit: ${BURN_STACKS}.`, reads: ['shots'], makes: ['burn'], rarity: 'common' },
  frostbite: { prefix: 'Rimed', text: 'On hit, apply 1 Chill.', reads: ['shots'], makes: ['chill'], rarity: 'common' },
  cadence: { prefix: 'Cadenced', text: `Every ${CADENCE}th shot deals double damage.`, reads: ['shots'], makes: ['overkill'], rarity: 'common' },
  lofty: { prefix: 'Lofty', text: `${100 * HIGH_CRIT}% more Crit chance per level above the target.`, makes: ['crit'], rarity: 'common' },
  topple: { prefix: 'Toppling', text: `Knockback off a ledge: deal 1 damage per level. It takes 50% more damage for ${EXPOSED.turns} turns.`, reads: ['impact'] },
  kiln: { prefix: 'Kilned', text: 'Impact: apply 1 Burn.', reads: ['impact'], makes: ['burn'] },
  quench: { prefix: 'Hailing', text: 'Impact: apply 1 Chill.', reads: ['impact'], makes: ['chill'] },
  tracer: { prefix: 'Seeking', text: 'On hit, apply 1 Mark.', reads: ['shots'], makes: ['mark'] },
  piercing: { prefix: 'Piercing', text: 'Ignore Armor.' },
  vampiric: { prefix: 'Leeching', text: `On hit, heal 1, up to ${TUNING.healCap} each battle.`, reads: ['shots'] },
  executioner: { prefix: 'Merciless', text: `Deal ${EXECUTE_BONUS} more damage to aliens at half HP or less.`, makes: ['overkill'] },
  chain: { prefix: 'Frenzied', text: 'On kill, attack again.', reads: ['kill'], rarity: 'epic' },
  ricochet: { prefix: 'Ricocheting', text: 'On hit, half the damage hits the nearest alien within 3 tiles of the target.', rarity: 'epic' },
  arc: { prefix: 'Arcing', text: 'On Crit, half the damage arcs to the nearest alien within 3 tiles, then 1 more.', reads: ['crit'], rarity: 'epic' },
  volatile: { prefix: 'Volatile', text: `On kill, deal the damage past its HP, at least ${VOLATILE_DAMAGE}, to adjacent aliens.`, reads: ['overkill'], rarity: 'epic' },
  thunder: { prefix: 'Thundering', text: `On hit, Knockback 1. Impact: deal ${SLAM_DAMAGE} damage to both.`, makes: ['moved', 'impact'], rarity: 'epic' },
  snare: { prefix: 'Snaring', text: 'On hit, Root.' },
  booming: { prefix: 'Booming', text: 'On hit, the target takes 3 damage when it next moves.', reads: ['moved'], rarity: 'epic' },
  shove: { prefix: 'Shoving', text: 'On hit, Knockback 1.', makes: ['moved', 'impact'] },
  tether: { prefix: 'Tethered', text: 'On hit, Pull 1.', makes: ['moved'] },
  twinned: { prefix: 'Twinned', text: 'With 2+ shots, fire 1 more.', makes: ['shots'] },
  braced: { prefix: 'Bracing', text: `On hit, gain 1 Armor, up to ${GUARD_MAX} above base.`, reads: ['shots'], makes: ['armor'] },
  sapping: { prefix: 'Sapping', text: 'On hit, apply Weak.', reads: ['shots'], rarity: 'common' },
}

/** The weapon a hero starts with: any, with nothing added. */
export function plainGear(rng: { rng: number }, id: number): Gear {
  const weapon = (Object.keys(WEAPONS) as WeaponId[])[randomInt(rng, Object.keys(WEAPONS).length)]
  return { id, rarity: 'common', name: WEAPONS[weapon].name, weapon, stats: {}, effect: null }
}

/** Chance a piece of gear found or stocked feeds what its hero makes or reads, when one of its rarity does. */
export const FEEDING_GEAR = 1 / 3

/** A new piece of gear of the given rarity: `weapon`, or any; at FEEDING_GEAR, with an effect that reads a quantity of `made` or makes one of `read`, if one can. */
export function generateGear(rng: { rng: number }, id: number, rarity: Rarity, weapon?: WeaponId, made: readonly Quantity[] = [], read: readonly Quantity[] = []): Gear {
  const pick = <T>(options: T[]): T => options[randomInt(rng, options.length)]
  weapon ??= pick(Object.keys(WEAPONS) as WeaponId[])
  const base = WEAPONS[weapon].name
  const all = (Object.keys(EFFECTS) as GearEffect[]).filter((e) => (EFFECTS[e].rarity ?? 'rare') === rarity)
  const fitting = all.filter((e) => feeds(EFFECTS[e], made, read))
  const effects = fitting.length > 0 && random(rng) < FEEDING_GEAR ? fitting : all
  // Half of commons feed a build; the rest have a stat mod.
  if (rarity === 'common' && randomInt(rng, 2) === 0) {
    // Range is no mod for a melee weapon, which reaches the next tile whatever.
    const mod = pick(MODS.filter((m) => !(WEAPONS[weapon].melee && 'range' in m.stats)))
    return { id, rarity, name: `${mod.prefix} ${base}`, weapon, stats: { ...mod.stats }, effect: null }
  }
  const effect = pick(effects)
  return { id, rarity, name: `${EFFECTS[effect].prefix} ${base}`, weapon, stats: {}, effect }
}
