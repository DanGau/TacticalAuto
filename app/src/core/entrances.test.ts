import { expect, test } from 'vitest'
import { apply } from './apply'
import { ENTRANCES, GRID, isSoldier, type Battle } from './battle'
import { stepBattle } from './combat'
import { COMMANDER_GAP, ENTRANCE_KINDS, ENTRY_MARGIN, LOOK_TURNS, STRIKE, TAP_DAMAGE, TAP_REACH, type EntranceKind } from './entrances'
import { distance, edgeDepths, nearestAlien } from './grid'
import type { Goal } from './goals'
import { current } from './run'
import { type Run } from './run-state'
import { begun, entranceOf, enterAt, road } from './roads'
import { TUNING } from './tuning'
import { RALLY_EVERY, rally } from './upkeep'

/** A run choosing its entrance for its first battle, of `goal`. */
function entering(seed = 1, goal: Goal = 'exterminate'): Run & { battle: Battle } {
  const run = begun(seed)
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = goal
  apply(run, { type: 'advance' })
  return run as Run & { battle: Battle }
}

test('a battle offers entrances of different kinds, each by the fight, with every alien but burrowers in sight and none yet engaged', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { battle } = entering(seed)
    expect(battle.entrances).toHaveLength(ENTRANCES)
    expect(new Set(battle.entrances.map((e) => e.kind)).size).toBe(ENTRANCES)
    for (const { at } of battle.entrances) expect(distance(at, battle.arena)).toBeLessThanOrEqual(battle.arena.reach + 8)
    for (const pod of battle.pods) expect(pod.engaged).toBe(false)
    battle.pods.forEach((pod, i) => {
      const burrowers = battle.units.filter((u) => u.pod === i).every((u) => u.kind === 'burrower')
      expect(pod.revealed).toBe(!burrowers)
    })
  }
})

test('every battlefield offers three entrances, each where the ground supports it: a door at a doorway, a wall at a wall, a skylight under a roof, a rope on high ground', () => {
  for (const terrain of ['town', 'city', 'countryside', 'industrial', 'ruins', 'hive'] as const) {
    for (let seed = 1; seed <= 12; seed++) {
      const run = begun(seed)
      apply(run, { type: 'go', index: 1 })
      Object.assign(current(run)!.stop!, { goal: 'exterminate', terrain })
      apply(run, { type: 'advance' })
      const battle = run.battle!
      expect(battle.entrances).toHaveLength(ENTRANCES)
      for (const { kind, at } of battle.entrances) expect(ENTRANCE_KINDS[kind].fits?.(battle, at) ?? true).toBe(true)
    }
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
      for (const { at } of battle.entrances) expect(depth[at.y * GRID + at.x]).toBeGreaterThan(ENTRY_MARGIN)
    }
  }
})

test("an assassination never offers an entrance near the commander", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { battle } = entering(seed, 'assassinate')
    const commander = battle.units.find((u) => u.target)!
    for (const { at } of battle.entrances) expect(distance(at, commander)).toBeGreaterThanOrEqual(COMMANDER_GAP)
  }
})

test('entering puts the whole squad down by the entrance and engages only the pod nearest', () => {
  const run = entering()
  const { at } = run.battle.entrances[0]
  expect(enterAt(run, 0)).toEqual({ ok: true })
  const squad = run.battle.units.filter(isSoldier)
  expect(squad).toHaveLength(run.soldiers.length)
  for (const unit of squad) expect(distance(unit, at)).toBeLessThanOrEqual(3)
  const near = nearestAlien(run.battle, at)!.pod!
  run.battle.pods.forEach((pod, i) => expect(pod.engaged).toBe(i === near))
  expect(run.battle.phase).toBe('battle')
})

test('kicking the door hurts the nearest alien, which loses its first action', () => {
  const run = entering()
  const at = run.battle.entrances[entranceOf(run.battle, 'door')].at
  const first = nearestAlien(run.battle, at)!
  enterAt(run, entranceOf(run.battle, 'door'))
  expect(stepBattle(run.battle)).toContainEqual({ type: 'hurt', id: first.id, amount: TUNING.impactDamage, cause: 'impact' })
  expect(first.panicked || first.hp <= 0).toBe(true)
})

test('through the wall catches the nearest pod surprised', () => {
  const run = entering()
  const index = entranceOf(run.battle, 'wall')
  const pod = nearestAlien(run.battle, run.battle.entrances[index].at)!.pod!
  enterAt(run, index)
  expect(run.battle.pods[pod].surprised).toBe(1)
})

test("a monologue puts the toughest soldier in the spotlight: aliens that can shoot it must", () => {
  const run = entering()
  enterAt(run, entranceOf(run.battle, 'monologue'))
  const speaker = run.battle.units.filter(isSoldier).reduce((a, b) => (b.hp > a.hp ? b : a))
  expect(run.battle.spotlight).toEqual({ id: speaker.id, until: 2 })
  expect(stepBattle(run.battle)).toContainEqual({ type: 'effect', id: speaker.id, effect: 'taunt', amount: 0 })
})

