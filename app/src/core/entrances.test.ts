import { SUITS } from './features'
import { expect, test } from 'vitest'
import { apply } from './apply'
import { GRID, isSoldier, type Battle } from './battle'
import { stepBattle } from './combat'
import { COMMANDER_GAP, ENTRANCE_KINDS, ENTRY_MARGIN, LOOK_TURNS, TAP_DAMAGE, TAP_REACH, type EntranceKind, closeBy, LOOK_REACH } from './entrances'
import { distance, edgeDepths, nearestAlien } from './grid'
import type { Goal } from './goals'
import { current } from './run'
import { type Run } from './run-state'
import { begun, stagedAs, enterAt, road } from './roads'
import { TUNING } from './tuning'
import { RALLY_EVERY, rally } from './upkeep'

/** A run about to make its entrance in its first battle, of `goal`. */
function entering(seed = 1, goal: Goal = 'exterminate'): Run & { battle: Battle } {
  const run = begun(seed)
  apply(run, { type: 'go', index: 1 })
  Object.assign(current(run)!.stop!, { goal, challenge: null })
  apply(run, { type: 'advance' })
  return run as Run & { battle: Battle }
}

test('a battle stages one entrance, by the fight, with every alien but burrowers in sight and none yet engaged', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { battle } = entering(seed)
    expect(distance(battle.entrance!.at, battle.arena)).toBeLessThanOrEqual(battle.arena.reach + 8)
    for (const alien of battle.units.filter((u) => u.side === 'alien')) expect(alien).toMatchObject({ engaged: false, revealed: alien.kind !== 'burrower' })
  }
})

test("every battlefield's entrance stands where the ground supports it and suits its place", () => {
  for (const terrain of ['town', 'city', 'countryside', 'industrial', 'ruins', 'hive'] as const) {
    for (let seed = 1; seed <= 12; seed++) {
      const run = begun(seed)
      apply(run, { type: 'go', index: 1 })
      Object.assign(current(run)!.stop!, { challenge: null, goal: 'exterminate', terrain })
      apply(run, { type: 'advance' })
      const battle = run.battle!
      const { kind, at, feature } = battle.entrance!
      expect(ENTRANCE_KINDS[kind].fits?.(battle, at) ?? true).toBe(true)
      if (feature) expect(SUITS[terrain] as string[]).toContain(kind)
    }
  }
})

test("a push's entrance lies ahead of its clusters on the axis; a flood's by what it holds", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const push = entering(seed).battle
    const aliens = push.units.filter((u) => u.side === 'alien')
    const near = (t: { x: number; y: number }) => Math.min(...aliens.map((a) => distance(a, t)))
    expect(near(push.entrance!.at)).toBeGreaterThanOrEqual(2)
    expect(distance(push.entrance!.at, push.approach)).toBeLessThan(distance(push.entrance!.at, push.arena) + 12)
    const hold = entering(seed, 'hold').battle
    expect(distance(hold.entrance!.at, hold.uplink!)).toBeLessThanOrEqual(9)
  }
})

test('the arena and every entrance lie inside the map, clear of its edge', () => {
  for (const goal of ['exterminate', 'vip', 'hold', 'rescue', 'assassinate'] as Goal[]) {
    for (let seed = 1; seed <= 12; seed++) {
      const { battle } = entering(seed, goal)
      const { x, y, reach } = battle.arena
      for (const v of [x - reach, y - reach]) expect(v).toBeGreaterThanOrEqual(0)
      for (const v of [x + reach, y + reach]) expect(v).toBeLessThan(GRID)
      const depth = edgeDepths(battle)
      const { at } = battle.entrance!
      expect(depth[at.y * GRID + at.x]).toBeGreaterThan(ENTRY_MARGIN)
    }
  }
})

test("an assassination never stages its entrance near the commander", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { battle } = entering(seed, 'assassinate')
    const commander = battle.units.find((u) => u.target)!
    expect(distance(battle.entrance!.at, commander)).toBeGreaterThanOrEqual(COMMANDER_GAP)
  }
})

test('entering puts the whole squad down by the entrance and engages only the cluster nearest', () => {
  const run = entering()
  const { at } = run.battle.entrance!
  expect(enterAt(run)).toEqual({ ok: true })
  const squad = run.battle.units.filter(isSoldier)
  expect(squad).toHaveLength(run.soldiers.length)
  for (const unit of squad) expect(distance(unit, at)).toBeLessThanOrEqual(3)
  expect(nearestAlien(run.battle, at)!.engaged).toBe(true)
  const first = nearestAlien(run.battle, at)!
  for (const alien of run.battle.units.filter((u) => u.side === 'alien')) expect(alien.engaged).toBe(alien.cluster === first.cluster)
  expect(run.battle.phase).toBe('battle')
})

