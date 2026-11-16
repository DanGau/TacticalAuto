import { expect, test } from 'vitest'
import { alienStats, ALIENS, type AlienKind } from './aliens'
import { ARENA_KINDS, isBarrier, type ArenaKind } from './arena-kinds'
import { GRID, type Alien } from './battle'
import { CHALLENGES, type ChallengeId } from './challenges'
import { stepBattle } from './combat'
import type { Goal } from './goals'
import { apply } from './apply'
import { current } from './run'
import { begun } from './roads'
import { routeWalk, SHORTCUT } from './route'
import { createBattle } from './setup'
import { TERRAIN_KINDS } from './terrain'
import { UTILITY_IDS, effectsOf, type EffectId } from './utilities'

const KINDS: AlienKind[] = ['trooper', 'brute', 'swarmling', 'spitter']
const force = (n: number): Alien[] => Array.from({ length: n }, (_, i) => ({ kind: KINDS[i % 4], stats: alienStats(KINDS[i % 4], 0, 0), stance: ALIENS[KINDS[i % 4]].stance, boss: false, spawns: false, target: false, resists: [] }))
const GOALS: Goal[] = ['cross', 'assassinate', 'hold', 'rescue', 'ambush']
const CHALLENGE_IDS = [null, ...Object.keys(CHALLENGES)] as (ChallengeId | null)[]

const battles = TERRAIN_KINDS.flatMap((place, p) => Array.from({ length: 16 }, (_, seed) => createBattle(100 * p + seed + 1, place, force(8), [], GOALS[seed % GOALS.length], [], null, undefined, CHALLENGE_IDS[seed % CHALLENGE_IDS.length])))

test.each(battles.map((b, i) => [i, b.place, b.arenaKind, b] as const))('map %i, %s %s: a route runs from the landing to the objective, and the landing is the far end', (_, __, ___, battle) => {
  expect(routeWalk(battle)).toBeLessThan(Infinity)
  expect(Math.hypot(battle.entry!.x - battle.objective.x, battle.entry!.y - battle.objective.y)).toBeGreaterThanOrEqual(20)
})

test('every barrier is fought on, and what opens it makes a route at least SHORTCUT shorter; nothing else does', () => {
  const barriers = Object.keys(ARENA_KINDS).filter((k) => isBarrier(k as ArenaKind)) as ArenaKind[]
  for (const kind of barriers) {
    const of = battles.filter((b) => b.arenaKind === kind)
    expect(of.length, kind).toBeGreaterThanOrEqual(2)
    for (const battle of of) {
      const plain = routeWalk(battle)
      for (const opener of ARENA_KINDS[kind].opens!) expect(routeWalk(battle, [opener]), `${kind} ${opener}`).toBeLessThanOrEqual(plain - SHORTCUT)
      for (const other of ['overcharge', 'thrusters', 'smoke'] as EffectId[]) expect(routeWalk(battle, [other])).toBe(plain)
    }
  }
})

test('on open ground no boon opens a shorter route', () => {
  for (const battle of battles.filter((b) => !isBarrier(b.arenaKind))) {
    const plain = routeWalk(battle)
    for (const id of UTILITY_IDS) expect(routeWalk(battle, effectsOf(id))).toBeGreaterThan(plain - SHORTCUT)
  }
})

/** A run at its first battle, staged on `kind` with the hero holding `utility`, played to its end; the ground of every tile the hero walked. */
function crossing(kind: ArenaKind, utility: 'hover' | 'coldSnap'): { ground: string[]; won: boolean } {
  for (let seed = 1; seed < 400; seed++) {
    const run = begun(seed)
    apply(run, { type: 'go', index: 1 })
    Object.assign(current(run)!.stop!, { goal: 'cross', challenge: null, terrain: 'countryside', aliens: [] })
    apply(run, { type: 'advance' })
    const battle = run.battle!
    if (battle.arenaKind !== kind) continue
    run.utilities = [utility]
    apply(run, { type: 'enter', utility: 0 })
    const hero = battle.units.find((u) => u.soldier === run.hero.id)!
    Object.assign(hero, { hp: 999, stats: { ...hero.stats, hp: 999 } })
    const ground: string[] = []
    while (battle.phase === 'battle') for (const e of stepBattle(battle)) if (e.type === 'move' && e.id === hero.id) ground.push(...e.path.map((t) => battle.ground[t.y * GRID + t.x]))
    return { ground, won: battle.winner === 'human' }
  }
  throw new Error(`no ${kind} found`)
}

test('the hero takes the way its boon opens: Levitation floats it over the chasm, Cold Snap walks it over the ice', () => {
  const chasm = crossing('chasm', 'hover')
  expect(chasm.won).toBe(true)
  expect(chasm.ground).toContain('void')
  const river = crossing('river', 'coldSnap')
  expect(river.won).toBe(true)
  expect(river.ground).toContain('ice')
}, 60_000)
