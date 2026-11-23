// The deck: the starting cards, the hand drawn each battle and the card played from it, cards offered by rarity.
import type { Rarity } from './base'
import { CARD_IDS, CARDS, MAX_LEVEL, type Card, type CardId } from './cards'
import { LEG_STOPS } from './progress'
import { random, randomInt } from './rng'
import type { Run } from './run-state'

/** The deck every run starts with. */
export const STARTER: CardId[] = ['plasma', 'plating', 'nanoweave', 'afterburner', 'longshot', 'regen']

/** Cards drawn each battle; Tactical Satchel draws 1 more. */
export const HAND = 3

/** Cards a reward or a shop offers. */
export const OFFERS = 3

/** Chance a card offered is rare, and epic: at the run's start, then at its end; between, by how far along the run is. */
export const RARE_CHANCE: [number, number] = [0.2, 0.45]
export const EPIC_CHANCE: [number, number] = [0.03, 0.2]

/** The level an upgrade raises a card to. */
export const UPGRADED = 2

export const starterDeck = (): Card[] => STARTER.map((id) => ({ id, level: 1 }))

/** Cards drawn each battle. */
export const handSize = (run: Run) => HAND + (run.relics.includes('satchel') ? 1 : 0)

/** Draws the hand for the battle at its deploy screen: handSize cards at random from those not out. */
export function drawHand(run: Run): void {
  const pool = run.deck.flatMap((card, i) => (card.out ? [] : [i]))
  run.hand = []
  while (run.hand.length < handSize(run) && pool.length > 0) run.hand.push(pool.splice(randomInt(run, pool.length), 1)[0])
}

/** The card at `index` of the hand as it plays: at its level, or fused a level higher. */
export function playing(run: Run, index: number, fuse: boolean): Card {
  const { id, level } = run.deck[run.hand[index]]
  return { id, level: Math.min(MAX_LEVEL, level + (fuse ? 1 : 0)) }
}

/** Plays the card at `index` of the hand, none with null; fused, the hand's others go out until the next leg. Empties the hand. */
export function play(run: Run, index: number | null, fuse: boolean): Card | null {
  const card = index === null ? null : playing(run, index, fuse)
  if (fuse) for (const i of run.hand.filter((_, k) => k !== index)) run.deck[i].out = true
  run.hand = []
  return card
}

/** A leg begins: every card fused away returns. */
export function returnOut(run: Run): void {
  for (const card of run.deck) delete card.out
}

/** How far along the run is, from 0 at its start to 1 at the hub. */
const progress = (run: Run) => Math.min(1, (run.keys * LEG_STOPS + run.stop) / ((run.legs.length - 1) * LEG_STOPS))

/** The chance of each rarity for a card offered now; an elite's reward is never common. */
export function rarityChances(run: Run, elite: boolean): Record<Rarity, number> {
  const at = ([from, to]: [number, number]) => from + (to - from) * progress(run)
  const epic = at(EPIC_CHANCE)
  const rare = elite ? 1 - epic : at(RARE_CHANCE)
  return { common: 1 - rare - epic, rare, epic }
}

/** `n` different cards, each of a rarity drawn by rarityChances. */
export function drawCards(run: Run, n: number, elite: boolean): CardId[] {
  const chances = rarityChances(run, elite)
  const drawn: CardId[] = []
  while (drawn.length < n) {
    const roll = random(run)
    const rarity: Rarity = roll < chances.epic ? 'epic' : roll < chances.epic + chances.rare ? 'rare' : 'common'
    const pool = CARD_IDS.filter((id) => CARDS[id].rarity === rarity && !drawn.includes(id))
    drawn.push(pool[randomInt(run, pool.length)])
  }
  return drawn
}