test('kicking the door hurts the nearest alien, which loses its first action', () => {
  const run = entering()
  stagedAs(run.battle, 'door')
  const first = nearestAlien(run.battle, run.battle.entrance!.at)!
  enterAt(run)
  expect(stepBattle(run.battle)).toContainEqual({ type: 'hurt', id: first.id, amount: TUNING.impactDamage, cause: 'impact' })
  expect(first.panicked || first.hp <= 0).toBe(true)
})

test('through the wall catches the nearest aliens surprised', () => {
  const run = entering()
  stagedAs(run.battle, 'wall')
  const near = nearestAlien(run.battle, run.battle.entrance!.at)!
  enterAt(run)
  expect(near.surprised).toBe(1)
})

test("a monologue puts the toughest soldier in the spotlight: aliens that can shoot it must", () => {
  const run = entering()
  stagedAs(run.battle, 'monologue')
  enterAt(run)
  const speaker = run.battle.units.filter(isSoldier).reduce((a, b) => (b.hp > a.hp ? b : a))
  expect(run.battle.spotlight).toEqual({ id: speaker.id, until: 2 })
  expect(stepBattle(run.battle)).toContainEqual({ type: 'effect', id: speaker.id, effect: 'taunt', amount: 0 })
})

/** The first battle of `goal` staging `kind`, from seed `from` on; null if 40 seeds stage none. */
function offered(kind: EntranceKind, goal: Goal = 'exterminate', from = 1): (Run & { battle: Battle }) | null {
  for (let seed = from; seed < from + 40; seed++) {
    const run = entering(seed, goal)
    if (run.battle.entrance!.kind === kind) return run
  }
  return null
}

test('a shoulder tap comes in right by an alien, and flattens the nearest', () => {
  const run = offered('tap')!
  const { at } = run.battle.entrance!
  const first = nearestAlien(run.battle, at)!
  expect(distance(first, at)).toBeLessThanOrEqual(TAP_REACH)
  enterAt(run)
  stepBattle(run.battle)
  expect(first.hp).toBeLessThanOrEqual(0)
})

test('a shoulder tap only wounds a boss', () => {
  const run = entering()
  stagedAs(run.battle, 'tap')
  const first = nearestAlien(run.battle, run.battle.entrance!.at)!
  first.boss = true
  first.hp = TAP_DAMAGE + 5
  enterAt(run)
  stepBattle(run.battle)
  expect(first.hp).toBe(5)
})

test('a shoulder tap stays clear of a commander and off a raid', () => {
  for (let from = 1; from <= 41; from += 40) {
    const run = offered('tap', 'assassinate', from)
    if (!run) continue
    const commander = run.battle.units.find((u) => u.target)!
    expect(distance(run.battle.entrance!.at, commander)).toBeGreaterThanOrEqual(COMMANDER_GAP)
  }
  expect(offered('tap', 'raid')).toBeNull()
})

test('look over there lands farther out than a wall, and the nearest aliens do nothing for LOOK_TURNS alien turns', () => {
  const run = offered('look')!
  const { at } = run.battle.entrance!
  const first = nearestAlien(run.battle, at)!
  expect(distance(first, at)).toBeGreaterThanOrEqual(ENTRANCE_KINDS.wall.reach[1])
  for (const alien of run.battle.units.filter((u) => u.side === 'alien')) alien.hp = 10000
  enterAt(run)
  expect(first.surprised).toBe(LOOK_TURNS)
  const aliensActed = new Set(closeBy(run.battle, first, LOOK_REACH).map((u) => u.id))
  let turns = 0
  while (first.surprised > 0 && turns++ < 200) {
    const was = run.battle.turn
    for (const e of stepBattle(run.battle)) if (was === 'alien' && 'id' in e && e.type !== 'hurt' && e.type !== 'effect') expect(aliensActed.has(e.id)).toBe(false)
  }
  expect(first.surprised).toBe(0)
})

test('a big explosion and a stolen kill are style only, and shooting first hurts the nearest alien', () => {
  for (const kind of ['blast', 'mine'] as const) {
    const run = entering()
    stagedAs(run.battle, kind)
    const before = run.battle.units.filter((u) => u.side === 'alien').map((u) => u.hp)
    enterAt(run)
    expect(run.battle.units.filter((u) => u.side === 'alien').map((u) => u.hp)).toEqual(before)
    expect(stepBattle(run.battle).some((e) => e.type === 'hurt')).toBe(false)
  }
  const run = entering()
  stagedAs(run.battle, 'han')
  const first = nearestAlien(run.battle, run.battle.entrance!.at)!
  enterAt(run)
  expect(stepBattle(run.battle)).toContainEqual({ type: 'hurt', id: first.id, amount: TUNING.impactDamage, cause: 'impact' })
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

test('Encore catches the aliens nearest surprised whatever the entrance', () => {
  const run = begun(1)
  run.relics = ['encore']
  apply(run, { type: 'go', index: 1 })
  Object.assign(current(run)!.stop!, { goal: 'exterminate', challenge: null })
  apply(run, { type: 'advance' })
  const battle = run.battle!
  stagedAs(battle, 'blast')
  const near = nearestAlien(battle, battle.entrance!.at)!
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
