import { expect, test } from 'vitest'
import { alienStats, ALIENS, type AlienKind } from './aliens'
import { ARENA_KINDS, type ArenaKind } from './arena-kinds'
import { GRID, type Alien } from './battle'
import { distance, openNear, walkingDistances } from './grid'
import { POI_NAMES } from './pois'
import { REGION_IDS, REGIONS } from './regions'
import { createBattle } from './setup'

const KINDS: AlienKind[] = ['trooper', 'spitter', 'brute', 'swarmling', 'juggernaut']
const force = (n: number): Alien[] =>
  Array.from({ length: n }, (_, i) => {
    const kind = KINDS[i % KINDS.length]
    return { kind, stats: alienStats(kind, 0, 0), stance: ALIENS[kind].stance, boss: false, spawns: false, target: false, resists: [] }
  })

const GROUNDS = Object.keys(ARENA_KINDS) as ArenaKind[]
const battles = GROUNDS.flatMap((ground, i) => {
  const region = REGION_IDS.find((id) => REGIONS[id].ground.includes(ground))!
  return Array.from({ length: 8 }, (_, seed) =>
    createBattle(300 + 20 * i + seed, REGIONS[region].kinds[seed % REGIONS[region].kinds.length], force(10), [], (['cross', 'hold', 'rescue'] as const)[seed % 3], [], null, { region, city: REGIONS[region].cities[0], ground }),
  )
})

test('every battle has its landmarks, the objective first and the landing last, each framed about itself', () => {
  for (const b of battles) {
    const kinds = b.pois.map((p) => p.kind)
    expect(kinds[0]).toBe('objective')
    expect(kinds.at(-1)).toBe('landing')
    for (const k of ['hazard', 'vantage', 'strongpoint', 'nest'] as const) expect(kinds, `${b.arenaKind} ${k}`).toContain(k)
    expect(b.pois[0]).toMatchObject(b.objective)
    expect(b.pois.at(-1)).toMatchObject(b.entry!)
    for (const p of b.pois) {
      expect(p.label).toMatch(/^[A-Z][a-zA-Z-]*( [A-Z][a-zA-Z-]*){0,2}$/)
      expect(distance(p, p.frame)).toBeLessThanOrEqual(p.frame.extent)
    }
  }
})

test('every landmark can be reached on foot from the landing', () => {
  for (const b of battles) {
    const walk = walkingDistances(b, b.entry!)
    for (const p of b.pois) {
      const at = openNear(b, p)
      expect(walk[at.y * GRID + at.x], `${b.arenaKind} ${p.kind}`).toBeLessThan(Infinity)
    }
  }
})

test('clusters form about landmarks: cover at the strongpoint, aliens at each nest, the hazard its own', () => {
  for (const b of battles) {
    const near = (p: { x: number; y: number }, reach: number, is: (t: number) => boolean) =>
      b.props.filter((_, t) => is(t) && distance({ x: t % GRID, y: Math.floor(t / GRID) }, p) <= reach).length
    const strong = b.pois.find((p) => p.kind === 'strongpoint')!
    expect(near(strong, 5, (t) => b.bulk[t] > 0 && !['void', 'water'].includes(b.props[t])), b.arenaKind).toBeGreaterThanOrEqual(3)
    for (const nest of b.pois.filter((p) => p.kind === 'nest')) expect(b.units.filter((u) => u.side === 'alien' && distance(u, nest) <= nest.frame.extent).length).toBeGreaterThanOrEqual(1)
    const hazard = b.pois.find((p) => p.kind === 'hazard')!
    expect(near(hazard, 6, (t) => ['fuel', 'growth', 'void', 'water'].includes(b.props[t]) || ['mire', 'ice'].includes(b.ground[t])), b.arenaKind).toBeGreaterThanOrEqual(1)
  }
})

test('grounds differ: each names its landmarks its own way', () => {
  const sets = GROUNDS.map((g) => Object.values(POI_NAMES[g]).join('|'))
  expect(new Set(sets).size).toBe(GROUNDS.length)
  for (const g of GROUNDS) expect(new Set(battles.filter((b) => b.arenaKind === g).flatMap((b) => b.pois.map((p) => p.label))), g).toContain(POI_NAMES[g].vantage)
})
