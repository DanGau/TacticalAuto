// Card play: each combo quantity a card makes, targeting, intents answered by moving, and the piles.
import { expect, test } from 'vitest'
import { arena } from './arena'
import { CHILL_FREEZE, CRIT_BONUS, CLOAK_DAMAGE, GRID, NUMB_TURNS, OVERKILL_FROM, type Battle } from './battle'
import { amount, CARDS, type CardId } from './cards'
import { awaiting, stepBattle } from './combat'
import type { GameEvent } from './combat-event'
import { distance } from './grid'
import { TUNING } from './tuning'
import { beginTurn, draw, endTurn, intents, resolve, targetsOf, whyNot } from './turn'
import { SLAM_DAMAGE } from './wound'

/** Plays `id` at `target` from a fresh hand of it alone, with Energy to spare. */
function play(battle: Battle, id: CardId, target: number | null = null, level = 1): GameEvent[] {
  battle.pile.hand = [{ id, level }]
  battle.energy = 9
  battle.stage = 'play'
  expect(whyNot(battle, 0, target)).toBeNull()
  battle.queued = { index: 0, target }
  return resolve(battle)
}

const plain = (battle: Battle) => {
  for (const u of battle.units) u.stats = { ...u.stats, crit: 0 }
}

test('an Attack deals its damage to the target, each of its hits, past Block and Armor in that order', () => {
  const { battle, hero, aliens } = arena([], [{ x: 11, y: 10 }])
  plain(battle)
  hero.stats = { ...hero.stats, damage: 3 }
  play(battle, 'doubleTap', aliens[0].id)
  expect(aliens[0].hp).toBe(40 - 2 * amount('doubleTap', 1, 'damage'))
  Object.assign(aliens[0], { hp: 40, armor: 2, block: 1 })
  play(battle, 'pointBlank', aliens[0].id)
  expect([aliens[0].block, aliens[0].armor, aliens[0].hp]).toEqual([0, 0, 40 - (amount('pointBlank', 1, 'damage') - 3)])
})

test('Burn and Chill cards apply their stacks; Chill to CHILL_FREEZE Freezes; the two meeting Quench and leave it Numb', () => {
  const { battle, aliens } = arena([], [{ x: 12, y: 10 }, { x: 10, y: 14 }])
  plain(battle)
  play(battle, 'napalmGrenade', aliens[0].id)
  expect(aliens[0].burn).toBe(amount('napalmGrenade', 1, 'burn'))
  play(battle, 'cryoGrenade', aliens[1].id)
  play(battle, 'cryoGrenade', aliens[1].id)
  expect(aliens[1].chill).toBeGreaterThanOrEqual(CHILL_FREEZE)
  expect(aliens[1].frozen).toBe(true)
  const events = play(battle, 'cryoGrenade', aliens[0].id)
  expect(events.some((e) => e.type === 'effect' && e.effect === 'quenched')).toBe(true)
  expect(aliens[0]).toMatchObject({ burn: 0, numb: NUMB_TURNS })
})

test('Mark adds damage to every hit on the alien', () => {
  const { battle, aliens } = arena([], [{ x: 11, y: 10 }])
  plain(battle)
  play(battle, 'huntersMark', aliens[0].id)
  const marked = aliens[0].mark
  expect(marked).toBe(amount('huntersMark', 1, 'mark'))
  const before = aliens[0].hp
  play(battle, 'pointBlank', aliens[0].id)
  expect(before - aliens[0].hp).toBe(amount('pointBlank', 1, 'damage') + TUNING.markDamage)
})

