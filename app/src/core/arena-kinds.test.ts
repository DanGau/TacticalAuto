import { expect, test } from 'vitest'
import { alienStats, ALIENS, type AlienKind } from './aliens'
import { ARENA_KINDS, featureOf, pickArenaKind, type ArenaKind } from './arena-kinds'
import { GRID, type Alien, type Battle } from './battle'
import { distance, ledge, NEIGHBORS, onGrid, reachableFrom, walkingDistances } from './grid'
import { createBattle } from './setup'
import { TERRAIN_KINDS } from './terrain'
import { REGION_IDS, REGIONS, type RegionId } from './regions'
import { EFFECTS } from './gear'
import { RELICS } from './relics'
import { SKILLS } from './skills'
import { UTILITIES } from './utilities'

const KINDS: AlienKind[] = ['trooper', 'spitter', 'brute', 'swarmling', 'juggernaut']
const force = (n: number): Alien[] =>
  Array.from({ length: n }, (_, i) => {
    const kind = KINDS[i % KINDS.length]
    return { kind, stats: alienStats(kind, 0, 0), stance: ALIENS[kind].stance, boss: false, spawns: false, target: false, resists: [] }
  })

const GROUNDS = Object.keys(ARENA_KINDS) as ArenaKind[]
const battles = TERRAIN_KINDS.flatMap((place) => Array.from({ length: 6 }, (_, seed) => createBattle(seed + 1, place, force(10), [], seed % 4 === 3 ? 'hold' : 'cross')))
// Each ground on a region it is native to.
for (const [i, ground] of GROUNDS.entries()) {
  const region = REGION_IDS.find((id) => REGIONS[id].ground.includes(ground))!
  for (let seed = 0; seed < 4; seed++) battles.push(createBattle(100 + 10 * i + seed, REGIONS[region].kinds[0], force(10), [], seed % 2 ? 'rescue' : 'cross', [], null, { region, city: REGIONS[region].cities[0], ground }))
}
const marshes = Array.from({ length: 4 }, (_, seed) => createBattle(seed + 1, 'countryside', force(14), [], 'cross', [], null, undefined, 'slog'))
battles.push(...marshes)

test('a Slog is fought in a marsh: beds of mire with firm islands and pools, its aliens in three groups or more', () => {
  for (const b of marshes) {
    expect(b.arenaKind).toBe('marsh')
    expect(b.ground.filter((g) => g === 'mire').length).toBeGreaterThan(100)
    expect(b.ground.some((g) => g === 'water')).toBe(true)
    expect(new Set(b.units.filter((u) => u.side === 'alien').map((u) => u.cluster)).size).toBeGreaterThanOrEqual(3)
  }
})

test('every ground is fought on, and every ground but open shows its feature', () => {
  for (const kind of GROUNDS) {
    const of = battles.filter((b) => b.arenaKind === kind)
    expect(of.length, kind).toBeGreaterThanOrEqual(3)
    for (const b of of) expect(!!featureOf(b), kind).toBe(kind !== 'open')
  }
})

test('every feature has an answer: a boon that exploits it, and a build quantity it multiplies that something makes', () => {
  const makers = [...Object.values(EFFECTS), ...Object.values(RELICS), ...Object.values(SKILLS)].flatMap((f) => f.makes ?? [])
  for (const kind of GROUNDS.filter((k) => k !== 'open')) {
    const { pays, reads } = ARENA_KINDS[kind]
    expect(pays.length, kind).toBeGreaterThan(0)
    for (const effect of pays) expect(UTILITIES[effect], `${kind} ${effect}`).toBeDefined()
    expect(reads.length, kind).toBeGreaterThan(0)
    for (const q of reads) expect(makers, `${kind} ${q}`).toContain(q)
  }
})

/** The share of a battle's arena that is its ground's feature: void, water, mire, ice, or ground 3 levels up or more. */
function makeup(b: Battle): Record<'void' | 'water' | 'mire' | 'ice' | 'high', number> {
  const share = { void: 0, water: 0, mire: 0, ice: 0, high: 0 }
  let n = 0
  for (let t = 0; t < GRID * GRID; t++) {
    if (distance({ x: t % GRID, y: Math.floor(t / GRID) }, b.arena) > b.arena.reach) continue
    n++
    const g = b.ground[t]
    if (g === 'void' || g === 'water' || g === 'mire' || g === 'ice') share[g]++
    else if (b.height[t] >= 3) share.high++
  }
  for (const k of Object.keys(share) as (keyof typeof share)[]) share[k] /= n
  return share
}

test('regions differ: each draws its signature ground most, and regions of different signatures differ in what their arenas are made of', () => {
  for (const region of REGION_IDS) {
    const counts = new Map<ArenaKind, number>()
    const rng = { rng: 7 }
    for (let i = 0; i < 200; i++) {
      const k = pickArenaKind(rng, region, REGIONS[region].kinds[0], null, null)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    expect(top, region).toBe(REGIONS[region].ground[0])
  }
  const mean = (region: RegionId) => {
    const of = Array.from({ length: 6 }, (_, seed) => createBattle(seed + 1, REGIONS[region].kinds[0], force(8), [], 'cross', [], null, { region, city: REGIONS[region].cities[0] })).map(makeup)
    return Object.fromEntries(Object.keys(of[0]).map((k) => [k, of.reduce((s, m) => s + m[k as keyof typeof m], 0) / of.length])) as ReturnType<typeof makeup>
  }
  const canals = mean('canals')
  const downtown = mean('downtown')
  const arctic = mean('arctic')
  const favela = mean('favela')
  expect(canals.water).toBeGreaterThan(2 * downtown.water)
  expect(downtown.void).toBeGreaterThan(2 * canals.void)
  expect(arctic.ice).toBeGreaterThan(2 * favela.ice + 0.01)
  expect(favela.high).toBeGreaterThan(2 * canals.high)
})

test.each(battles.map((b, i) => [i, b.place, b.arenaKind, b] as const))('map %i, %s %s: winnable: the landing opens on the arena, reaches the objective with no boon, every alien can walk to it, and shaped ground has its ledges', (_, __, kind, battle) => {
  const entry = battle.entry!
  const reached = reachableFrom(battle, entry)
  const walk = walkingDistances(battle, entry)
  expect(walkingDistances(battle, battle.objective)[entry.y * GRID + entry.x]).toBeLessThan(Infinity)
  // The hero lands on the arena's ground, not on a pillar: most of the open ground about the fight is in its reach.
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
  if (!['skyscraper', 'overpass', 'quarry', 'rift', 'mesa'].includes(kind)) return
  let drops = 0
  for (let t = 0; t < GRID * GRID; t++) {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    if (battle.ground[t] === 'void' || distance(tile, battle.arena) > battle.arena.reach) continue
    if (NEIGHBORS.some(([dx, dy]) => onGrid(tile.x + dx, tile.y + dy) && (battle.ground[t + dy * GRID + dx] === 'void' || ledge(battle, tile, { x: tile.x + dx, y: tile.y + dy })))) drops++
  }
  expect(drops).toBeGreaterThan(20)
})
