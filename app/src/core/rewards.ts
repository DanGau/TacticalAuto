// Gear and relic rewards, the shop, and settling the reward phase.
import { RARITY_CHANCE, type Rarity } from './base'
import { MAX_LEVEL, SHOP_UTILITIES, START_OFFERS, UTILITY_IDS, UTILITY_PRICE, UTILITY_SLOTS, type UtilityId } from './utilities'
import { generateGear, type Gear } from './gear'
import { random, randomInt } from './rng'
import { drawRelic, offerable, type RelicId } from './relics'
import { type Run } from './run-state'
import { type Shop } from './run-state'
import { type Soldier } from './run-state'
import { makes, minorOffers, owesPick, reads, skillOffers } from './hero'
import { WEAPONS, type WeaponId } from './weapons'

/** The hero learns the offered skill at `index`. */
export function takeSkill(run: Run, index: number): void {
  const offers = skillOffers(run.hero)
  run.hero.lost.push(...offers.filter((_, i) => i !== index))
  run.hero.skills.push(offers[index])
  settle(run)
}

/** The hero takes the offered perk at `index`; those passed over stay in the pool. */
export function takePerk(run: Run, index: number): void {
  run.hero.perks.push(minorOffers(run.hero)[index])
  settle(run)
}

/** Hands `gear` to `soldier`, discarding what it held: gear is never taken off, only replaced. */
export function wear(soldier: Soldier, gear: Gear): void {
  soldier.gear = gear
}

/** Equips the find at `index` on the hero. */
export function equipFind(run: Run, index: number): void {
  wear(run.hero, run.finds.splice(index, 1)[0])
  settle(run)
}

/** What gear costs in a shop, by rarity. */
export const GEAR_PRICE: Record<Exclude<Rarity, 'common'>, number> = { rare: 5, epic: 8 }

/** Pieces of gear and relics a shop stocks. */
export const SHOP_WARES = 4

export const SHOP_RELICS = 4

/** Chance a piece of shop gear is epic rather than rare. */
export const SHOP_EPIC = 0.3

/** Pieces of a shop's gear that are a weapon other than the hero's, each a different one, so a build can change hands. */
export const SHOP_OTHER_WEAPONS = 2

/**
 * Stocks a shop: gear, each piece with an effect no other piece there has, most of it the hero's weapon and some
 * other weapons; relics the hero lacks; and a medkit.
 */
export function stockShop(run: Run): Shop {
  const wares: Gear[] = []
  const others = (Object.keys(WEAPONS) as WeaponId[]).filter((id) => id !== run.hero.gear?.weapon)
  for (let tries = 0; wares.length < SHOP_WARES && tries < 50; tries++) {
    const other = wares.length >= SHOP_WARES - SHOP_OTHER_WEAPONS && others.length > 0
    const weapon = other ? others.splice(randomInt(run, others.length), 1)[0] : run.hero.gear?.weapon
    const gear = gearFor(run, random(run) < SHOP_EPIC ? 'epic' : 'rare', weapon)
    if (wares.some((w) => w.effect === gear.effect)) continue
    run.nextGear++
    wares.push(gear)
  }
  const relics = offerable(run.relics)
  const stocked: RelicId[] = []
  while (stocked.length < SHOP_RELICS && relics.length > 0) stocked.push(drawRelic(run, relics, makes(run), reads(run)))
  const kinds = drawable(run)
  const utilities = Array.from({ length: Math.min(SHOP_UTILITIES, kinds.length) }, () => ({ id: drawUtility(run, kinds), sold: false }))
  return { wares: wares.map((gear) => ({ gear, sold: false })), relics: stocked.map((id) => ({ id, sold: false })), utilities, medkit: false }
}

/** A new piece of gear for the hero: `weapon`, or its own. */
const gearFor = (run: Run, rarity: Rarity, weapon = run.hero.gear?.weapon): Gear => generateGear(run, run.nextGear, rarity, weapon, makes(run), reads(run))

/** Buys the ware at `index` for the hero to wield. The caller checks it is affordable. */
export function buyWare(run: Run, index: number): void {
  const ware = run.shop!.wares[index]
  ware.sold = true
  const { gear } = ware
  run.supplies -= GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
  wear(run.hero, gear)
}

/** Boons the hero holds at most: UTILITY_SLOTS, and 1 more with Boon Rack. */
export const slotsOf = (run: Run) => UTILITY_SLOTS + (run.relics.includes('rack') ? 1 : 0)

/** Boons the hero could gain: any not held at MAX_LEVEL. */
const drawable = (run: Run) => UTILITY_IDS.filter((id) => (run.utilities.find((h) => h.id === id)?.level ?? 0) < MAX_LEVEL)