test('Knockback Displaces; into an alien it is an Impact that hurts both; a Displaced Marked alien loses its Mark', () => {
  const { battle, hero, aliens } = arena([], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  plain(battle)
  hero.stats = { ...hero.stats, damage: 0 }
  markUnit(aliens[0])
  const events = play(battle, 'uppercut', aliens[0].id)
  expect(aliens[0].shifted).toBe(true)
  expect(aliens[1].hp).toBe(40 - SLAM_DAMAGE)
  expect(events.some((e) => e.type === 'effect' && e.effect === 'unlocked')).toBe(true)
  expect(aliens[0].mark).toBe(0)
})

test('Pull draws a far alien toward the hero', () => {
  const { battle, hero, aliens } = arena([], [{ x: 15, y: 10 }])
  const far = distance(hero, aliens[0])
  play(battle, 'grapple', aliens[0].id)
  expect(distance(hero, aliens[0])).toBeLessThan(far)
})

test('a Crit adds CRIT_BONUS; a hit past OVERKILL_FROM carries on with Overkill Relay; an attack out of Cloak hits harder past Armor', () => {
  const { battle, hero, aliens } = arena([], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  hero.stats = { ...hero.stats, damage: 3, crit: 1 }
  play(battle, 'pointBlank', aliens[0].id)
  expect(40 - aliens[0].hp).toBe(amount('pointBlank', 1, 'damage') + CRIT_BONUS)
  plain(battle)
  play(battle, 'overkill')
  play(battle, 'haymaker', aliens[0].id)
  expect(amount('haymaker', 1, 'damage')).toBeGreaterThan(OVERKILL_FROM)
  expect(aliens[1].hp).toBeLessThan(40)
  const cloaked = arena([], [{ x: 11, y: 10 }])
  plain(cloaked.battle)
  cloaked.aliens[0].armor = 5
  play(cloaked.battle, 'cloak')
  play(cloaked.battle, 'pointBlank', cloaked.aliens[0].id)
  expect(40 - cloaked.aliens[0].hp).toBe(amount('pointBlank', 1, 'damage') + CLOAK_DAMAGE)
  expect(cloaked.aliens[0].armor).toBe(5)
})

test('Armor takes damage before HP and stays; Block takes it first and goes', () => {
  const { battle, hero, aliens } = arena([], [{ x: 11, y: 10 }])
  play(battle, 'plating')
  play(battle, 'defend')
  const hp = hero.hp
  aliens[0].stats = { ...aliens[0].stats, damage: 4, crit: 0 }
  battle.stage = 'enemy'
  battle.turn = 'alien'
  while (battle.stage === 'enemy') stepBattle(battle)
  expect(hero.hp).toBe(hp)
  expect(hero.block).toBe(0)
  expect(hero.armor).toBeGreaterThan(0)
})

test('a bridge Power turns a cancellation into a payoff: Thermal Shock Rounds detonate Burn meeting Chill', () => {
  const { battle, aliens } = arena([], [{ x: 12, y: 10 }])
  plain(battle)
  play(battle, 'thermal')
  play(battle, 'napalmGrenade', aliens[0].id)
  const hp = aliens[0].hp
  const events = play(battle, 'cryoGrenade', aliens[0].id)
  expect(events.some((e) => e.type === 'effect' && e.effect === 'quenched')).toBe(false)
  expect(hp - aliens[0].hp).toBeGreaterThan(amount('cryoGrenade', 1, 'damage'))
})

test('targeting: an Attack reaches only aliens in range and line of sight; with none it says why; a Move card reaches farther', () => {
  const { battle, hero, aliens } = arena([], [{ x: 13, y: 10 }])
  hero.stats = { ...hero.stats, move: 4 }
  battle.pile.hand = [{ id: 'pointBlank', level: 1 }, { id: 'rush', level: 1 }]
  battle.energy = 3
  expect(targetsOf(battle, battle.pile.hand[0])).toEqual([])
  expect(whyNot(battle, 0, aliens[0].id)).toBe('No target in range 1.')
  expect(targetsOf(battle, battle.pile.hand[1]).map((u) => u.id)).toEqual([aliens[0].id])
  // A wall between them blocks the shot.
  battle.pile.hand = [{ id: 'frag', level: 1 }]
  expect(targetsOf(battle, battle.pile.hand[0])).toHaveLength(1)
  for (let y = 0; y < GRID; y++) {
    battle.bulk[y * GRID + 12] = 2
    battle.props[y * GRID + 12] = 'stack'
  }
  expect(targetsOf(battle, battle.pile.hand[0])).toEqual([])
})

test("an alien's intent shows its damage; moving out of its reach answers it", () => {
  const { battle, hero, aliens } = arena([], [{ x: 12, y: 10 }])
  aliens[0].stats = { ...aliens[0].stats, range: 3, damage: 5, crit: 0 }
  hero.stats = { ...hero.stats, move: 5 }
  expect(intents(battle)).toEqual([expect.objectContaining({ id: aliens[0].id, kind: 'attack', target: hero.id })])
  play(battle, 'takeCover')
  expect(distance(hero, aliens[0])).toBeGreaterThan(3)
  expect(battle.intents[0].kind).toBe('move')
  const hp = hero.hp
  endTurn(battle)
  while (battle.stage === 'enemy') stepBattle(battle)
  expect(hero.hp).toBe(hp)
})

test('piles: the hand is discarded at the end of the turn but Retain; the discard reshuffles into an empty draw pile; Exhaust and Powers leave for the battle', () => {
  const { battle, aliens } = arena([], [{ x: 11, y: 10 }])
  battle.pile = { draw: [], hand: [{ id: 'shadowStep', level: 1 }, { id: 'defend', level: 1 }], discard: [{ id: 'jab', level: 1 }], exhaust: [] }
  endTurn(battle)
  expect(battle.pile.hand.map((c) => c.id)).toEqual(['shadowStep'])
  expect(battle.pile.discard.map((c) => c.id)).toEqual(['jab', 'defend'])
  draw(battle, 1)
  expect(battle.pile.discard).toEqual([])
  expect(battle.pile.hand).toHaveLength(2)
  play(battle, 'overcharged', aliens[0].id)
  play(battle, 'tracer')
  expect(battle.pile.exhaust.map((c) => c.id)).toEqual(['overcharged', 'tracer'])
  expect(CARDS.tracer.type).toBe('power')
})

test('a stunned hero gains no Energy; the battle waits on the hero only in the play stage', () => {
  const { battle, hero } = arena([], [{ x: 14, y: 10 }])
  hero.panicked = true
  beginTurn(battle)
  expect(battle.energy).toBe(0)
  expect(awaiting(battle)).toBe(true)
})

function markUnit(u: { mark: number }) {
  u.mark = 2
}
