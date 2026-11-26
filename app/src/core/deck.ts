// The deck: the starter deck a hero's class and weapon give, and cards offered by rarity.
import type { Rarity } from './base'
import { CARD_IDS, CARDS, SIGNATURES, STRIKES, type Card, type CardId } from './cards'
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

/** Of each card the starter deck holds: Strikes, Defends, then 1 Dash and the class's signature card. */
export const STARTER = { strikes: 4, defends: 4 }

/** The deck a hero of class `cls` wielding `weapon` starts with. */
export function starterDeck(cls: ClassId | null, weapon: WeaponId | undefined): Card[] {
  const ids: CardId[] = [...Array<CardId>(STARTER.strikes).fill(STRIKES[weapon ?? 'rifle']), ...Array<CardId>(STARTER.defends).fill('defend'), 'dash', ...(cls ? [SIGNATURES[cls]] : [])]
  return ids.map((id) => ({ id, level: 1 }))
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

/** Whether the hero may be offered card `id`: not basic, and of its class or none. */
export const offerable = (run: Run, id: CardId) => CARDS[id].rarity !== 'basic' && (!CARDS[id].cls || CARDS[id].cls === run.hero.cls)

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
