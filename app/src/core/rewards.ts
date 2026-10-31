// Gear and relic rewards, the shop, and settling the reward phase.
import { RARITY_CHANCE, type Rarity } from './base'
import { CONSUMABLE_IDS, SHOP_CONSUMABLES } from './consumables'
import { generateGear, type Gear } from './gear'
import { random, randomInt } from './rng'
import { offerable, type RelicId } from './relics'
import { type Run } from './run-state'
import { type Shop } from './run-state'
import { type Soldier } from './run-state'
import { skillOffers } from './squad'

/** Learns the offered skill at `index`. */
export function takeSkill(run: Run, soldier: Soldier, index: number): void {
  soldier.skills.push(skillOffers(soldier)[index])
  settle(run)
}

/** Puts `gear` on `soldier`, selling what it had in the slot: gear is never taken off, only replaced. */
export function wear(run: Run, soldier: Soldier, gear: Gear): void {
  const old = soldier.gear[gear.slot]
  if (old) run.supplies += SELL[old.rarity]
  soldier.gear[gear.slot] = gear
}

/** Equips the find at `index` on `soldier`. */
export function equipFind(run: Run, index: number, soldier: Soldier): void {
  wear(run, soldier, run.finds.splice(index, 1)[0])
  settle(run)
}

/** What gear costs in a shop, by rarity. */
export const GEAR_PRICE: Record<Exclude<Rarity, 'common'>, number> = { rare: 5, epic: 8 }

/** Pieces of gear and relics a shop stocks. */
export const SHOP_WARES = 5

export const SHOP_RELICS = 4

/** Chance a piece of shop gear is epic rather than rare. */
export const SHOP_EPIC = 0.3

/** Stocks a shop: gear, each piece with an effect no other piece there has; relics the squad lacks; and a bribe. */
export function stockShop(run: Run): Shop {
  const wares: Gear[] = []
  for (let tries = 0; wares.length < SHOP_WARES && tries < 50; tries++) {
    const gear = generateGear(run, run.nextGear, random(run) < SHOP_EPIC ? 'epic' : 'rare')
    if (wares.some((w) => w.effect === gear.effect)) continue
    run.nextGear++
    wares.push(gear)
  }
  const relics = offerable(run.relics)
  const stocked: RelicId[] = []
  while (stocked.length < SHOP_RELICS && relics.length > 0) stocked.push(relics.splice(randomInt(run, relics.length), 1)[0])
  const kinds = [...CONSUMABLE_IDS]
  const consumables = Array.from({ length: SHOP_CONSUMABLES }, () => ({ id: kinds.splice(randomInt(run, kinds.length), 1)[0], sold: false }))
  return { wares: wares.map((gear) => ({ gear, sold: false })), relics: stocked.map((id) => ({ id, sold: false })), consumables, bribed: false }
}

/** Buys the ware at `index` for `soldier` to wear. The caller checks it is affordable. */
export function buyWare(run: Run, index: number, soldier: Soldier): void {
  const ware = run.shop!.wares[index]
  ware.sold = true
  const { gear } = ware
  run.supplies -= GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
  wear(run, soldier, gear)
}

/** Sells the find at `index`. */
export function sellFind(run: Run, index: number): void {
  run.supplies += SELL[run.finds.splice(index, 1)[0].rarity]
  settle(run)
}

/** Ends the reward phase once no choice is left: no relic, find or skill. */
export function settle(run: Run): void {
  const owed = run.relicOffers.length > 0 || run.finds.length > 0 || run.soldiers.some((s) => skillOffers(s).length > 0)
  run.phase = owed ? 'reward' : 'overworld'
}

/** Supplies a piece of gear sells for, by rarity. */
export const SELL: Record<Rarity, number> = { common: 2, rare: 3, epic: 5 }

/** A random rarity; `lucky` rules out common. */
export function rollRarity(run: Run, lucky: boolean): Rarity {
  let roll = random(run)
  if (lucky) roll = RARITY_CHANCE.common + roll * (1 - RARITY_CHANCE.common)
  return roll < RARITY_CHANCE.common ? 'common' : roll < RARITY_CHANCE.common + RARITY_CHANCE.rare ? 'rare' : 'epic'
}

/** A piece of gear found, for the player to put on a soldier or sell. */
export function dropGear(run: Run, lucky: boolean): void {
  run.finds.push(generateGear(run, run.nextGear++, rollRarity(run, lucky)))
}

/** Takes an offered relic. */
export function takeRelic(run: Run, id: RelicId): void {
  run.relics.push(id)
  run.relicOffers = []
  settle(run)
}
