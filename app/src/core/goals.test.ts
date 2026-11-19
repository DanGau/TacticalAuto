import { powerOf } from './skills'
import { expect, test } from 'vitest'
import { apply } from './apply'
import { stepBattle } from './combat'
import { fightPath, goalOf } from './pathing'
import { skirmish } from './abilities'
import { soldierUnit } from './spawn'
import type { GameEvent } from './combat-event'
import { CIVILIAN_SUPPLIES, CIVILIANS, CIVILIANS_PER_THREAT, HOLD_ROUNDS, RESCUE_QUORUM, type Goal } from './goals'
import { GRID, isSoldier } from './battle'
import { freeTilesNear, walkingDistances } from './grid'
import { distance } from './grid'
import { road, enterAt, begun } from './roads'
import { type Run } from './run-state'
import { endBattle } from './debrief'
import { RISKS } from './missions'
import { XP } from './hero'
import { LOSS_THREAT } from './progress'
import { STOP_THREAT } from './progress'
import { THREAT_MAX } from './progress'

/** A run about to fight a battle of `goal`, with six aliens. */
function before(goal: Goal): Run {
  const run = begun(1)
  run.hero.skills = [powerOf(run.hero.cls!)]
  apply(run, { type: 'go', index: 1 })
  road(run, [{ kind: 'battle', risk: 'standard', goal, terrain: 'town', challenge: null, twist: null, aliens: Array.from({ length: 6 }, () => 'trooper' as const) }])
  apply(run, { type: 'advance' })
  return run
}

test('every challenge on the leg under way has its aliens mustered in advance; no stop but a challenge has any', () => {
  const run = begun(1)
  for (const node of run.legs[0].columns.flat()) expect(node.stop!.aliens.length > 0).toBe(node.stop!.challenge !== null)
})

test('a hold sets its uplink at the objective, the landing at the far end; held, it is won', () => {
  const run = before('hold')
  const battle = run.battle!
  expect(battle.uplink).toEqual(battle.objective)
  expect(Math.hypot(battle.entry!.x - battle.uplink!.x, battle.entry!.y - battle.uplink!.y)).toBeGreaterThanOrEqual(22)
  expect(battle.waves.length).toBeGreaterThan(0)
  enterAt(run)
  battle.held = HOLD_ROUNDS
  stepBattle(battle)
  expect(battle.winner).toBe('human')
  endBattle(run)
  expect(run.relicOffers).toHaveLength(3)
})

test('a crossing is won once the hero reaches the extraction zone at the objective, aliens or not', () => {
  const run = before('cross')
  const battle = run.battle!
  expect(battle.extract).toEqual(battle.objective)
  enterAt(run)
  const soldier = battle.units.find(isSoldier)!
  Object.assign(soldier, freeTilesNear(battle, battle.extract!, 3)[1])
  while (battle.phase === 'battle' && battle.beat < 20) stepBattle(battle)
  expect(battle.units.some((u) => u.side === 'alien')).toBe(true)
  expect(battle.winner).toBe('human')
})

test('a rescue pays supplies and experience for each civilian saved or alive', () => {
  const rescue = before('rescue')
  enterAt(rescue)
  expect(rescue.battle!.units.filter((u) => u.civilian)).toHaveLength(CIVILIANS)
  const supplies = rescue.supplies
  // One civilian is lost.
  const lost = rescue.battle!.units.find((u) => u.civilian)
  rescue.battle!.units = rescue.battle!.units.filter((u) => u !== lost)
  const alive = CIVILIANS - 1
  rescue.battle!.winner = 'human'
  endBattle(rescue)
  expect(rescue.report!.rescued).toBe(alive)
  expect(rescue.report!.hero!.earned).toContainEqual({ label: `${alive} civilians saved`, xp: alive * XP.civilian })
  expect(rescue.supplies).toBe(supplies + RISKS.standard.supplies + alive * CIVILIAN_SUPPLIES)

})

test('a rescue is won, and pays, only with more than RESCUE_QUORUM civilians saved', () => {
  for (const saved of [RESCUE_QUORUM, RESCUE_QUORUM + 1]) {
    const run = before('rescue')
    enterAt(run)
    const battle = run.battle!
    battle.units = battle.units.filter((u) => !u.civilian)
    battle.saved = saved
    const supplies = run.supplies
    stepBattle(battle)
    expect(battle.winner).toBe(saved > RESCUE_QUORUM ? 'human' : 'alien')
    endBattle(run)
    expect(run.supplies > supplies).toBe(saved > RESCUE_QUORUM)
  }
})

