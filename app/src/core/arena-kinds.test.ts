import { expect, test } from 'vitest'
import { alienStats, ALIENS, type AlienKind } from './aliens'
import { ARENA_KINDS, type ArenaKind } from './arena-kinds'
import { GRID, type Alien } from './battle'
import { distance, ledge, NEIGHBORS, onGrid, reachableFrom, walkingDistances } from './grid'
import { createBattle } from './setup'
import { TERRAIN_KINDS } from './terrain'

const KINDS: AlienKind[] = ['trooper', 'spitter', 'brute', 'swarmling', 'juggernaut']
const force = (n: number): Alien[] =>
  Array.from({ length: n }, (_, i) => {
    const kind = KINDS[i % KINDS.length]
    return { kind, stats: alienStats(kind, 0, 0), stance: ALIENS[kind].stance, boss: false, spawns: false, target: false, resists: [] }
  })

const battles = TERRAIN_KINDS.flatMap((place) => Array.from({ length: 14 }, (_, seed) => createBattle(seed + 1, place, force(10), [], seed % 4 === 3 ? 'hold' : 'exterminate')))

test('every arena kind is fought on', () => {
  for (const kind of Object.keys(ARENA_KINDS) as ArenaKind[]) expect(battles.filter((b) => b.arenaKind === kind).length, kind).toBeGreaterThanOrEqual(3)
})

test.each(battles.map((b, i) => [i, b.place, b.arenaKind, b] as const))('map %i, %s %s: the landing opens on the arena, every alien can walk to it, and the shaped ground has its ledges', (_, __, kind, battle) => {
  const entry = battle.entry!
  const reached = reachableFrom(battle, entry)
  const walk = walkingDistances(battle, entry)
  // The squad lands on the arena's ground, not on a pillar: most of the open ground about the fight is in its reach.
  let open = 0
  let joined = 0
  for (let t = 0; t < GRID * GRID; t++) {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    if (battle.bulk[t] > 0 || distance(tile, battle.arena) > battle.arena.reach) continue
    open++
    if (reached[t]) joined++
  }
  expect(joined / open).toBeGreaterThan(0.85)
  for (const alien of battle.units.filter((u) => u.side === 'alien' && u.stats.move > 0)) expect(walk[alien.y * GRID + alien.x], `${alien.kind} at ${alien.x},${alien.y}`).toBeLessThan(Infinity)
  if (kind === 'open') return
  let drops = 0
  for (let t = 0; t < GRID * GRID; t++) {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    if (battle.ground[t] === 'void' || distance(tile, battle.arena) > battle.arena.reach) continue
    if (NEIGHBORS.some(([dx, dy]) => onGrid(tile.x + dx, tile.y + dy) && (battle.ground[t + dy * GRID + dx] === 'void' || ledge(battle, tile, { x: tile.x + dx, y: tile.y + dy })))) drops++
  }
  expect(drops).toBeGreaterThan(20)
})
