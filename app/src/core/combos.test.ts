import { expect, test } from 'vitest'
import { arena } from './arena'
import { BRIDGE_FACTOR, CHILL_SLIDE, CHILL_TURNS, NUMB_TURNS, THERMAL_FACTOR, isSoldier, LODESTONE_REACH, SHELL_MAX, STAGGER_DAMAGE } from './battle'
import { knockback, pull } from './knockback'
import { SLAM_DAMAGE, wound } from './wound'
import { chillUnit, kindle, markUnit } from './stacks'
import { upkeep } from './upkeep'
import { cancelling, CANCELS, feeds, type Cancel } from './quantities'
import { RELICS, type RelicId } from './relics'
import { EFFECTS } from './gear'
import type { GameEvent } from './combat-event'
import { srcOf } from './sources'
import { sourceName } from './source-names'

const said = (events: GameEvent[], effect: string) => events.some((e) => e.type === 'effect' && e.effect === effect)

test('burn and chill on one alien cancel: both go out, it says so, and it takes no stacks while numb', () => {
  const { battle, aliens } = arena([], [{ x: 14, y: 10 }])
  const events: GameEvent[] = []
  kindle(battle, aliens[0], 3, events)
  chillUnit(battle, aliens[0], 2, events)
  expect(aliens[0]).toMatchObject({ burn: 0, chill: 0, hp: 40, numb: NUMB_TURNS })
  expect(said(events, 'quenched')).toBe(true)
  kindle(battle, aliens[0], 3, events)
  markUnit(aliens[0], 1)
  expect(aliens[0]).toMatchObject({ burn: 0, mark: 0 })
  for (let i = 0; i < NUMB_TURNS; i++) {
    battle.turn = 'alien'
    upkeep(battle)
  }
  kindle(battle, aliens[0], 3, events)
  expect(aliens[0].burn).toBe(3)
})

test('Thermal Shock Core: burn meeting chill detonates for THERMAL_FACTOR times the hero\'s damage a stack of both, half to those beside', () => {
  const { battle, hero, aliens } = arena(['thermal'], [{ x: 14, y: 10 }, { x: 15, y: 10 }])
  hero.stats = { ...hero.stats, damage: 1 }
  battle.actor = hero.id
  kindle(battle, aliens[0], 3)
  chillUnit(battle, aliens[0], 2, [])
  const blast = THERMAL_FACTOR * 5
  expect(aliens[0]).toMatchObject({ burn: 0, chill: 0, numb: 0, hp: 40 - blast })
  expect(aliens[1].hp).toBe(40 - Math.ceil(blast / 2))
})

test('a chilled alien knocked back slides on, and slamming after a slide takes the hero\'s blow', () => {
  const { battle, hero, aliens } = arena([], [{ x: 11, y: 10 }, { x: 11 + 1 + CHILL_SLIDE, y: 10 }])
  battle.actor = hero.id
  aliens[0].chill = 1
  knockback(battle, hero, aliens[0], [])
  expect(aliens[0].x).toBe(11 + CHILL_SLIDE)
  expect(aliens[0].hp).toBe(40 - SLAM_DAMAGE - hero.stats.damage)
  expect(aliens[0]).toMatchObject({ shifted: true, rooted: CHILL_TURNS })
})

test('moving a frozen alien thaws it and moving a marked one clears its marks; Shatterglass Edge and Lock-On Rig strike instead', () => {
  const plain = arena([], [{ x: 11, y: 10 }])
  Object.assign(plain.aliens[0], { chill: 3, frozen: true, panicked: true, mark: 2 })
  const events: GameEvent[] = []
  knockback(plain.battle, plain.hero, plain.aliens[0], events)
  expect(plain.aliens[0]).toMatchObject({ frozen: false, panicked: false, chill: 0, mark: 0, numb: NUMB_TURNS })
  expect(said(events, 'thawed') && said(events, 'unlocked')).toBe(true)
  const bridged = arena(['shatter', 'lockOn'], [{ x: 11, y: 10 }])
  bridged.hero.stats = { ...bridged.hero.stats, damage: 3 }
  bridged.battle.actor = bridged.hero.id
  Object.assign(bridged.aliens[0], { chill: 3, frozen: true, mark: 2 })
  pull(bridged.battle, bridged.aliens[0], bridged.hero, [])
  expect(bridged.aliens[0]).toMatchObject({ frozen: true, mark: 2, numb: 0, hp: 40 - BRIDGE_FACTOR * (3 * 3 + 3 * 2) })
})

test('Stagger Sights: hits on an alien moved since its last turn do more, until its turn', () => {
  const { battle, aliens, beats } = arena(['stagger'], [{ x: 11, y: 10 }])
  aliens[0].shifted = true
  const [shot] = beats(1).filter((e) => e.type === 'shot') as { with: string[] }[]
  expect(shot.with).toContain('stagger')
  expect(STAGGER_DAMAGE).toBeGreaterThan(0)
  battle.turn = 'alien'
  upkeep(battle)
  expect(aliens[0].shifted).toBe(false)
})

test('Lodestone Harness pulls the nearest engaged alien to the hero with the most armor', () => {
  const { battle, hero, aliens } = arena(['lodestone'], [{ x: 10 + LODESTONE_REACH, y: 10 }])
  aliens[0].engaged = true
  battle.turn = 'human'
  upkeep(battle)
  expect(Math.max(Math.abs(aliens[0].x - hero.x), Math.abs(aliens[0].y - hero.y))).toBe(1)
  expect(aliens[0].shifted).toBe(true)
})

test('Reactive Shell: the first hit a hero takes each round gives it armor, to SHELL_MAX past its own', () => {
  const { battle, hero } = arena(['shell'], [{ x: 14, y: 10 }])
  hero.hp = 100
  wound(battle, hero, 1, [], true)
  wound(battle, hero, 1, [], true)
  expect(hero.armor).toBe(hero.stats.armor + 1)
  for (let i = 0; i < SHELL_MAX + 3; i++) {
    battle.round++
    wound(battle, hero, 1, [], true)
  }
  expect(hero.armor).toBe(hero.stats.armor + SHELL_MAX)
  expect(battle.units.filter(isSoldier)).toContain(hero)
})

test('each cancellation has an epic bridge relic that reads both its halves', () => {
  for (const id of Object.keys(CANCELS) as Cancel[]) {
    const bridge = (Object.keys(RELICS) as RelicId[]).find((r) => RELICS[r].bridge === id)!
    expect(RELICS[bridge].rarity).toBe('epic')
    expect(RELICS[bridge].reads).toEqual(expect.arrayContaining([...CANCELS[id].pair]))
  }
  expect(cancelling(['burn', 'chill', 'moved'])).toEqual(['quench', 'thaw'])
})

test('every quantity read is made by two or more relics or gear effects, so combos cross lines', () => {
  const flows = [...Object.values(RELICS), ...Object.values(EFFECTS)]
  // Heroes kill and aliens hurt them in every fight, so nothing need make either.
  for (const q of new Set(flows.flatMap((f) => f.reads ?? []).filter((q) => q !== 'kill' && q !== 'hurt'))) expect(flows.filter((f) => f.makes?.includes(q)).length, q).toBeGreaterThanOrEqual(2)
  expect(feeds(RELICS.stagger, ['moved'], [])).toBe(true)
})

test('a cancellation floats and logs under its own name', () => {
  for (const { effect, name } of Object.values(CANCELS)) expect(sourceName(srcOf(effect))).toBe(name)
})
