import { expect, test } from 'vitest'
import { apply } from './apply'
import { GRID, isSoldier, type Battle } from './battle'
import { amountOf, CARD_IDS, CARDS, cardText, MAX_LEVEL, type Card, type CardId } from './cards'
import type { GameEvent } from './combat-event'
import { drawCards, HAND, OFFERS, rarityChances, STARTER, starterDeck, UPGRADED } from './deck'
import { endBattle } from './debrief'
import { strides } from './grid'
import { drawBattle } from './missions'
import { rider, tickCard } from './played'
import { begun, road } from './roads'
import { createRun, KEYS, reserveOf } from './run'
import { type Run } from './run-state'
import { replay, runWith } from '../sim/run'
import { strategic } from '../bots/strategic'

const deck = (...ids: CardId[]): Card[] => ids.map((id) => ({ id, level: 1 }))

/** A run at a crossing's deploy screen, its deck `cards`. */
function landing(cards: Card[], seed = 1): Run {
  const run = begun(seed)
  run.deck = cards
  let stop = drawBattle(run, 'standard')
  for (let tries = 0; stop.goal !== 'cross' || stop.terrain === 'hive'; tries++) stop = drawBattle(run, 'standard')
  road(run, [stop])
  apply(run, { type: 'advance' })
  return run
}

const hero = (run: Run) => run.battle!.units.find(isSoldier)!

test('every run starts with the same starter deck, taken before the hero is chosen', () => {
  for (const seed of [1, 2, 3]) {
    const run = createRun(seed)
    expect(run.deck).toEqual(starterDeck())
    apply(run, { type: 'hero', index: 0 })
    expect(run.deck.map((c) => c.id)).toEqual(STARTER)
    expect(run.phase).toBe('overworld')
  }
})

test('each battle draws a hand of HAND different cards from those not out; a deck under HAND draws it all', () => {
  const run = landing(deck('plasma', 'plating', 'nanoweave', 'afterburner', 'longshot'))
  expect(run.hand).toHaveLength(HAND)
  expect(new Set(run.hand).size).toBe(HAND)
  run.deck[run.hand[0]].out = true
  const small = landing([...deck('plasma', 'plating'), { id: 'regen', level: 1, out: true }])
  expect(small.hand.sort()).toEqual([0, 1])
})

test('the card played works in the battle, its stat on the hero, its effects lent; the others drawn do nothing', () => {
  const bare = landing([])
  apply(bare, { type: 'enter', card: null, fuse: false })
  const base = hero(bare).stats
  for (const [i, id] of CARD_IDS.entries()) {
    const idle = CARD_IDS[(i + 1) % CARD_IDS.length]
    const run = landing(deck(idle, id))
    expect(apply(run, { type: 'enter', card: null, fuse: false }).ok).toBe(false)
    const at = run.hand.findIndex((d) => run.deck[d].id === id)
    apply(run, { type: 'enter', card: at, fuse: false })
    const { adds, lends } = CARDS[id]
    const { stats, effects } = hero(run)
    if (adds.to in base) expect(stats[adds.to as keyof typeof base], id).toBeCloseTo(base[adds.to as keyof typeof base] + amountOf(id, 1))
    for (const effect of lends) expect(effects, id).toContain(effect)
    for (const effect of CARDS[idle].lends.filter((e) => !lends.includes(e))) expect(effects, idle).not.toContain(effect)
    expect(run.battle!.card).toEqual({ id, level: 1 })
    expect(run.hand).toEqual([])
  }
})

test('a card raises more at each level, its text and name saying so', () => {
  for (const id of CARD_IDS) {
    const by = CARDS[id].adds.by
    expect(by[1], id).toBeGreaterThan(by[0])
    expect(by[2], id).toBeGreaterThan(by[1])
    expect(cardText(id, 3), id).not.toBe(cardText(id, 1))
  }
  const run = begun(1)
  expect(reserveOf(run, [], { id: 'nanoweave', level: 2 }).stats.hp - reserveOf(run, [], { id: 'nanoweave', level: 1 }).stats.hp).toBe(amountOf('nanoweave', 2) - amountOf('nanoweave', 1))
})

test('Fuse plays the card a level higher and puts the hand\'s others out until the next leg', () => {
  const run = landing(deck('plasma', 'plating', 'nanoweave', 'longshot'))
  const [played, ...others] = run.hand
  expect(apply(run, { type: 'enter', card: 0, fuse: true })).toEqual({ ok: true })
  expect(run.battle!.card).toEqual({ id: run.deck[played].id, level: 2 })
  for (const i of others) expect(run.deck[i].out).toBe(true)
  expect(run.deck.filter((c) => c.out)).toHaveLength(HAND - 1)
  Object.assign(run.battle!, { phase: 'over', winner: 'human' })
  run.mission!.kind = 'key'
  endBattle(run)
  expect(run.deck.some((c) => c.out)).toBe(false)
  const alone = landing(deck('plasma'))
  expect(apply(alone, { type: 'enter', card: 0, fuse: true }).ok).toBe(false)
  const top = landing([{ id: 'plasma', level: UPGRADED }, ...deck('plating')])
  apply(top, { type: 'enter', card: top.hand.findIndex((d) => top.deck[d].id === 'plasma'), fuse: true })
  expect(top.battle!.card!.level).toBe(MAX_LEVEL)
})

