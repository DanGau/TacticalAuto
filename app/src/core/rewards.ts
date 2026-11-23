// Gear and relic rewards, the shop, and settling the reward phase.
import { RARITY_CHANCE, type Rarity } from './base'
import { CARDS, type CardRarity } from './cards'
import { drawCards, OFFERS, UPGRADED } from './deck'
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
  const cards = drawCards(run, OFFERS, false).map((id) => ({ id, sold: false }))
  return { wares: wares.map((gear) => ({ gear, sold: false })), relics: stocked.map((id) => ({ id, sold: false })), cards, medkit: false, removed: false }
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

/** What a card costs in a shop, by rarity; and removing one from the deck, once a shop. */
export const CARD_PRICE: Record<CardRarity, number> = { basic: 1, common: 3, rare: 5, epic: 8 }
export const REMOVE_PRICE = 4

/** Buys the shop's card at `index` into the deck. The caller checks it is affordable. */
export function buyCard(run: Run, index: number): void {
  const item = run.shop!.cards[index]
  item.sold = true
  run.supplies -= CARD_PRICE[CARDS[item.id].rarity]
  run.deck.push({ id: item.id, level: 1 })
}

/** Removes the card at `index` of the deck, for REMOVE_PRICE. The caller checks it is affordable. */
export function removeCard(run: Run, index: number): void {
  run.deck.splice(index, 1)
  run.supplies -= REMOVE_PRICE
  run.shop!.removed = true
}

/** Offers OFFERS cards after a battle won; an elite's are rare or better. */
export function offerCards(run: Run, elite: boolean): void {
  run.cardOffers = drawCards(run, OFFERS, elite)
}

/** Adds the offered card at `index` to the deck, or with null skips them all. */
export function takeCard(run: Run, index: number | null): void {
  if (index !== null) run.deck.push({ id: run.cardOffers[index], level: 1 })
  run.cardOffers = []
  settle(run)
}

/** Upgrades the card at `index` of the deck, or with null skips. */
export function upgradeCard(run: Run, index: number | null): void {
  if (index !== null) run.deck[index].level = UPGRADED
  run.upgrading = false
  settle(run)
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

/** Sells the find at `index`. */
export function sellFind(run: Run, index: number): void {
  run.supplies += SELL[run.finds.splice(index, 1)[0].rarity]
  settle(run)
}

/** Ends the reward phase once no choice is left: no relic, find, card, upgrade, skill or perk. */
export function settle(run: Run): void {
  const owed = run.relicOffers.length > 0 || run.finds.length > 0 || run.cardOffers.length > 0 || run.upgrading || owesPick(run.hero)
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
