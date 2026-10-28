import { PATHS } from './skills'
import { expect, test } from 'vitest'
import { apply } from './apply'
import { stepBattle, UPLINK_REACH } from './combat'
import { CIVILIAN_SUPPLIES, CIVILIANS, HOLD_ROUNDS, type Goal } from './goals'
import { isSoldier, revealed } from './battle'
import { road } from './roads'
import { createRun, endBattle, RISKS, START_SUPPLIES, XP, type Run } from './run'

/** A run about to fight a battle of `goal`, with three packs to muster. */
function before(goal: Goal): Run {
  const run = createRun(1)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
  apply(run, { type: 'go', index: 1 })
  const patrol = { name: 'Patrol', kinds: ['trooper', 'trooper'] as const }
  road(run, [{ kind: 'battle', risk: 'standard', goal, terrain: 'town', twist: null, packs: [patrol, patrol, patrol].map((p) => ({ ...p, kinds: [...p.kinds] })) }])
  apply(run, { type: 'advance' })
  return run
}

test('every battle on the leg under way has its aliens mustered in advance; no other stop has any', () => {
  const run = createRun(1)
  for (const node of run.legs[0].columns.flat()) expect(node.stop!.packs.length > 0).toBe(node.stop!.kind === 'battle')
})

test('a hold offers three landing zones away from the uplink, keeps half its packs back as waves, and is won by lasting', () => {
  const run = before('hold')
  const battle = run.battle!
  expect(battle.zones).toHaveLength(3)
  expect(battle.uplink).not.toBeNull()
  expect(battle.waves).toHaveLength(1)
  apply(run, { type: 'land', zone: 0 })
  battle.held = HOLD_ROUNDS
  stepBattle(battle)
  expect(battle).toMatchObject({ phase: 'over', winner: 'human' })
  endBattle(run)
  expect(run.relicOffers).toHaveLength(3)
  expect(run.finds).toEqual([])
})

test('a hold counts only the rounds the squad ends inside the uplink zone', () => {
  const run = before('hold')
  const battle = run.battle!
  apply(run, { type: 'land', zone: 0 })
  while (battle.round < 3 && battle.phase === 'battle') {
    const [round, held] = [battle.round, battle.held]
    stepBattle(battle)
    if (battle.round > round) expect(battle.held - held).toBe(battle.units.some((u) => isSoldier(u) && Math.max(Math.abs(u.x - battle.uplink!.x), Math.abs(u.y - battle.uplink!.y)) <= UPLINK_REACH) ? 1 : 0)
  }
  expect(battle.held).toBeLessThan(battle.round + 1)
})

test('an assassination is won when the commander falls, though its guard lives', () => {
  const run = before('assassinate')
  const battle = run.battle!
  apply(run, { type: 'land', zone: 0 })
  const commander = battle.units.filter((u) => u.target)
  expect(commander).toHaveLength(1)
  battle.units = battle.units.filter((u) => !u.target)
  stepBattle(battle)
  expect(battle.winner).toBe('human')
  endBattle(run)
  expect(run.finds.length + run.decisions.length).toBeGreaterThan(0)
})

test('a rescue pays supplies and experience for each civilian saved or alive; a raid pays triple supplies', () => {
  const rescue = before('rescue')
  apply(rescue, { type: 'land', zone: 0 })
  expect(rescue.battle!.units.filter((u) => u.civilian)).toHaveLength(CIVILIANS)
  const supplies = rescue.supplies
  // One civilian is lost.
  const lost = rescue.battle!.units.find((u) => u.civilian)
  rescue.battle!.units = rescue.battle!.units.filter((u) => u !== lost)
  const alive = CIVILIANS - 1
  rescue.battle!.winner = 'human'
  endBattle(rescue)
  expect(rescue.report!.rescued).toBe(alive)
  expect(rescue.report!.soldiers[0].earned).toContainEqual({ label: `${alive} civilians saved`, xp: alive * XP.civilian })
  expect(rescue.supplies).toBe(supplies + RISKS.standard.supplies + alive * CIVILIAN_SUPPLIES)

  const raid = before('raid')
  apply(raid, { type: 'land', zone: 0 })
  raid.battle!.winner = 'human'
  endBattle(raid)
  expect(raid.supplies).toBe(START_SUPPLIES + 3 * RISKS.standard.supplies)
  expect(raid.finds).toEqual([])
})

test('rescue civilians hide alone until a soldier sees one, and the squad searches for them while no alien is in the open', () => {
  const run = before('rescue')
  apply(run, { type: 'land', zone: 0 })
  const battle = run.battle!
  const civilians = battle.units.filter((u) => u.civilian)
  expect(civilians.every((u) => !revealed(battle, u))).toBe(true)
  for (const a of civilians) for (const b of civilians) if (a !== b) expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeGreaterThan(1)
  for (let beat = 0; beat < 2000 && battle.found.length === 0 && battle.phase === 'battle'; beat++) {
    const events = stepBattle(battle)
    const found = events.find((e) => e.type === 'found')
    if (found) expect(revealed(battle, battle.units.find((u) => u.id === found.id)!)).toBe(true)
  }
  expect(battle.found.length).toBeGreaterThan(0)
})

test('on a rescue soldiers reach civilians to get them out, and aliens hunt the civilians found', () => {
  let saved = 0
  let shotAt = 0
  for (let seed = 1; seed <= 6; seed++) {
    const run = before('rescue')
    run.battle!.rng = seed
    apply(run, { type: 'land', zone: seed % 3 })
    const battle = run.battle!
    while (battle.phase === 'battle') {
      const civilians = new Set(battle.units.filter((u) => u.civilian).map((u) => u.id))
      for (const e of stepBattle(battle)) {
        if (e.type === 'saved') saved++
        if (e.type === 'shot' && civilians.has(e.target)) shotAt++
      }
    }
    expect(battle.saved).toBeLessThanOrEqual(CIVILIANS)
  }
  expect(saved).toBeGreaterThan(0)
  expect(shotAt).toBeGreaterThan(0)
})
