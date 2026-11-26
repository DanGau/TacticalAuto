// Doctrines: run-long leanings of the cards a hero is offered.
import { CARDS, type CardId } from './cards'

/** A way of fighting the hero adopts at an event and keeps for the run: the cards offered lean to those it `favours`. */
export interface Doctrine {
  name: string
  text: string
  favours: (id: CardId) => boolean
}

/** How much likelier a card a held doctrine favours is to be offered than another of its rarity. */
export const LEAN = 3

const doctrines = {
  exosuits: { name: 'Power Armor', text: 'Card rewards lean to Block and Armor.', favours: (id) => !!(CARDS[id].block || CARDS[id].armor) },
  scatterguns: { name: 'Brawlers', text: 'Card rewards lean to Knockback and Pull.', favours: (id) => !!(CARDS[id].knock || CARDS[id].pull) },
  blades: { name: 'Blademasters', text: 'Card rewards lean to close-range attacks.', favours: (id) => CARDS[id].type === 'attack' && CARDS[id].range === 1 },
  psionics: { name: 'Psi Awakened', text: 'Card rewards lean to Mark and Stun.', favours: (id) => !!(CARDS[id].mark || CARDS[id].stun) },
  demolitions: { name: 'Wreckers', text: 'Card rewards lean to cards that hit an area.', favours: (id) => !!CARDS[id].area },
  gunslingers: { name: 'Gunslingers', text: 'Card rewards lean to cards that hit many times.', favours: (id) => (CARDS[id].makes ?? []).includes('shots') },
  incendiaries: { name: 'Firebrands', text: 'Card rewards lean to Burn.', favours: (id) => [...(CARDS[id].makes ?? []), ...(CARDS[id].reads ?? [])].includes('burn') },
  cryonics: { name: 'Cryonics', text: 'Card rewards lean to Chill.', favours: (id) => [...(CARDS[id].makes ?? []), ...(CARDS[id].reads ?? [])].includes('chill') },
} satisfies Record<string, Doctrine>

export type DoctrineId = keyof typeof doctrines
export const DOCTRINES: Record<DoctrineId, Doctrine> = doctrines
