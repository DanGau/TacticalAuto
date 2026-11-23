// Cards as the player sees them: a frame in its rarity's colour, a gem, art, name and text; and the deck laid out.
import { CARDS, cardName, cardText, type Card } from '../core/cards'
import { makes } from '../core/hero'
import type { Run } from '../core/run-state'
import { handSize } from '../core/deck'
import { cardIcon } from './card-icons'
import { describe } from './html'

/**
 * A card's face. `attrs` makes it a button with those attributes, else it is a plain card; `line` is what it does on the
 * board at hand; `state` adds classes such as on or out.
 */
export function cardFace(run: Run, card: Card, { attrs, line, state = '' }: { attrs?: string; line?: string; state?: string } = {}): string {
  const { id, level } = card
  const { rarity } = CARDS[id]
  const inner = `<span class="gem" title="${rarity}"></span><span class="art">${cardIcon(id)}</span><b class="name">${cardName(id, level)}</b><span class="text">${describe(cardText(id, level), CARDS[id], makes(run))}</span>${line ? `<small class="here">${line}</small>` : ''}`
  const cls = `tcard ${rarity}${level > 1 ? ' up' : ''}${card.out ? ' out' : ''}${state ? ` ${state}` : ''}`
  return attrs !== undefined ? `<button class="${cls}" ${attrs}>${inner}</button>` : `<div class="${cls}">${inner}</div>`
}

/** The deck as a grid of cards, each made a button by `attrs` when given; a card out says so. */
export function deckGrid(run: Run, attrs?: (card: Card, index: number) => string | undefined): string {
  return `<div class="deck">${run.deck.map((card, i) => cardFace(run, card, { attrs: attrs?.(card, i) })).join('')}</div>`
}

/** The deck viewer: how many cards, how many out, and the cards. */
export function deckView(run: Run): string {
  const out = run.deck.filter((c) => c.out).length
  return `<h2>Deck · ${run.deck.length} cards${out > 0 ? ` · ${out} out until the next leg` : ''}</h2><p class="deck-rule">Each battle, draw ${handSize(run)} and play 1.</p>${deckGrid(run)}`
}

/** The deck the run starts with, shown once before setting out. */
export const startDeck = (run: Run) =>
  `<div class="gearswap cardpick"><h1>Your starting deck</h1><h2>Each battle, draw ${handSize(run)} and play 1. Win battles to add cards.</h2>${deckGrid(run)}<button class="decide confirm" data-dealt>Set out</button></div>`
