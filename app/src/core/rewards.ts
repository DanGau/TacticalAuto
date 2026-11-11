// Gear and relic rewards, the shop, and settling the reward phase.
import { RARITY_CHANCE, type Rarity } from './base'
import { BOON_WEIGHT, SHOP_UTILITIES, START_OFFERS, START_PICKS, UTILITIES, UTILITY_IDS, UTILITY_PRICE, UTILITY_SLOTS, type UtilityId } from './utilities'
import { generateGear, type Gear } from './gear'
import { random, randomInt } from './rng'
import { drawRelic, offerable, type RelicId } from './relics'
import { type Run } from './run-state'
import { type Shop } from './run-state'
import { type Soldier } from './run-state'
import { minorOffers, owesPick, skillOffers } from './squad'

/** Learns the offered skill at `index`. */
export function takeSkill(run: Run, soldier: Soldier, index: number): void {
  const offers = skillOffers(soldier)
  soldier.lost.push(...offers.filter((_, i) => i !== index))
  soldier.skills.push(offers[index])
  settle(run)
}

/** Takes the offered perk at `index`; those passed over stay in the pool. */
export function takePerk(run: Run, soldier: Soldier, index: number): void {
  soldier.perks.push(minorOffers(soldier)[index])
  settle(run)
}

/** Hands `gear` to `soldier`, discarding what it held: gear is never taken off, only replaced. */
export function wear(soldier: Soldier, gear: Gear): void {
  soldier.gear = gear
}

/** Equips the find at `index` on `soldier`. */
export function equipFind(run: Run, index: number, soldier: Soldier): void {
  wear(soldier, run.finds.splice(index, 1)[0])
  settle(run)
}

/** What gear costs in a shop, by rarity. */
export const GEAR_PRICE: Record<Exclude<Rarity, 'common'>, number> = { rare: 5, epic: 8 }

/** Pieces of gear and relics a shop stocks. */
export const SHOP_WARES = 4

export const SHOP_RELICS = 4

/** Chance a piece of shop gear is epic rather than rare. */
export const SHOP_EPIC = 0.3

/** Stocks a shop: gear, each piece with an effect no other piece there has; relics the squad lacks; and a bribe. */
export function stockShop(run: Run): Shop {
  const wares: Gear[] = []
  const first = randomInt(run, run.soldiers.length)
  for (let tries = 0; wares.length < SHOP_WARES && tries < 50; tries++) {
    const gear = gearFor(run, run.soldiers[(first + wares.length) % run.soldiers.length], random(run) < SHOP_EPIC ? 'epic' : 'rare')
    if (wares.some((w) => w.effect === gear.effect)) continue
    run.nextGear++
    wares.push(gear)
  }
  const relics = offerable(run.relics)
  const stocked: RelicId[] = []
  while (stocked.length < SHOP_RELICS && relics.length > 0) stocked.push(drawRelic(run, relics))
  const kinds = UTILITY_IDS.filter((id) => !run.utilities.includes(id))
  const utilities = Array.from({ length: Math.min(SHOP_UTILITIES, kinds.length) }, () => ({ id: drawUtility(run, kinds), sold: false }))
  return { wares: wares.map((gear) => ({ gear, sold: false })), relics: stocked.map((id) => ({ id, sold: false })), utilities, bribed: false }
}

/** A new piece of `hero`'s weapon, made for them. */
const gearFor = (run: Run, hero: Soldier, rarity: Rarity): Gear => ({ ...generateGear(run, run.nextGear, rarity, hero.gear?.weapon), owner: hero.id })

/** Buys the ware at `index` for `soldier`, its owner, to wear. The caller checks it is affordable. */
export function buyWare(run: Run, index: number, soldier: Soldier): void {
  const ware = run.shop!.wares[index]
  ware.sold = true
  const { gear } = ware
  run.supplies -= GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
  wear(soldier, gear)
}

/** The party gains a utility; with no room, the player must choose what to drop. */
export function gainUtility(run: Run, id: UtilityId): void {
  if (run.utilities.length < UTILITY_SLOTS) run.utilities.push(id)
  else run.spare = id
}

