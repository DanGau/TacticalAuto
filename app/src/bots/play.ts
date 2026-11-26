// Playing a battle's cards: each bot's choice of the next card and target, or ending the turn.
import type { Action } from '../core/apply'
import type { Battle, Unit } from '../core/battle'
import { aimed, amount, CARDS, costOf, type Card } from '../core/cards'
import { heroOf, targetsOf } from '../core/turn'
import { randomInt } from '../core/rng'

/** Every play open now: each card of the hand at each target it may take, or none if it takes none. */
export function plays(battle: Battle): { index: number; target: number | null }[] {
  return battle.pile.hand.flatMap((card, index) => {
    if (costOf(card) > battle.energy) return []
    if (!aimed(card.id)) return [{ index, target: null }]
    return targetsOf(battle, card).map((t) => ({ index, target: t.id as number | null }))
  })
}

/** Plays at random, ending the turn as often as any one play. */
export function randomPlay(battle: Battle, rng: { rng: number }): Action {
  const open = plays(battle)
  const pick = randomInt(rng, open.length + 1)
  return pick === open.length ? { type: 'endTurn' } : { type: 'play', ...open[pick] }
}

/** Damage the aliens mean to deal the hero this turn, past its Block. */
export function incoming(battle: Battle): number {
  const hero = heroOf(battle)
  if (!hero) return 0
  const damage = battle.intents.reduce((sum, i) => sum + (i.kind === 'attack' && i.target === hero.id ? (i.damage ?? 0) : 0), 0)
  return Math.max(0, damage - (hero.block ?? 0))
}

/** What the alien `id` means to deal the hero this turn. */
const threatOf = (battle: Battle, id: number) => {
  const i = battle.intents.find((x) => x.id === id)
  return i?.kind === 'attack' && i.target === heroOf(battle)?.id ? (i.damage ?? 0) : 0
}

/**
 * What a play is worth: damage it lands, Block against what is coming, the attacks a kill or a stun stops, draw and
 * Energy, a Power while the battle is young, a move that brings a target in reach. A `keen` player counts the attacks
 * a kill stops and blocks only what is coming; a plain one blocks whenever hurt is coming and hits the weakest alien.
 */
function worth(battle: Battle, card: Card, target: Unit | undefined, keen: boolean, stranded: boolean): number {
  const hero = heroOf(battle)!
  const k = CARDS[card.id]
  const n = (of: Parameters<typeof amount>[2]) => amount(card.id, card.level, of)
  const coming = incoming(battle)
  let value = 0
  if (target) {
    const hits = Math.max(1, n('hits'))
    const dealt = (n('damage') + hero.might + Math.max(0, hero.stats.damage - 3)) * hits
    const left = target.hp + target.armor
    value += 0.5 * Math.min(dealt, left)
    if (dealt >= left) value += keen ? 1.2 * threatOf(battle, target.id) + 2 : 2
    if (k.area) value += 0.5 * battle.units.filter((u) => u.side === 'alien' && u !== target && Math.abs(u.x - target.x) <= k.area! && Math.abs(u.y - target.y) <= k.area!).length * n('damage')
    if (k.stun && !target.boss) value += keen ? threatOf(battle, target.id) : 1
    if (!keen && n('damage') > 0) value += 2 / Math.max(1, left)
    value += 0.4 * (n('burn') + n('chill') + n('mark') + n('knock') + n('pull'))
  }
  const block = n('block') + (k.cloak ? coming : 0)
  value += keen ? Math.min(block, coming) + 0.1 * block : coming > 0 ? 0.8 * block : 0.1 * block
  value += 0.8 * n('armor') + 0.8 * Math.min(n('heal'), hero.stats.hp - hero.hp)
  value += 1.5 * n('energy') + 1 * n('draw')
  if (k.type === 'power') value += battle.round <= 2 ? 4 : 2
  if (n('might') > 0) value += 2 * n('might')
  // A move pays when it brings an attack in hand into reach.
  if ((n('move') > 0 || n('retreat') > 0) && n('damage') === 0) {
    value += stranded ? 3 : n('retreat') > 0 && coming > 0 ? 1 : 0.3
  }
  return value
}

/** Plays the open card worth the most for its Energy, ending the turn when none is worth playing. */
export function bestPlay(battle: Battle, keen: boolean): Action {
  let best: { index: number; target: number | null } | null = null
  let top = keen ? 0.4 : 0.2
  const open = plays(battle)
  // An attack in hand with no target: a move that brings one in reach pays.
  const stranded = battle.pile.hand.some((c, i) => CARDS[c.id].damage && !open.some((o) => o.index === i))
  for (const option of open) {
    const card = battle.pile.hand[option.index]
    const target = battle.units.find((u) => u.id === option.target)
    const score = worth(battle, card, target, keen, stranded) / (costOf(card) + 0.5)
    if (score > top) {
      top = score
      best = option
    }
  }
  return best ? { type: 'play', ...best } : { type: 'endTurn' }
}