/** A rescue whose hero has crossed to the objective and stands there rooted and harmless, so only the aliens act on the civilians. */
function terror(seed: number): Run {
  const run = before('rescue')
  run.battle!.rng = seed
  enterAt(run)
  for (const s of run.battle!.units.filter(isSoldier)) Object.assign(s, freeTilesNear(run.battle!, run.battle!.objective, 9)[8], { rooted: 999, ability: null, effects: [], hp: 500, spent: ['throw', 'throw', 'throw'], stats: { ...s.stats, damage: 0, hp: 500 } })
  return run
}

test('a rescue scatters its civilians about the objective, every alien in sight', () => {
  const run = before('rescue')
  const battle = run.battle!
  const civilians = battle.units.filter((u) => u.civilian)
  expect(Math.min(...civilians.map((c) => distance(c, battle.objective)))).toBeLessThanOrEqual(10)
  expect(battle.units.filter((u) => u.side === 'alien').every((u) => u.revealed)).toBe(true)
})

test('on a rescue aliens with no soldier to fight kill civilians', () => {
  const battle = terror(2).battle!
  for (const s of battle.units.filter(isSoldier)) Object.assign(s, { cloaked: 99, stats: { ...s.stats, range: 0 } })
  for (const u of battle.units.filter((u) => u.side === 'alien')) u.engaged = true
  const civilians = new Set(battle.units.filter((u) => u.civilian).map((u) => u.id))
  let killed = 0
  while (battle.phase === 'battle' && battle.round < 10) for (const e of stepBattle(battle)) if (e.type === 'death' && civilians.has(e.id)) killed++
  expect(killed).toBeGreaterThan(0)
})

test('a rescue mixes civilians who hide, huddling and staying put, with civilians who run from the aliens', () => {
  const run = terror(3)
  const battle = run.battle!
  const civilians = battle.units.filter((u) => u.civilian)
  expect(new Set(civilians.map((u) => u.civilian))).toEqual(new Set(['hider', 'runner']))
  stepBattle(battle)
  while (battle.turn !== 'human') stepBattle(battle)
  const hidden = civilians.filter((u) => u.civilian === 'hider' && battle.units.includes(u)).map((u) => ({ u, x: u.x, y: u.y }))
  let ran = false
  for (let i = 0; i < 40 && battle.phase === 'battle'; i++)
    for (const e of stepBattle(battle)) {
      const mover = e.type === 'move' ? civilians.find((c) => c.id === e.id) : undefined
      if (mover?.civilian === 'runner') ran = true
      expect(hidden.some((h) => h.u === mover)).toBe(false)
    }
  expect(hidden.length).toBeGreaterThan(0)
  expect(ran).toBe(true)
})

test('on a rescue a soldier makes for the alien nearest a civilian, and with none near one, for the nearest civilian', () => {
  const run = before('rescue')
  enterAt(run)
  const battle = run.battle!
  const soldier = battle.units.find(isSoldier)!
  const alien = battle.units.find((u) => u.side === 'alien')!
  const civilian = battle.units.find((u) => u.civilian)!
  battle.units = battle.units.filter((u) => u === soldier || u === alien || u === civilian)
  Object.assign(alien, { revealed: true, engaged: true })
  Object.assign(soldier, { x: GRID >> 1, y: GRID >> 1 }, freeTilesNear(battle, { x: GRID >> 1, y: GRID >> 1 }, 1)[0])
  const tiles = freeTilesNear(battle, soldier, GRID * GRID)
  Object.assign(alien, tiles.find((t) => distance(t, soldier) === 10))
  Object.assign(civilian, tiles.find((t) => distance(t, alien) === 6 && distance(t, soldier) === 14))
  expect(goalOf(battle, soldier, [alien])).toBe(alien)
  // Hunting no one, the alien is passed by for the civilian.
  Object.assign(civilian, tiles.find((t) => distance(t, alien) > 12 && distance(t, soldier) === 14))
  expect(goalOf(battle, soldier, [alien])).toBe(civilian)
})

test('a civilian a harvester kills rises on the next alien turn as a husk', () => {
  const run = terror(2)
  const battle = run.battle!
  const harvester = battle.units.find((u) => u.kind === 'harvester')!
  expect(harvester).toBeDefined()
  battle.units = battle.units.filter((u) => u.side !== 'alien' || u === harvester)
  // Beside the hider farthest from the team, which stays put.
  const soldier = battle.units.find(isSoldier)!
  const prey = battle.units.filter((u) => u.civilian === 'hider').sort((a, b) => distance(b, soldier) - distance(a, soldier))[0]
  // Neither falls before the harvest.
  harvester.hp = harvester.stats.hp = 999
  harvester.stats.damage = 99
  soldier.hp = soldier.stats.hp = 999
  Object.assign(harvester, freeTilesNear(battle, prey, 30).find((t) => distance(t, prey) === 2))
  let died = false
  while (battle.phase === 'battle' && !battle.units.some((u) => u.kind === 'husk')) {
    for (const e of stepBattle(battle)) if (e.type === 'death' && !battle.units.some((u) => u.id === e.id)) died = true
    expect(battle.round).toBeLessThan(20)
  }
  expect(died).toBe(true)
  expect(battle.units.find((u) => u.kind === 'husk')!.engaged).toBe(true)
})