/** The squad gains a relic: `seen` if the player chose it from a card, else the player is told. */
export function gainRelic(run: Run, id: RelicId, seen = false): void {
  run.relics = [...run.relics, id]
  if (!seen) run.gains.push({ kind: 'relic', id })
}

/** The squad loses the relic at `index`, and the player is told which. */
export function loseRelic(run: Run, index: number): RelicId {
  const id = run.relics[index]
  run.relics = run.relics.filter((_, i) => i !== index)
  run.gains.push({ kind: 'relicLost', id })
  return id
}

/** Takes a utility out of `pool`, the commoner the likelier. */
export function drawUtility(rng: { rng: number }, pool: UtilityId[]): UtilityId {
  const weight = (id: UtilityId) => BOON_WEIGHT[UTILITIES[id].rarity]
  let roll = random(rng) * pool.reduce((sum, id) => sum + weight(id), 0)
  const i = Math.max(0, pool.findIndex((id) => (roll -= weight(id)) < 0))
  return pool.splice(i, 1)[0]
}

/** At the run's start, the commons the party picks its first utilities from: drawn from the seed apart from the run's own stream, so they shift no later draw. */
export function offerStart(run: Run): void {
  const commons = UTILITY_IDS.filter((id) => UTILITIES[id].rarity === 'common')
  const rng = { rng: ~run.seed }
  run.boonOffers = Array.from({ length: START_OFFERS }, () => commons.splice(randomInt(rng, commons.length), 1)[0])
}

/** Takes the START_PICKS offers at `picks`. The caller checks they are distinct offers. */
export function takeStart(run: Run, picks: number[]): void {
  run.utilities = picks.slice(0, START_PICKS).map((i) => run.boonOffers[i])
  run.boonOffers = []
  settle(run)
}

/** A utility the party lacks, found at a stop; none if it holds them all. With no room the choice of what to drop tells of it; else the player is told. */
export function findUtility(run: Run): UtilityId | null {
  const kinds = UTILITY_IDS.filter((id) => !run.utilities.includes(id))
  if (kinds.length === 0) return null
  const id = drawUtility(run, kinds)
  gainUtility(run, id)
  if (run.spare !== id) run.gains.push({ kind: 'boon', id })
  return id
}

/** Buys the shop's utility at `index`. The caller checks it is affordable and not held. */
export function buyUtility(run: Run, index: number): void {
  const item = run.shop!.utilities[index]
  item.sold = true
  run.supplies -= UTILITY_PRICE
  gainUtility(run, item.id)
}

/** Settles a utility with no room: drops the one held at `drop`, or with -1, the new one; one just bought goes back on the shelf, its price repaid. */
export function keepUtility(run: Run, drop: number): void {
  if (drop >= 0) run.utilities[drop] = run.spare!
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

/** Ends the reward phase once no choice is left: no starting utilities, relic, find, spare utility, skill or perk. */
export function settle(run: Run): void {
  const owed = run.boonOffers.length > 0 || run.relicOffers.length > 0 || run.duoOffer !== null || run.finds.length > 0 || run.spare !== null || run.soldiers.some(owesPick)
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

/** A piece of gear found, for the player to put on a soldier or sell. */
export function dropGear(run: Run, lucky: boolean): void {
  const heroes = run.soldiers.filter((s) => !run.captives.includes(s.id))
  run.finds.push(gearFor(run, heroes[randomInt(run, heroes.length)], rollRarity(run, lucky)))
  run.nextGear++
}

/** Takes an offered relic. */
export function takeRelic(run: Run, id: RelicId): void {
  gainRelic(run, id, true)
  run.passed.relics.push(...run.relicOffers.filter((other) => other !== id))
  run.relicOffers = []
  run.duoOffer = null
  settle(run)
}

/** Takes the offered duo in place of a relic. */
export function takeDuo(run: Run): void {
  run.duos = [...run.duos, run.duoOffer!]
  run.passed.relics.push(...run.relicOffers)
  run.relicOffers = []
  run.duoOffer = null
  settle(run)
}