test('Danger Close wounds the nearest pod, never killing one, for threat', () => {
  const run = entering()
  const index = entranceOf(run.battle, 'strike')
  const pod = nearestAlien(run.battle, run.battle.entrances[index].at)!.pod
  const aliens = run.battle.units.filter((u) => u.side === 'alien')
  const before = aliens.map((u) => u.hp)
  const threat = run.threat
  enterAt(run, index)
  stepBattle(run.battle)
  aliens.forEach((u, i) => u.pod === pod && expect(u.hp).toBe(Math.max(1, before[i] - STRIKE.damage)))
  expect(run.threat).toBe(threat + STRIKE.threat)
})

/** The first battle of `goal` offering `kind`, from seed `from` on; null if 200 seeds offer none. */
function offered(kind: EntranceKind, goal: Goal = 'exterminate', from = 1): (Run & { battle: Battle }) | null {
  for (let seed = from; seed < from + 200; seed++) {
    const run = entering(seed, goal)
    if (run.battle.entrances.some((e) => e.kind === kind)) return run
  }
  return null
}

test('a shoulder tap comes in right by an alien, and flattens the nearest', () => {
  const run = offered('tap')!
  const index = run.battle.entrances.findIndex((e) => e.kind === 'tap')
  const { at } = run.battle.entrances[index]
  const first = nearestAlien(run.battle, at)!
  expect(distance(first, at)).toBeLessThanOrEqual(TAP_REACH)
  enterAt(run, index)
  stepBattle(run.battle)
  expect(first.hp).toBeLessThanOrEqual(0)
})

test('a shoulder tap only wounds a boss', () => {
  const run = entering()
  const index = entranceOf(run.battle, 'tap')
  const first = nearestAlien(run.battle, run.battle.entrances[index].at)!
  first.boss = true
  first.hp = TAP_DAMAGE + 5
  enterAt(run, index)
  stepBattle(run.battle)
  expect(first.hp).toBe(5)
})

test('a shoulder tap stays clear of a commander and off a raid', () => {
  for (let from = 1; from <= 300; from += 50) {
    const run = offered('tap', 'assassinate', from)
    if (!run) continue
    const commander = run.battle.units.find((u) => u.target)!
    expect(distance(run.battle.entrances.find((e) => e.kind === 'tap')!.at, commander)).toBeGreaterThanOrEqual(COMMANDER_GAP)
  }
  expect(offered('tap', 'raid')).toBeNull()
})

test('look over there lands farther out than a wall, and the nearest pod does nothing for LOOK_TURNS alien turns', () => {
  const run = offered('look')!
  const index = run.battle.entrances.findIndex((e) => e.kind === 'look')
  const { at } = run.battle.entrances[index]
  const first = nearestAlien(run.battle, at)!
  expect(distance(first, at)).toBeGreaterThanOrEqual(ENTRANCE_KINDS.wall.reach[1])
  for (const alien of run.battle.units.filter((u) => u.side === 'alien')) alien.hp = 10000
  enterAt(run, index)
  const pod = run.battle.pods[first.pod!]
  expect(pod.surprised).toBe(LOOK_TURNS)
  const aliensActed = new Set(run.battle.units.filter((u) => u.pod === first.pod).map((u) => u.id))
  let turns = 0
  while (pod.surprised > 0 && turns++ < 200) {
    const was = run.battle.turn
    for (const e of stepBattle(run.battle)) if (was === 'alien' && 'id' in e && e.type !== 'hurt' && e.type !== 'effect') expect(aliensActed.has(e.id)).toBe(false)
  }
  expect(pod.surprised).toBe(0)
})

test('a big explosion and a stolen kill are style only, and shooting first hurts the nearest alien', () => {
  for (const kind of ['blast', 'mine'] as const) {
    const run = entering()
    const before = run.battle.units.filter((u) => u.side === 'alien').map((u) => u.hp)
    enterAt(run, entranceOf(run.battle, kind))
    expect(run.battle.units.filter((u) => u.side === 'alien').map((u) => u.hp)).toEqual(before)
    expect(stepBattle(run.battle).some((e) => e.type === 'hurt')).toBe(false)
  }
  const run = entering()
  const index = entranceOf(run.battle, 'han')
  const first = nearestAlien(run.battle, run.battle.entrances[index].at)!
  enterAt(run, index)
  expect(stepBattle(run.battle)).toContainEqual({ type: 'hurt', id: first.id, amount: TUNING.impactDamage, cause: 'impact' })
})

test('pods join the fight one at a time: the next once none fighting stands, or RALLY_EVERY rounds on', () => {
  const run = begun(1)
  apply(run, { type: 'go', index: 1 })
  const patrol = () => ({ name: 'Patrol', kinds: ['trooper' as const, 'trooper' as const] })
  road(run, [{ kind: 'battle', risk: 'standard', goal: 'exterminate', terrain: 'town', twist: null, packs: [patrol(), patrol(), patrol()] }])
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  const battle = run.battle!
  const waiting = () => battle.pods.filter((p, i) => !p.engaged && battle.units.some((u) => u.pod === i)).length
  const before = waiting()
  expect(before).toBe(2)
  battle.round = RALLY_EVERY - 1
  rally(battle)
  expect(waiting()).toBe(before)
  battle.round = RALLY_EVERY
  rally(battle)
  expect(waiting()).toBe(Math.max(0, before - 1))
})
