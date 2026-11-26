import { expect, test } from 'vitest'
import { apply } from './apply'
import { type Battle } from './battle'
import { CARDS, SIGNATURES, STRIKES } from './cards'
import { awaiting, stepBattle } from './combat'
import { distance } from './grid'
import { begun, enterAt } from './roads'
import { current } from './run'
import { type Run } from './run-state'
import { DRAW, ENERGY, heroOf, targetsOf, whyNot } from './turn'
import { wound } from './wound'

/** A run on its first battle, stepped to the hero's first turn. */
function turn(seed: number): { run: Run; battle: Battle } {
  const run = begun(seed)
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'cross'
  apply(run, { type: 'advance' })
  enterAt(run)
  const battle = run.battle!
  while (!awaiting(battle)) stepBattle(battle)
  return { run, battle }
}

test('the starter deck: 4 of the weapon\'s Strike, 4 Defend, Dash and the class\'s signature card', () => {
  const run = begun(1)
  const ids = run.deck.map((c) => c.id)
  expect(ids.filter((id) => id === STRIKES.rifle)).toHaveLength(4)
  expect(ids.filter((id) => id === 'defend')).toHaveLength(4)
  expect(ids).toContain('dash')
  expect(ids).toContain(SIGNATURES.sniper)
  expect(ids).toHaveLength(10)
})

test('a turn begins with its Energy and a hand drawn; ending it discards the hand and the aliens act', () => {
  const { run, battle } = turn(1)
  expect(battle.energy).toBe(ENERGY)
  expect(battle.pile.hand).toHaveLength(DRAW)
  expect(battle.pile.draw).toHaveLength(run.deck.length - DRAW)
  expect(apply(run, { type: 'endTurn' }).ok).toBe(true)
  expect(battle.pile.hand).toHaveLength(0)
  expect(battle.pile.discard).toHaveLength(DRAW)
  expect(battle.stage).toBe('enemy')
  while (!awaiting(battle) && battle.phase === 'battle') stepBattle(battle)
  // The draw pile ran short: the discard was shuffled in.
  expect(battle.pile.hand.length + battle.pile.draw.length + battle.pile.discard.length).toBe(run.deck.length)
})

test('an Attack with no target in range is unplayable and says why; a move card brings one in reach', () => {
  let seen = 0
  for (let seed = 1; seed <= 8; seed++) {
    const { run, battle } = turn(seed)
    const hero = heroOf(battle)!
    const alien = battle.units.find((u) => u.side === 'alien' && u.revealed)
    if (!alien) continue
    battle.units = [hero, alien]
    battle.pile.hand = [{ id: STRIKES.rifle, level: 1 }, { id: 'dash', level: 1 }]
    Object.assign(alien, { x: hero.x + hero.stats.range + 2, y: hero.y })
    if (targetsOf(battle, battle.pile.hand[0]).length > 0) continue
    expect(whyNot(battle, 0, alien.id)).toBe(`No target in range ${hero.stats.range}.`)
    expect(apply(run, { type: 'play', index: 0, target: alien.id }).ok).toBe(false)
    expect(apply(run, { type: 'play', index: 1, target: alien.id }).ok).toBe(true)
    stepBattle(battle)
    if (targetsOf(battle, battle.pile.hand[0]).length === 0) continue
    expect(distance(hero, alien)).toBeLessThanOrEqual(hero.stats.range)
    seen++
  }
  expect(seen).toBeGreaterThan(0)
})

test('Block takes damage first and falls to 0 at the hero\'s next turn', () => {
  const { run, battle } = turn(2)
  const hero = heroOf(battle)!
  battle.pile.hand = [{ id: 'defend', level: 1 }]
  apply(run, { type: 'play', index: 0, target: null })
  stepBattle(battle)
  expect(hero.block).toBe(5)
  const hp = hero.hp
  wound(battle, hero, 3, [])
  expect(hero.hp).toBe(hp)
  expect(hero.block).toBe(2)
  apply(run, { type: 'endTurn' })
  while (!awaiting(battle) && battle.phase === 'battle') stepBattle(battle)
  expect(hero.block).toBe(0)
})

test('a card costs its Energy; with too little it cannot be played', () => {
  const { run, battle } = turn(3)
  battle.pile.hand = [{ id: 'shieldWall', level: 1 }, { id: 'shieldWall', level: 1 }]
  expect(apply(run, { type: 'play', index: 0, target: null }).ok).toBe(true)
  stepBattle(battle)
  expect(battle.energy).toBe(ENERGY - 2)
  expect(whyNot(battle, 0, null)).toBe('Not enough Energy.')
})

test('a Power lends its effect for the battle and leaves the deck for it; Retain keeps a card at the end of the turn', () => {
  const { run, battle } = turn(4)
  battle.pile.hand = [{ id: 'incendiary', level: 1 }, { id: 'shadowStep', level: 1 }]
  apply(run, { type: 'play', index: 0, target: null })
  stepBattle(battle)
  expect(heroOf(battle)!.effects).toContain(CARDS.incendiary.lends)
  expect(battle.pile.exhaust.map((c) => c.id)).toEqual(['incendiary'])
  apply(run, { type: 'endTurn' })
  expect(battle.pile.hand.map((c) => c.id)).toEqual(['shadowStep'])
})

test('a reward: take 1 of 3 or Skip; a safehouse rests or upgrades', () => {
  const run = begun(5)
  run.phase = 'reward'
  run.cardOffers = ['frag', 'rush', 'lure']
  const size = run.deck.length
  expect(apply(run, { type: 'card', index: 1 }).ok).toBe(true)
  expect(run.deck).toHaveLength(size + 1)
  run.phase = 'reward'
  run.cardOffers = ['frag', 'rush', 'lure']
  apply(run, { type: 'card', index: null })
  expect(run.deck).toHaveLength(size + 1)
  run.phase = 'reward'
  run.upgrading = true
  apply(run, { type: 'upgrade', index: 0 })
  expect(run.deck[0].level).toBe(2)
})
