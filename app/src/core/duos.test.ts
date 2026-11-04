import { expect, test } from 'vitest'
import { heal } from './abilities'
import { apply } from './apply'
import { arena } from './arena'
import type { Tile, Unit } from './battle'
import { CLASSES } from './classes'
import type { GameEvent } from './combat-event'
import { duoCrit, duoDamage, duoHit, firefall } from './duo-effects'
import { DUO_IDS, DUOS, openDuos, PAYLOAD_DAMAGE, SHATTER_HIT, SHATTER_SPLASH, type DuoId } from './duos'
import { pincer } from './follow-ups'
import { begun } from './roads'
import { settle } from './rewards'

test('each duo pairs two different classes, and no two share a pair or a name', () => {
  const pairs = DUO_IDS.map((id) => [...DUOS[id].pair].sort().join('+'))
  for (const id of DUO_IDS) {
    const [a, b] = DUOS[id].pair
    expect(CLASSES[a] && CLASSES[b] && a !== b).toBeTruthy()
  }
  expect(new Set(pairs).size).toBe(DUO_IDS.length)
  expect(new Set(DUO_IDS.map((id) => DUOS[id].name)).size).toBe(DUO_IDS.length)
})

test('a duo is offered beside relics only to a squad with its pair, and taken in place of one', () => {
  const run = begun(1)
  run.soldiers[0].cls = 'pyro'
  expect(openDuos(run)).not.toContain('thermalShock')
  run.soldiers.push({ ...run.soldiers[0], id: 99, name: 'Ng', cls: 'cryo' })
  expect(openDuos(run)).toContain('thermalShock')
  Object.assign(run, { relicOffers: ['plasma'], duoOffer: 'thermalShock' })
  settle(run)
  expect(apply(run, { type: 'duo' })).toEqual({ ok: true })
  expect(run).toMatchObject({ duos: ['thermalShock'], duoOffer: null, relicOffers: [], relics: [] })
  expect(openDuos(run)).not.toContain('thermalShock')
})

/** An arena with the hero and a mate at `at` paired as duo `id`, the hero first unless `second`. */
function duo(id: DuoId, at: Tile, spots: Tile[], second = false) {
  const a = arena([], spots)
  const mate: Unit = { ...a.hero, ...at, id: 3000, soldier: 99, effects: [], spent: [], stats: { ...a.hero.stats } }
  a.battle.units.push(mate)
  a.battle.duos.pairs = [{ id, heroes: second ? [99, a.hero.soldier!] : [a.hero.soldier!, 99] }]
  return { ...a, mate }
}

const plain = { crit: false, unseen: false }
const fired = (events: GameEvent[], id: DuoId) => events.some((e) => e.type === 'duo' && e.duo === id)

test('Thermal Shock shatters a target both burning and chilled', () => {
  const { battle, hero, aliens } = duo('thermalShock', { x: 2, y: 2 }, [{ x: 12, y: 10 }, { x: 13, y: 10 }])
  const [target, beside] = aliens
  Object.assign(target, { burn: 2, chill: 2 })
  const events: GameEvent[] = []
  duoHit(battle, hero, target, 1, plain, [beside], events)
  expect(fired(events, 'thermalShock')).toBe(true)
  expect(target).toMatchObject({ hp: 40 - SHATTER_HIT, burn: 0, chill: 0 })
  expect(beside.hp).toBe(40 - SHATTER_SPLASH)
})

test("Spotter makes the Deadeye's hits near the Phantom crits", () => {
  const { battle, hero, aliens, mate } = duo('spotting', { x: 13, y: 10 }, [{ x: 12, y: 10 }])
  expect(duoCrit(battle, hero, aliens[0], [])).toBe(true)
  mate.x = 2
  expect(duoCrit(battle, hero, aliens[0], [])).toBe(false)
})

