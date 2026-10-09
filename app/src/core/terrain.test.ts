import { expect, test } from 'vitest'
import { createBattle, GRID, NEIGHBORS, onGrid, passable } from './battle'
import { PROP_COVER, TERRAIN_KINDS } from './terrain'

const cases = TERRAIN_KINDS.flatMap((kind) => [1, 2, 3, 4].map((seed) => [kind, seed] as const))

test.each(cases)('%s map %i: cover matches its props and every open tile can be walked to', (kind, seed) => {
  const battle = createBattle(seed, kind, [], [])
  expect(battle.cover).toEqual(battle.props.map((prop) => PROP_COVER[prop]))
  const start = battle.cover.indexOf(0)
  const reached = new Set([start])
  const queue = [start]
  for (const tile of queue) {
    const from = { x: tile % GRID, y: Math.floor(tile / GRID) }
    for (const [dx, dy] of NEIGHBORS) {
      const to = { x: from.x + dx, y: from.y + dy }
      const index = to.y * GRID + to.x
      if (!onGrid(to.x, to.y) || battle.cover[index] > 0 || reached.has(index) || !passable(battle, from, to)) continue
      reached.add(index)
      queue.push(index)
    }
  }
  expect(reached.size).toBe(battle.cover.filter((c) => c === 0).length)
})

/** The share of tiles of the first four maps of a kind that `count` counts. */
function share(kind: (typeof TERRAIN_KINDS)[number], count: (battle: ReturnType<typeof createBattle>, tile: number) => boolean): number {
  const battles = [1, 2, 3, 4].map((seed) => createBattle(seed, kind, [], []))
  const hits = battles.reduce((sum, battle) => sum + battle.cover.filter((_, tile) => count(battle, tile)).length, 0)
  return hits / (battles.length * GRID * GRID)
}

test('each kind of place is itself: the countryside is the most open, a city is more indoors than a town, a yard has the most crates', () => {
  const cover = (kind: (typeof TERRAIN_KINDS)[number]) => share(kind, (b, t) => b.cover[t] > 0 || b.north[t] !== 'none' || b.west[t] !== 'none')
  const floor = (kind: (typeof TERRAIN_KINDS)[number]) => share(kind, (b, t) => b.ground[t] === 'floor')
  const crates = (kind: (typeof TERRAIN_KINDS)[number]) => share(kind, (b, t) => b.props[t] === 'crate' || b.props[t] === 'stack')
  for (const kind of TERRAIN_KINDS) {
    if (kind !== 'countryside') expect(cover('countryside')).toBeLessThan(cover(kind))
    if (kind === 'town' || kind === 'countryside') expect(floor('city')).toBeGreaterThan(floor(kind))
    if (kind !== 'industrial') expect(crates('industrial')).toBeGreaterThan(crates(kind))
  }
})

test('a building has walls with windows and a way in', () => {
  const battle = createBattle(3, 'city', [], [])
  const edges = [...battle.north, ...battle.west]
  expect(edges).toContain('wall')
  expect(edges).toContain('window')
  expect(battle.ground.some((g, i) => g === 'floor' && battle.cover[i] === 0)).toBe(true)
})