test('a battle won offers OFFERS different cards: one added to the deck, or Skip leaves it as it was', () => {
  const won = () => {
    const run = landing(starterDeck())
    apply(run, { type: 'enter', card: 0, fuse: false })
    Object.assign(run.battle!, { phase: 'over', winner: 'human' })
    endBattle(run)
    return run
  }
  const run = won()
  expect(run.phase).toBe('reward')
  expect(run.cardOffers).toHaveLength(OFFERS)
  expect(new Set(run.cardOffers).size).toBe(OFFERS)
  expect(apply(run, { type: 'card', index: OFFERS }).ok).toBe(false)
  const offered = run.cardOffers[1]
  expect(apply(run, { type: 'card', index: 1 })).toEqual({ ok: true })
  expect(run.deck.at(-1)).toEqual({ id: offered, level: 1 })
  expect(run.cardOffers).toEqual([])
  const skipped = won()
  const before = structuredClone(skipped.deck)
  expect(apply(skipped, { type: 'card', index: null })).toEqual({ ok: true })
  expect(skipped.deck).toEqual(before)
  expect(skipped.cardOffers).toEqual([])
})

test('rarer cards come more often as the run goes on, and an elite\'s reward is never common', () => {
  const run = begun(1)
  const start = rarityChances(run, false)
  run.keys = KEYS
  const end = rarityChances(run, false)
  expect(end.common).toBeLessThan(start.common)
  expect(end.rare).toBeGreaterThan(start.rare)
  expect(end.epic).toBeGreaterThan(start.epic)
  for (const c of [start, end]) expect(c.common + c.rare + c.epic).toBeCloseTo(1)
  expect(rarityChances(run, true).common).toBeCloseTo(0)
  const drawn = Array.from({ length: 200 }, () => drawCards(run, OFFERS, true)).flat()
  expect(drawn.every((id) => CARDS[id].rarity !== 'common')).toBe(true)
})

test('a safehouse heals and offers an upgrade: a card picked rises to UPGRADED, or Skip', () => {
  const run = begun(1)
  run.deck = starterDeck()
  road(run, [{ ...drawBattle(run, 'standard'), kind: 'safehouse' }])
  apply(run, { type: 'advance' })
  expect(run).toMatchObject({ phase: 'reward', upgrading: true })
  expect(apply(run, { type: 'upgrade', index: 2 })).toEqual({ ok: true })
  expect(run.deck[2].level).toBe(UPGRADED)
  expect(run.upgrading).toBe(false)
  Object.assign(run, { phase: 'reward', upgrading: true })
  expect(apply(run, { type: 'upgrade', index: 2 }).ok).toBe(false)
  expect(apply(run, { type: 'upgrade', index: null })).toEqual({ ok: true })
})

test('Ablative Field takes its amount off each hit on the hero; Regen Gel heals at the start of its turn; Force Gauntlet drives by level', () => {
  const at = (card: Card) => {
    const run = landing([card])
    apply(run, { type: 'enter', card: 0, fuse: false })
    return { battle: run.battle!, me: hero(run) }
  }
  const ablative = at({ id: 'ablative', level: 2 })
  expect(rider(ablative.battle, ablative.me, 'guard')).toBe(amountOf('ablative', 2))
  expect(rider(ablative.battle, ablative.battle.units.find((u) => u.side === 'alien')!, 'guard')).toBe(0)
  const gauntlet = at({ id: 'gauntlet', level: 3 })
  expect(rider(gauntlet.battle, gauntlet.me, 'push')).toBe(amountOf('gauntlet', 3))
  const { battle, me } = at({ id: 'regen', level: 1 })
  me.hp = 1
  const events: GameEvent[] = []
  tickCard(battle, events)
  expect(me.hp).toBe(1 + amountOf('regen', 1))
  expect(events).toContainEqual(expect.objectContaining({ effect: 'regen', amount: amountOf('regen', 1) }))
})

test('Jump Jets leap a water gap a plain jump cannot', () => {
  const run = landing([])
  const battle = run.battle! as Battle
  const from = { x: 10, y: 10 }
  for (const x of [10, 13]) battle.ground[10 * GRID + x] = 'grass'
  for (const x of [11, 12]) battle.ground[10 * GRID + x] = 'water'
  battle.height.fill(0)
  battle.west.fill('none')
  battle.north.fill('none')
  const lands = (span: number) => strides(battle, from, 2, span).some((t) => t.x === 13 && t.y === 10)
  expect(lands(0)).toBe(false)
  expect(lands(1)).toBe(true)
})

test('the deck, hand and offers are plain state: they survive a save as JSON, and a replay rebuilds the same deck', () => {
  const result = runWith(2, strategic)
  const run = replay(2, result.actions)
  const saved = { deck: run.deck, hand: run.hand, cardOffers: run.cardOffers, upgrading: run.upgrading }
  expect(JSON.parse(JSON.stringify(saved))).toEqual(saved)
  expect(run.deck).toHaveLength(result.deck)
  expect(replay(2, result.actions).deck).toEqual(run.deck)
})