test("Lifeline reaches the Vanguard anywhere and turns overflow into armor; Cold Comfort chills those beside", () => {
  for (const id of ['lifeline', 'coldComfort'] as const) {
    const { battle, hero, mate, aliens } = duo(id, { x: 30, y: 30 }, [{ x: 31, y: 30 }])
    Object.assign(hero, { ability: 'medic', charges: 2 })
    mate.hp = id === 'lifeline' ? mate.stats.hp - 1 : 1
    if (id === 'coldComfort') Object.assign(mate, { x: 11, y: 10 })
    Object.assign(aliens[0], id === 'coldComfort' ? { x: 12, y: 10 } : {})
    const events = heal(battle, hero)
    expect(fired(events, id)).toBe(true)
    if (id === 'lifeline') expect(mate).toMatchObject({ hp: mate.stats.hp, armor: 3 })
    else expect(aliens[0].chill).toBeGreaterThan(0)
  }
})

test('Hammer and Anvil stuns beside the Vanguard; Flash Freeze freezes a chilled alien on a crit', () => {
  const anvil = duo('anvil', { x: 13, y: 10 }, [{ x: 12, y: 10 }])
  const events: GameEvent[] = []
  duoHit(anvil.battle, anvil.hero, anvil.aliens[0], 1, plain, [], events)
  expect(anvil.aliens[0].panicked && fired(events, 'anvil')).toBe(true)
  const freeze = duo('flashFreeze', { x: 2, y: 2 }, [{ x: 12, y: 10 }])
  freeze.aliens[0].chill = 2
  duoHit(freeze.battle, freeze.hero, freeze.aliens[0], 1, { crit: true, unseen: false }, [], events)
  expect(freeze.aliens[0].panicked && fired(events, 'flashFreeze')).toBe(true)
})

test("Target Painter marks who hits the Gadgeteer's mech; Napalm Payload bursts it destroyed", () => {
  for (const id of ['painter', 'payload'] as const) {
    const { battle, hero, aliens } = duo(id, { x: 2, y: 2 }, [{ x: 12, y: 10 }])
    const mech: Unit = { ...hero, id: 4000, soldier: null, summoner: hero.soldier, x: 12, y: 11, hp: id === 'payload' ? 0 : 3, effects: [], spent: [] }
    battle.units.push(mech)
    const events: GameEvent[] = []
    duoHit(battle, aliens[0], mech, 3, plain, [], events)
    expect(fired(events, id)).toBe(true)
    if (id === 'painter') expect(aliens[0].marked).toBe(true)
    else expect(aliens[0]).toMatchObject({ hp: 40 - PAYLOAD_DAMAGE, burn: expect.any(Number) })
  }
})

test('Firefall sets burning each alien a Meteor Strike hits', () => {
  const { battle, hero, aliens } = duo('firefall', { x: 2, y: 2 }, [{ x: 12, y: 10 }])
  const events = firefall(battle, hero, [{ type: 'rocket', id: hero.id, x: 12, y: 10, hits: [{ target: aliens[0].id, damage: 4 }] }])
  expect(fired(events, 'firefall') && aliens[0].burn > 0).toBe(true)
})

test('Pincer sends the Phantom at the alien the Vanguard hit, once a round', () => {
  const { battle, hero, aliens, mate } = duo('pincer', { x: 12, y: 11 }, [{ x: 12, y: 10 }])
  duoHit(battle, hero, aliens[0], 1, plain, [], [])
  const seen = new Set([aliens[0].id])
  const events = pincer(battle, hero, seen)
  expect(fired(events, 'pincer') && events.some((e) => e.type === 'shot' && e.id === mate.id)).toBe(true)
  expect(pincer(battle, hero, seen)).toEqual([])
})

test('Crossfire adds damage on an alien the other hit this round', () => {
  const { battle, hero, aliens, mate } = duo('crossfire', { x: 2, y: 2 }, [{ x: 12, y: 10 }])
  expect(duoDamage(battle, hero, aliens[0], [])).toBe(0)
  duoHit(battle, mate, aliens[0], 1, plain, [], [])
  expect(duoDamage(battle, hero, aliens[0], [])).toBe(2)
  battle.round++
  expect(duoDamage(battle, hero, aliens[0], [])).toBe(0)
})

test("Afterglow gives the Beacon back a heal when the Phantom kills out of cloak", () => {
  const { battle, hero, aliens, mate } = duo('afterglow', { x: 2, y: 2 }, [{ x: 12, y: 10 }])
  Object.assign(hero, { ability: 'medic', charges: 0 })
  aliens[0].hp = 0
  duoHit(battle, mate, aliens[0], 5, { crit: false, unseen: true }, [], [])
  expect(hero.charges).toBe(1)
})