test('on a rescue soldiers reach civilians to get them out', () => {
  let saved = 0
  for (let seed = 1; seed <= 6; seed++) {
    const run = before('rescue')
    run.battle!.rng = seed
    enterAt(run)
    const battle = run.battle!
    // Only the harvesters, sighted, so a lone soldier lives long enough; the hero already across.
    battle.units = battle.units.filter((u) => u.side !== 'alien' || u.kind === 'harvester')
    for (const s of battle.units.filter(isSoldier)) Object.assign(s, freeTilesNear(battle, battle.objective, 9)[8])
    for (const u of battle.units) Object.assign(u, { revealed: true, engaged: true })
    while (battle.phase === 'battle') for (const e of stepBattle(battle)) if (e.type === 'saved') saved++
    expect(battle.saved).toBeLessThanOrEqual(CIVILIANS)
  }
  expect(saved).toBeGreaterThan(0)
})

test('left-behind civilians on a lost rescue add threat', () => {
  const run = before('rescue')
  enterAt(run)
  const battle = run.battle!
  const threat = run.threat
  battle.winner = 'alien'
  endBattle(run)
  expect(run.threat).toBe(Math.min(THREAT_MAX, threat + STOP_THREAT + LOSS_THREAT + Math.floor(CIVILIANS / CIVILIANS_PER_THREAT)))
})

test('no one shot kills a commander from full health; brought low, it blinks away', () => {
  const run = before('assassinate')
  const battle = run.battle!
  enterAt(run)
  const commander = battle.units.find((u) => u.target)!
  // An landing's impact would hurt it first.
  battle.opening = false
  commander.hp = commander.stats.hp
  battle.units = battle.units.filter((u) => u.side !== 'alien' || u === commander)
  Object.assign(commander, { revealed: true, engaged: true })
  const soldier = battle.units.find(isSoldier)!
  Object.assign(soldier, freeTilesNear(battle, commander, 2)[1], { weapon: 'sniper', spent: ['throw', 'throw', 'throw'], stats: { ...soldier.stats, damage: 99, crit: 1, move: 0 } })
  Object.assign(battle, { turn: 'human', stage: 'move' })
  const events: GameEvent[] = []
  while (battle.phase === 'battle' && !events.some((e) => e.type === 'shot' && e.target === commander.id)) events.push(...stepBattle(battle))
  expect(commander.hp).toBe(1)
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: commander.id, effect: 'lastStand', amount: 0 }))
  expect(events).toContainEqual(expect.objectContaining({ type: 'move', id: commander.id, with: 'blink' }))
})

/** A battle of `goal` with its aliens gone but for what the test adds, and the extraction zone a long walk from its soldier. */
function gettingOut(goal: Goal) {
  const run = before(goal)
  const battle = run.battle!
  enterAt(run)
  const soldier = battle.units.find(isSoldier)!
  battle.units = battle.units.filter((u) => u.side !== 'alien')
  battle.waves = []
  battle.uplink = null
  battle.extract = freeTilesNear(battle, soldier, 2000).find((t) => distance(t, soldier) === 20)!
  return { battle, soldier }
}

test('getting out, a slow hero leaves what it would stand beside, and takes no step back', () => {
  const { battle, soldier } = gettingOut('hold')
  const toExtract = walkingDistances(battle, battle.extract!)
  const walk = (t: { x: number; y: number }) => toExtract[t.y * GRID + t.x]
  soldier.stats = { ...soldier.stats, move: 1 }
  soldier.effects = ['skirmish']
  const mate = soldierUnit(battle, { soldier: 99, stats: soldier.stats, hp: 9, ability: null, charges: 0, stance: 'balanced', effects: [] }, freeTilesNear(battle, soldier, 8).reduce((a, b) => (walk(b) > walk(a) ? b : a)))
  battle.units.push(mate)
  const from = walk(soldier)
  expect(walk(fightPath(battle, soldier).at(-1)!)).toBeLessThan(from)
  expect(skirmish(battle, soldier)).toEqual([])
})

