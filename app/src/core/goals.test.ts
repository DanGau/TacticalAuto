import { PATHS } from './skills'
import { expect, test } from 'vitest'
import { apply } from './apply'
import { stepBattle } from './combat'
import { CIVILIANS, HOLD_ROUNDS, type Goal } from './goals'
import { createRun, endBattle, RISKS, START_SUPPLIES, XP, type Run } from './run'

/** A run about to fight a battle of `goal`, with three packs to muster. */
function before(goal: Goal): Run {
  const run = createRun(1)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
  apply(run, { type: 'zone', index: 1 })
  const patrol = { name: 'Patrol', kinds: ['trooper', 'trooper'] as const }
  run.zone = { stops: [{ kind: 'battle', risk: 'standard', goal, terrain: 'town', packs: [patrol, patrol, patrol].map((p) => ({ ...p, kinds: [...p.kinds] })) }] }
  apply(run, { type: 'advance' })
  return run
}

test('every battle at a fork has its aliens mustered in advance; no other stop has any', () => {
  const run = createRun(1)
  for (const stop of run.zones.flatMap((zone) => zone.stops)) expect(stop.packs.length > 0).toBe(stop.kind === 'battle')
})

test('a hold offers three landing zones away from the uplink, keeps half its packs back as waves, and is won by lasting', () => {
  const run = before('hold')
  const battle = run.battle!
  expect(battle.zones).toHaveLength(3)
  expect(battle.uplink).not.toBeNull()
  expect(battle.waves).toHaveLength(1)
  apply(run, { type: 'land', zone: 0 })
  battle.round = HOLD_ROUNDS + 1
  stepBattle(battle)
  expect(battle).toMatchObject({ phase: 'over', winner: 'human' })
  endBattle(run)
  expect(run.relicOffers).toHaveLength(3)
  expect(run.finds).toEqual([])
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

test('a rescue pays experience for each civilian kept alive; a raid pays triple supplies', () => {
  const rescue = before('rescue')
  apply(rescue, { type: 'land', zone: 0 })
  expect(rescue.battle!.units.filter((u) => u.civilian)).toHaveLength(CIVILIANS)
  // One civilian is lost.
  const lost = rescue.battle!.units.find((u) => u.civilian)
  rescue.battle!.units = rescue.battle!.units.filter((u) => u !== lost)
  const alive = CIVILIANS - 1
  rescue.battle!.winner = 'human'
  endBattle(rescue)
  expect(rescue.report!.rescued).toBe(alive)
  expect(rescue.report!.soldiers[0].earned).toContainEqual({ label: `${alive} civilians saved`, xp: alive * XP.civilian })

  const raid = before('raid')
  apply(raid, { type: 'land', zone: 0 })
  raid.battle!.winner = 'human'
  endBattle(raid)
  expect(raid.supplies).toBe(START_SUPPLIES + 3 * RISKS.standard.supplies)
  expect(raid.finds).toEqual([])
})
