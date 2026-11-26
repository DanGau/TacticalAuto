import { expect, test } from 'vitest'
import { arena } from './arena'
import { apply } from './apply'
import { bots } from '../bots/bots'
import { BURN_MAX, CHILL_FREEZE, CHRONO_EVERY, CHILL_MAX,    FRACTURE_DAMAGE, FRESH, GRID, HIGH_CRIT, isSoldier } from './battle'
import { endBattle } from './debrief'
import { knockback, knocksInto } from './knockback'
import { mend, SLAM_DAMAGE } from './wound'
import { TUNING } from './tuning'
import { STREAK_FIGHTS } from './relics'
import { gainRelic } from './rewards'
import { begun } from './roads'
import { createRun } from './run'
import { fight } from './roads'
import { chillUnit, died, fell, highCrit, kindle } from './stacks'
import { upkeep } from './upkeep'
import { beginTurn, ENERGY } from './turn'
import type { GameEvent } from './combat-event'

test('every battle of a run starts with no stacks, counts or battle bonuses', () => {
  for (const seed of [3, 4]) {
    const run = createRun(seed)
    const rng = { rng: seed }
    let fights = 0
    while (run.phase !== 'won' && run.phase !== 'lost' && fights < 6) {
      if (run.phase === 'battle' && run.battle!.phase === 'battle') {
        fight(run)
        continue
      }
      const deploying = run.phase === 'battle' && run.battle!.phase === 'deploy'
      expect(apply(run, bots.strategic(run, rng)).ok).toBe(true)
      if (!deploying) continue
      fights++
      const battle = run.battle!
      for (const u of battle.units) {
        // Cryo Charges chill the aliens as the hero lands.
        expect(u).toMatchObject(run.relics.includes('cryo') ? { ...FRESH, chill: u.chill } : FRESH)
        if (isSoldier(u)) expect(u.armor).toBeLessThanOrEqual(u.stats.armor + 2)
      }
    }
    expect(fights).toBeGreaterThan(2)
  }
})

test('burn stacks: each source adds, to at most BURN_MAX; a burning alien takes its stacks each turn, then loses one', () => {
  const { battle, aliens } = arena([], [{ x: 14, y: 10 }])
  kindle(battle, aliens[0], 2)
  kindle(battle, aliens[0], 3)
  expect(aliens[0].burn).toBe(5)
  kindle(battle, aliens[0], 9)
  expect(aliens[0].burn).toBe(BURN_MAX)
  battle.turn = 'alien'
  upkeep(battle)
  expect(aliens[0]).toMatchObject({ hp: 40 - BURN_MAX, burn: BURN_MAX - 1 })
})

test('chill stacks: at CHILL_FREEZE an alien freezes; a boss never does, and holds CHILL_MAX; chill wears off as its turn ends', () => {
  const { battle, aliens } = arena([], [{ x: 14, y: 10 }, { x: 15, y: 10 }])
  const events: GameEvent[] = []
  chillUnit(battle, aliens[0], CHILL_FREEZE, events)
  expect(aliens[0]).toMatchObject({ frozen: true, panicked: true })
  aliens[1].boss = true
  chillUnit(battle, aliens[1], 9, events)
  expect(aliens[1]).toMatchObject({ frozen: false, chill: CHILL_MAX })
  battle.turn = 'human'
  upkeep(battle)
  expect(aliens[1].chill).toBe(CHILL_MAX - 1)
  expect(aliens[0].chill).toBe(CHILL_FREEZE)
})

test("Kinetic Engine: a slam or a fall the hero causes does the hero's damage again; Kilned gear adds a burn stack on a slam", () => {
  const { battle, hero, aliens } = arena(['impetus', 'kiln'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  hero.stats = { ...hero.stats, damage: 5 }
  battle.actor = hero.id
  knockback(battle, hero, aliens[0], [])
  expect(aliens[0]).toMatchObject({ hp: 40 - SLAM_DAMAGE - 5, burn: 1 })
  for (let x = 0; x < GRID; x++) battle.height[10 * GRID + x] = x <= 12 ? 4 : 0
  expect(fell(battle, aliens[1], 4, [])).toBe(5)
})

test('Domino Rig: an alien knocked into another knocks that one back too; a hero knocks only into something', () => {
  const { battle, hero, aliens } = arena(['domino'], [{ x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }, { x: 11, y: 12 }])
  battle.actor = hero.id
  knockback(battle, hero, aliens[0], [])
  expect(aliens[2]).toMatchObject({ x: 14, y: 10 })
  expect(aliens[1].hp).toBeLessThan(40)
  expect(knocksInto(battle, { x: 10, y: 12 }, aliens[3])).toBe(false)
})

test('on-hit and on-kill healing gives a hero at most TUNING.healCap a battle by each source', () => {
  const { hero } = arena([], [{ x: 11, y: 10 }])
  hero.hp = 1
  for (let i = 0; i < 5; i++) mend(hero, 2, 'feast', [])
  mend(hero, 2, 'vampiric', [])
  expect(hero.hp).toBe(1 + TUNING.healCap + 2)
})

test('Chrono Coil: every CHRONO_EVERY rounds the hero gains 1 Energy more', () => {
  const { battle } = arena(['chrono'], [{ x: 11, y: 10 }])
  battle.round = CHRONO_EVERY - 1
  beginTurn(battle)
  expect(battle.energy).toBe(ENERGY)
  battle.round = CHRONO_EVERY
  beginTurn(battle)
  expect(battle.energy).toBe(ENERGY + 1)
})

test('Unbroken Line: every STREAK_FIGHTS fights in a row won pay more', () => {
  const run = begun(1)
  gainRelic(run, 'streak', true)
  const pays: number[] = []
  for (let i = 0; i < STREAK_FIGHTS; i++) {
    run.phase = 'overworld'
    apply(run, { type: 'go', index: 1 })
    apply(run, { type: 'advance' })
    apply(run, { type: 'enter' })
    Object.assign(run.battle!, { phase: 'over', winner: 'human' })
    endBattle(run)
    pays.push(run.report!.supplies)
  }
  expect(run.streak).toBe(STREAK_FIGHTS)
  expect(pays[1]).toBe(pays[0] + 3)
})

test('Lofty gear: crit for each level above the target', () => {
  const { battle, hero, aliens } = arena(['lofty'], [{ x: 11, y: 10 }])
  battle.height[10 * GRID + 10] = 3
  expect(highCrit(battle, hero, aliens[0])).toBeCloseTo(3 * HIGH_CRIT)
})

test("Witch's Hex passes a dead alien's stacks on; Frost Fracture shatters a frozen one over those beside it", () => {
  const { battle, aliens } = arena(['hex', 'fracture'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  Object.assign(aliens[0], { mark: 2, frozen: true, chill: 3 })
  died(battle, aliens[0], [])
  expect(aliens[1].mark).toBe(2)
  expect(aliens[1].hp).toBe(40 - FRACTURE_DAMAGE * 3)
})

