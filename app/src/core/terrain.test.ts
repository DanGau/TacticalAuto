import { expect, test } from 'vitest'
import { GRID } from './battle'
import { createBattle } from './setup'
import { passable } from './grid'
import { onGrid } from './grid'
import { NEIGHBORS } from './grid'
import { PROP_BULK, TERRAIN_KINDS, ZONE_TERRAINS } from './terrain'

const cases = TERRAIN_KINDS.flatMap((kind) => [1, 2].map((seed) => [kind, seed] as const))

test.each(cases)('%s map %i: bulk matches its props and every open tile can be walked to', (kind, seed) => {
  const battle = createBattle(seed, kind, [], [])
  expect(battle.bulk).toEqual(battle.props.map((prop) => PROP_BULK[prop]))
  const start = battle.bulk.indexOf(0)
  const reached = new Set([start])
  const queue = [start]
  for (const tile of queue) {
    const from = { x: tile % GRID, y: Math.floor(tile / GRID) }
    for (const [dx, dy] of NEIGHBORS) {
      const to = { x: from.x + dx, y: from.y + dy }
      const index = to.y * GRID + to.x
      if (!onGrid(to.x, to.y) || battle.bulk[index] > 0 || reached.has(index) || !passable(battle, from, to)) continue
      reached.add(index)
      queue.push(index)
    }
  }
  expect(reached.size).toBe(battle.bulk.filter((c) => c === 0).length)
})

const maps = new Map<string, ReturnType<typeof createBattle>[]>()

/** The share of tiles of the first sixteen maps of a kind that `count` counts. */
function share(kind: (typeof TERRAIN_KINDS)[number], count: (battle: ReturnType<typeof createBattle>, tile: number) => boolean): number {
  const battles = maps.get(kind) ?? Array.from({ length: 16 }, (_, i) => i + 1).map((seed) => createBattle(seed, kind, [], []))
  maps.set(kind, battles)
  const hits = battles.reduce((sum, battle) => sum + battle.bulk.filter((_, tile) => count(battle, tile)).length, 0)
  return hits / (battles.length * GRID * GRID)
}

test('each kind of place is itself: the countryside is the most open, a city is more indoors than a town, a yard has the most crates; water is no part of a place', () => {
  const solid = (kind: (typeof TERRAIN_KINDS)[number]) => share(kind, (b, t) => (b.bulk[t] > 0 && b.ground[t] !== 'water') || b.north[t] !== 'none' || b.west[t] !== 'none')
  const floor = (kind: (typeof TERRAIN_KINDS)[number]) => share(kind, (b, t) => b.ground[t] === 'floor')
  const crates = (kind: (typeof TERRAIN_KINDS)[number]) => share(kind, (b, t) => b.props[t] === 'crate' || b.props[t] === 'stack')
  for (const kind of ZONE_TERRAINS) {
    if (kind !== 'countryside') expect(solid('countryside')).toBeLessThan(solid(kind))
    if (kind === 'town' || kind === 'countryside') expect(floor('city')).toBeGreaterThan(floor(kind))
    if (kind !== 'industrial') expect(crates('industrial')).toBeGreaterThan(crates(kind))
  }
})

test('a building has walls with windows and a way in', () => {
  const battle = createBattle(3, 'city', [], [])
  const edges = [...battle.north, ...battle.west]
  expect(edges).toContain('wall')
  expect(edges).toContain('window')
  expect(battle.ground.some((g, i) => g === 'floor' && battle.bulk[i] === 0)).toBe(true)
})

test('a satellite stands in a walled compound with a gate on every side, and the hive has nothing human in it', () => {
  const compound = createBattle(2, 'compound', [], [])
  expect([...compound.north, ...compound.west].filter((edge) => edge === 'wall').length).toBeGreaterThan(40)
  const hive = createBattle(2, 'hive', [], [])
  expect(hive.ground.every((ground) => ground === 'hive')).toBe(true)
  expect(hive.props.every((prop) => prop === 'none' || prop === 'spire' || prop === 'growth')).toBe(true)
  expect([...hive.north, ...hive.west].every((edge) => edge === 'none')).toBe(true)
})

test('some battlefields are split by water, which no one can stand in, though shots cross it', () => {
  const battles = Array.from({ length: 20 }, (_, seed) => createBattle(seed, 'countryside', [], []))
  const wet = battles.filter((b) => b.ground.includes('water'))
  expect(wet.length).toBeGreaterThan(0)
  for (const b of wet) b.ground.forEach((g, t) => g === 'water' && expect(b.bulk[t]).toBe(1))
})

