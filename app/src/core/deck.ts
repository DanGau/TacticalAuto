// The deck: the starter deck a hero's class and weapon give, and cards offered by rarity.
import type { Rarity } from './base'
import { CARD_IDS, CARDS, SIGNATURES, STARTERS, type Card, type CardId } from './cards'
import type { ClassId } from './classes'
import { LEG_STOPS } from './progress'
import { DOCTRINES, LEAN } from './doctrines'
import { random } from './rng'
import type { Run } from './run-state'
import type { WeaponId } from './weapons'

/** Cards a reward or a shop offers. */
export const OFFERS = 3

/** Chance a card offered is rare, and epic: at the run's start, then at its end; between, by how far along the run is. */
export const RARE_CHANCE: [number, number] = [0.2, 0.45]
export const EPIC_CHANCE: [number, number] = [0.03, 0.2]

/** The level an upgrade raises a card to. */
export const UPGRADED = 2

/** The deck a hero of class `cls` wielding `weapon` starts with: its weapon's starter cards and its class's signature card. */
export function starterDeck(cls: ClassId | null, weapon: WeaponId | undefined): Card[] {
  const ids = (Object.entries(STARTERS[weapon ?? 'rifle']) as [CardId, number][]).flatMap(([id, n]) => Array<CardId>(n).fill(id))
  return [...ids, ...(cls ? [SIGNATURES[cls]] : [])].map((id) => ({ id, level: 1 }))
}

/** Cards in the starter deck of a hero of class `cls` wielding `weapon`. */
export const starterSize = (cls: ClassId | null, weapon: WeaponId | undefined) => starterDeck(cls, weapon).length

/** How far along the run is, from 0 at its start to 1 at the hub. */
const progress = (run: Run) => Math.min(1, (run.keys * LEG_STOPS + run.stop) / ((run.legs.length - 1) * LEG_STOPS))

/** The chance of each rarity for a card offered now; an elite's reward is never common. */
export function rarityChances(run: Run, elite: boolean): Record<Rarity, number> {
  const at = ([from, to]: [number, number]) => from + (to - from) * progress(run)
  const epic = at(EPIC_CHANCE)
  const rare = elite ? 1 - epic : at(RARE_CHANCE)
  return { common: 1 - rare - epic, rare, epic }
}

/** Whether card `id` is in the hero's pools: not basic, and of its weapon's pool, its class's, or neither's. */
export function offerable(run: Run, id: CardId): boolean {
  const k = CARDS[id]
  if (k.rarity === 'basic') return false
  if (!k.cls && !k.weapons) return true
  return k.cls === run.hero.cls || !!k.weapons?.includes(run.hero.gear?.weapon ?? 'rifle')
}

/** `n` different cards the hero may be offered, each of a rarity drawn by rarityChances; within it, one a held doctrine favours is LEAN times as likely. */
export function drawCards(run: Run, n: number, elite: boolean): CardId[] {
  const chances = rarityChances(run, elite)
  const drawn: CardId[] = []
  while (drawn.length < n) {
    const roll = random(run)
    const rarity: Rarity = roll < chances.epic ? 'epic' : roll < chances.epic + chances.rare ? 'rare' : 'common'
    const pool = CARD_IDS.filter((id) => CARDS[id].rarity === rarity && offerable(run, id) && !drawn.includes(id))
    if (pool.length === 0) continue
    const weight = (id: CardId) => (run.doctrines.some((d) => DOCTRINES[d].favours(id)) ? LEAN : 1)
    let pick = random(run) * pool.reduce((sum, id) => sum + weight(id), 0)
    drawn.push(pool.find((id) => (pick -= weight(id)) < 0) ?? pool[pool.length - 1])
  }
  return drawn
}
