import { expect, test } from 'vitest'
import { createBattle, GRID, NEIGHBORS, onGrid } from './battle'
import { PROP_COVER } from './terrain'

test.each([1, 2, 3, 4, 5, 6, 7, 8])('map %i: cover matches its props, a town is there, and every open tile can be walked to', (seed) => {
  const battle = createBattle(seed, [], [])
  expect(battle.cover).toEqual(battle.props.map((prop) => PROP_COVER[prop]))
  expect(battle.ground.filter((g) => g === 'road').length).toBeGreaterThan(GRID * 3)
  const share = battle.cover.filter((c) => c > 0).length / battle.cover.length
  expect(share).toBeGreaterThan(0.08)
  expect(share).toBeLessThan(0.35)

  const start = battle.cover.indexOf(0)
  const reached = new Set([start])
  const queue = [start]
  for (const tile of queue) {
    for (const [dx, dy] of NEIGHBORS) {
      const x = (tile % GRID) + dx
      const y = Math.floor(tile / GRID) + dy
      if (!onGrid(x, y) || battle.cover[y * GRID + x] > 0 || reached.has(y * GRID + x)) continue
      reached.add(y * GRID + x)
      queue.push(y * GRID + x)
    }
  }
  expect(reached.size).toBe(battle.cover.filter((c) => c === 0).length)
})

test('a building has a floor a soldier can stand on, behind walls with windows', () => {
  const battles = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => createBattle(seed, [], []))
  const withHouse = battles.filter((b) => b.ground.includes('floor'))
  expect(withHouse.length).toBeGreaterThan(0)
  for (const battle of withHouse) {
    expect(battle.props).toContain('wall')
    expect(battle.props).toContain('window')
    expect(battle.ground.some((g, i) => g === 'floor' && battle.cover[i] === 0)).toBe(true)
  }
})
