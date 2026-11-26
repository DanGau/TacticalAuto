// The battle's hand at the bottom of the screen: Energy, the piles, the cards to play, the targets of the card picked, End Turn.
import type { Battle } from '../core/battle'
import { aimed, costOf } from '../core/cards'
import { awaiting } from '../core/combat'
import { ALIENS } from '../core/aliens'
import type { Run } from '../core/run-state'
import { ENERGY, heroOf, targetsOf, whyNot } from '../core/turn'
import { cardFace } from './card-face'

/** Why the card at `index` cannot be played at any target now, or null if it can. */
export function blocked(battle: Battle, index: number): string | null {
  const card = battle.pile.hand[index]
  if (costOf(card) > battle.energy) return 'Not enough Energy.'
  if (!aimed(card.id)) return null
  const why = whyNot(battle, index, targetsOf(battle, card)[0]?.id ?? null)
  return why
}

/** The hand panel; `picked` is the aimed card waiting for its target. */
export function handPanel(run: Run, battle: Battle, picked: number | null): string {
  const mine = awaiting(battle)
  const hero = heroOf(battle)
  const cards = battle.pile.hand
    .map((card, i) => {
      const why = mine ? blocked(battle, i) : null
      const line = why ?? (i === picked ? 'Tap an alien.' : '')
      const state = [i === picked ? 'on' : '', why ? 'inert' : ''].filter(Boolean).join(' ')
      return cardFace(run, card, { attrs: `data-card="${i}"${mine && !why ? '' : ' disabled'}`, line, state })
    })
    .join('')
  const targets =
    picked !== null && battle.pile.hand[picked]
      ? targetsOf(battle, battle.pile.hand[picked])
          .map((u) => `<button class="target" data-target="${u.id}">${u.kind ? ALIENS[u.kind].name : 'Alien'} ❤${u.hp}${u.armor ? ` ⛨${u.armor}` : ''}</button>`)
          .join('')
      : ''
  const block = hero?.block ? ` · 🛡 ${hero.block}` : ''
  const say = mine ? (picked !== null ? 'Choose a target.' : 'Your turn: play cards.') : battle.stage === 'enemy' ? 'The aliens act.' : 'Moving.'
  return `<div class="bar"><span class="orb" title="Energy">⚡${battle.energy}/${ENERGY}</span><span class="piles">Draw ${battle.pile.draw.length} · Discard ${battle.pile.discard.length}${battle.pile.exhaust.length ? ` · Exhaust ${battle.pile.exhaust.length}` : ''}${block}</span><span class="say">${say}</span><button class="end" data-end${mine ? '' : ' disabled'}>End Turn</button></div>${targets ? `<div class="targets">${targets}</div>` : ''}<div class="cards">${cards}</div>`
}
