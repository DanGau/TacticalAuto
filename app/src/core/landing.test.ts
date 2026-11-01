import { expect, test } from 'vitest'
import { apply } from './apply'
import { GRID, isSoldier, type Battle } from './battle'
import { stepBattle } from './combat'
import { COMMANDER_GAP, ENTRY_MARGIN } from './landing'
import { distance, edgeDepths, nearestAlien } from './grid'
import type { Goal } from './goals'
import { current } from './run'
import { type Run } from './run-state'
import { begun, enterAt, road } from './roads'
import { RALLY_EVERY, rally } from './upkeep'

/** A run about to make its landing in its first battle, of `goal`. */
function entering(seed = 1, goal: Goal = 'exterminate'): Run & { battle: Battle } {
  const run = begun(seed)
  apply(run, { type: 'go', index: 1 })
  Object.assign(current(run)!.stop!, { goal, challenge: null })
  apply(run, { type: 'advance' })
  return run as Run & { battle: Battle }
}

test('a battle stages one landing, by the fight, with every alien but burrowers in sight and none yet engaged', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { battle } = entering(seed)
    expect(distance(battle.entry!, battle.arena)).toBeLessThanOrEqual(battle.arena.reach + 8)
    for (const alien of battle.units.filter((u) => u.side === 'alien')) expect(alien).toMatchObject({ engaged: false, revealed: alien.kind !== 'burrower' })
  }
})

test("a push's landing lies ahead of its clusters on the axis; a flood's by what it holds", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const push = entering(seed).battle
    const aliens = push.units.filter((u) => u.side === 'alien')
    const near = (t: { x: number; y: number }) => Math.min(...aliens.map((a) => distance(a, t)))
    expect(near(push.entry!)).toBeGreaterThanOrEqual(2)
    expect(distance(push.entry!, push.approach)).toBeLessThan(distance(push.entry!, push.arena) + 12)
    const hold = entering(seed, 'hold').battle
    expect(distance(hold.entry!, hold.uplink!)).toBeLessThanOrEqual(9)
  }
})

test('the arena and every landing lie inside the map, clear of its edge', () => {
  for (const goal of ['exterminate', 'vip', 'hold', 'rescue', 'assassinate'] as Goal[]) {
    for (let seed = 1; seed <= 12; seed++) {
      const { battle } = entering(seed, goal)
      const { x, y, reach } = battle.arena
      for (const v of [x - reach, y - reach]) expect(v).toBeGreaterThanOrEqual(0)
      for (const v of [x + reach, y + reach]) expect(v).toBeLessThan(GRID)
      const depth = edgeDepths(battle)
      const at = battle.entry!
      expect(depth[at.y * GRID + at.x]).toBeGreaterThan(ENTRY_MARGIN)
    }
  }
})

test("an assassination never stages its landing near the commander", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { battle } = entering(seed, 'assassinate')
    const commander = battle.units.find((u) => u.target)!
    expect(distance(battle.entry!, commander)).toBeGreaterThanOrEqual(COMMANDER_GAP)
  }
})

test('entering puts the whole squad down by the landing and engages only the cluster nearest', () => {
  const run = entering()
  const at = run.battle.entry!
  expect(enterAt(run)).toEqual({ ok: true })
  const squad = run.battle.units.filter(isSoldier)
  expect(squad).toHaveLength(run.soldiers.length)
  for (const unit of squad) expect(distance(unit, at)).toBeLessThanOrEqual(3)
  expect(nearestAlien(run.battle, at)!.engaged).toBe(true)
  const first = nearestAlien(run.battle, at)!
  for (const alien of run.battle.units.filter((u) => u.side === 'alien')) expect(alien.engaged).toBe(alien.cluster === first.cluster)
  expect(run.battle.phase).toBe('battle')
})

test('with nobody left fighting, the next cluster comes whole after RALLY_EVERY rounds', () => {
  const run = begun(1)
  apply(run, { type: 'go', index: 1 })
  road(run, [{ kind: 'battle', risk: 'standard', goal: 'exterminate', terrain: 'town', challenge: null, twist: null, aliens: Array.from({ length: 12 }, () => 'trooper' as const) }])
  apply(run, { type: 'advance' })
  enterAt(run)
  const battle = run.battle!
  battle.units = battle.units.filter((u) => u.side !== 'alien' || !u.engaged)
  const waiting = () => battle.units.filter((u) => u.side === 'alien' && !u.engaged)
  const before = waiting().length
  battle.round = battle.rallied + RALLY_EVERY - 1
  rally(battle)
  expect(waiting()).toHaveLength(before)
  battle.round = battle.rallied + RALLY_EVERY
  rally(battle)
  const engaged = battle.units.filter((u) => u.side === 'alien' && u.engaged)
  expect(engaged.length).toBeGreaterThan(0)
  expect(new Set(engaged.map((u) => u.cluster)).size).toBe(1)
})

test('Encore catches the aliens nearest surprised as the squad lands', () => {
  const run = begun(1)
  run.relics = ['encore']
  apply(run, { type: 'go', index: 1 })
  Object.assign(current(run)!.stop!, { goal: 'exterminate', challenge: null })
  apply(run, { type: 'advance' })
  const battle = run.battle!
  const near = nearestAlien(battle, battle.entry!)!
  enterAt(run)
  expect(near.surprised).toBeGreaterThanOrEqual(1)
})

test('every flow ends with nothing to choose: bots play each goal to a winner, under the beat limit', () => {
  for (const goal of ['exterminate', 'hold', 'rescue', 'raid', 'vip', 'assassinate'] as Goal[]) {
    for (let seed = 1; seed <= 3; seed++) {
      const run = entering(seed, goal)
      apply(run, { type: 'enter' })
      // Heroes that never move: rally and waves must still settle it.
      for (const u of run.battle.units.filter(isSoldier)) u.stats = { ...u.stats, move: 0, range: 0 }
      while (run.battle.phase === 'battle') stepBattle(run.battle)
      expect(run.battle.phase).toBe('over')
    }
  }
})