/** The hero gains boon `id`: one held rises a level, and the player is told; else it fills a free slot, or with none the player slots it in for one held or leaves it. */
export function gainUtility(run: Run, id: UtilityId): void {
  const held = run.utilities.find((h) => h.id === id)
  if (held) {
    held.level = Math.min(MAX_LEVEL, held.level + 1)
    run.gains.push({ kind: 'boon', id, level: held.level })
  } else if (run.utilities.length < slotsOf(run)) {
    run.utilities.push({ id, level: 1 })
    run.gains.push({ kind: 'boon', id, level: 1 })
  } else run.spare = id
}

/** The hero gains a relic: `seen` if the player chose it from a card, else the player is told. */
export function gainRelic(run: Run, id: RelicId, seen = false): void {
  run.relics = [...run.relics, id]
  if (!seen) run.gains.push({ kind: 'relic', id })
}

/** The hero loses the relic at `index`, and the player is told which. */
export function loseRelic(run: Run, index: number): RelicId {
  const id = run.relics[index]
  run.relics = run.relics.filter((_, i) => i !== index)
  run.gains.push({ kind: 'relicLost', id })
  return id
}

/** Takes a boon out of `pool`, each as likely. */
export function drawUtility(rng: { rng: number }, pool: UtilityId[]): UtilityId {
  return pool.splice(randomInt(rng, pool.length), 1)[0]
}

/** At the run's start, the boons the hero picks its first from: drawn from the seed apart from the run's own stream, so they shift no later draw. */
export function offerStart(run: Run): void {
  const pool = [...UTILITY_IDS]
  const rng = { rng: ~run.seed }
  run.boonOffers = Array.from({ length: START_OFFERS }, () => drawUtility(rng, pool))
}

/** Takes the UTILITY_SLOTS offers at `picks`. The caller checks they are distinct offers. */
export function takeStart(run: Run, picks: number[]): void {
  run.utilities = picks.slice(0, UTILITY_SLOTS).map((i) => ({ id: run.boonOffers[i], level: 1 }))
  run.boonOffers = []
  settle(run)
}

/** A new boon found at a stop, or a level of one held; none once every boon is held at MAX_LEVEL. */
export function findUtility(run: Run): UtilityId | null {
  const kinds = drawable(run)
  if (kinds.length === 0) return null
  const id = drawUtility(run, kinds)
  gainUtility(run, id)
  return id
}

/** Buys the shop's boon at `index`. The caller checks it is affordable. */
export function buyUtility(run: Run, index: number): void {
  const item = run.shop!.utilities[index]
  item.sold = true
  run.supplies -= UTILITY_PRICE
  gainUtility(run, item.id)
}

/** Settles a new boon: slots it in for the one held at `drop`, or with -1 leaves it; one just bought goes back on the shelf, its price repaid. */
export function keepUtility(run: Run, drop: number): void {
  if (drop >= 0) run.utilities[drop] = { id: run.spare!, level: 1 }
  const bought = run.shop?.utilities.find((item) => item.id === run.spare)
  if (drop < 0 && bought) {
    bought.sold = false
    run.supplies += UTILITY_PRICE
  }
  run.spare = null
  if (run.phase === 'reward') settle(run)
}

/** Sells the find at `index`. */
export function sellFind(run: Run, index: number): void {
  run.supplies += SELL[run.finds.splice(index, 1)[0].rarity]
  settle(run)
}

/** Ends the reward phase once no choice is left: no starting boons, relic, find, new boon, skill or perk. */
export function settle(run: Run): void {
  const owed = run.boonOffers.length > 0 || run.relicOffers.length > 0 || run.finds.length > 0 || run.spare !== null || owesPick(run.hero)
  run.phase = owed ? 'reward' : 'overworld'
}

/** Supplies a piece of gear sells for, by rarity. */
export const SELL: Record<Rarity, number> = { common: 1, rare: 2, epic: 3 }

/** A random rarity; `lucky` rules out common. */
export function rollRarity(run: Run, lucky: boolean): Rarity {
  let roll = random(run)
  if (lucky) roll = RARITY_CHANCE.common + roll * (1 - RARITY_CHANCE.common)
  return roll < RARITY_CHANCE.common ? 'common' : roll < RARITY_CHANCE.common + RARITY_CHANCE.rare ? 'rare' : 'epic'
}

/** A piece of the hero's weapon found, for the player to put on the hero or sell. */
export function dropGear(run: Run, lucky: boolean): void {
  run.finds.push(gearFor(run, rollRarity(run, lucky)))
  run.nextGear++
}

/** Takes an offered relic. */
export function takeRelic(run: Run, id: RelicId): void {
  gainRelic(run, id, true)
  run.passed.push(...run.relicOffers.filter((other) => other !== id))
  run.relicOffers = []
  settle(run)
}
