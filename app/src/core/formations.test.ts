import { expect, test } from 'vitest'
import { alienStats, ALIENS, type AlienKind } from './aliens'
import { ENGAGE_REACH, type Alien, type Unit } from './battle'
import { flowOf, type Goal } from './goals'
import { distance } from './grid'
import { createBattle } from './setup'
import type { TerrainKind } from './terrain'

const KINDS: AlienKind[] = ['trooper', 'trooper', 'spitter', 'brute', 'swarmling', 'swarmling']
const force = (n: number): Alien[] =>
  Array.from({ length: n }, (_, i) => {
    const kind = KINDS[i % KINDS.length]
    return { kind, stats: alienStats(kind, 0, 0), stance: ALIENS[kind].stance, boss: false, spawns: false, target: false, resists: [] }
  })
const PLACES: TerrainKind[] = ['town', 'city', 'countryside', 'industrial', 'ruins']
const layouts = (goal: Goal, n: number) => PLACES.flatMap((place) => Array.from({ length: 12 }, (_, seed) => createBattle(seed + 1, place, force(n), [], goal).units.filter((u) => u.side === 'alien')))
const clustersOf = (aliens: Unit[]) => [...new Set(aliens.map((a) => a.cluster))].map((id) => aliens.filter((a) => a.cluster === id))
const nearestMate = (a: Unit, aliens: Unit[]) => Math.min(...aliens.filter((b) => b !== a).map((b) => distance(a, b)))
const gap = (a: Unit[], b: Unit[]) => Math.min(...a.flatMap((u) => b.map((v) => distance(u, v))))
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

test('spacing is uneven: within a layout the nearest-mate distances vary widely', () => {
  const spreads = layouts('exterminate', 14).map((aliens) => {
    const near = aliens.map((a) => nearestMate(a, aliens))
    const all = aliens.flatMap((a) => aliens.filter((b) => b !== a).map((b) => distance(a, b)))
    return Math.sqrt(mean(all.map((d) => (d - mean(all)) ** 2))) / mean(all) + Math.max(...near) - Math.min(...near)
  })
  expect(spreads.filter((s) => s < 1).length / spreads.length).toBeLessThan(0.1)
})

test('most aliens stand in clusters of two or more, close by a mate, and sizes differ map to map', () => {
  const all = layouts('exterminate', 14)
  const grouped = all.flat().filter((a) => clustersOf(all.find((l) => l.includes(a))!).find((c) => c.includes(a))!.length >= 2)
  expect(grouped.length / all.flat().length).toBeGreaterThan(0.8)
  const close = all.flatMap((aliens) => aliens.filter((a) => nearestMate(a, aliens) <= 3))
  expect(close.length / all.flat().length).toBeGreaterThan(0.7)
  const mixes = all.map((l) => clustersOf(l).map((c) => c.length).sort().join())
  expect(new Set(mixes).size).toBeGreaterThan(all.length / 3)
  expect(all.every((l) => new Set(clustersOf(l).map((c) => c.length)).size >= 2)).toBe(true)
})

test("a push's clusters stand apart, so nearing one need not draw the next", () => {
  const gaps = layouts('exterminate', 12).flatMap((aliens) => clustersOf(aliens).map((c) => gap(c, aliens.filter((a) => !c.includes(a)))))
  expect(gaps.filter((g) => g >= 3).length / gaps.length).toBeGreaterThan(0.8)
})

test('a flood posts few and sends the most as clumps from the gates; a push posts all', () => {
  const flood = createBattle(3, 'city', force(15), [], 'hold')
  expect(flood.flow).toBe('flood')
  expect(flood.units.filter((u) => u.side === 'alien').length).toBe(5)
  expect(flood.waves.flat().length).toBe(10)
  const push = createBattle(3, 'city', force(15), [], 'exterminate')
  expect(push.flow).toBe('push')
  expect(push.waves).toEqual([])
  expect(push.units.filter((u) => u.side === 'alien').length).toBe(15)
})

test('flow follows mission and map', () => {
  for (const goal of ['hold', 'ambush', 'rescue'] as const) expect(flowOf(goal, 'town')).toBe('flood')
  for (const goal of ['exterminate', 'assassinate', 'recover', 'vip'] as const) expect(flowOf(goal, 'town')).toBe('push')
  expect(flowOf('raid', 'town')).toBe('push')
  expect(flowOf('raid', 'ruins')).toBe('flood')
  expect(flowOf('exterminate', 'hive')).toBe('flood')
})

test('a push stands its clusters beyond the wake range of each other, so nearing one wakes only it', () => {
  for (const aliens of layouts('exterminate', 14)) {
    for (const a of aliens) for (const b of aliens) if (a.cluster !== b.cluster) expect(distance(a, b)).toBeGreaterThan(ENGAGE_REACH)
  }
})

test('an assassination that is also a big one stands every alien, its boss clear of the commander\'s retinue', () => {
  const stats = { hp: 1, armor: 0, damage: 1, range: 5, move: 3, crit: 0 }
  const alien = (over: Partial<Alien>): Alien => ({ kind: 'trooper', stats, stance: 'balanced', boss: false, spawns: false, target: false, resists: [], ...over })
  const aliens = [alien({ boss: true }), alien({ target: true }), ...Array.from({ length: 6 }, () => alien({}))]
  const battle = createBattle(559, 'town', aliens, [], 'assassinate', [], null, undefined, 'bigOne')
  expect(battle.units.filter((u) => u.side === 'alien')).toHaveLength(aliens.length)
  expect(battle.units.every((u) => Number.isInteger(u.x) && Number.isInteger(u.y))).toBe(true)
})
