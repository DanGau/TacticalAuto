import { expect, test } from 'vitest'
import { arena } from './arena'
import { apply } from './apply'
import { bots } from '../bots/bots'
import { BURN_MAX, CADENCE, CATALYST_EVERY, CHILL_FREEZE, CHILL_MAX, COMBO_MAX, EXPOSED, FAULT, FRACTURE_DAMAGE, FRESH, GRID, HIGH_CRIT, isSoldier, MIGHT_MAX } from './battle'
import { endBattle } from './debrief'
import { knockback, knocksInto } from './knockback'
import { mend, SLAM_DAMAGE } from './wound'
import { TUNING } from './tuning'
import { BOON_CHARGES, STREAK_FIGHTS } from './relics'
import { gainRelic } from './rewards'
import { begun } from './roads'
import { createRun } from './run'
import { step } from './step'
import { chillUnit, chrono, died, empower, fell, highCrit, kindle, lastingArmor } from './stacks'
import { upkeep } from './upkeep'
import { leverage } from './objects'
import type { GameEvent } from './combat-event'

const shots = (events: { type: string }[]) => events.filter((e) => e.type === 'shot') as { type: 'shot'; id: number; target: number; damage: number; with: string[] }[]

test('every battle of a run starts with no stacks, counts or battle bonuses', () => {
  for (const seed of [3, 4]) {
    const run = createRun(seed)
    const rng = { rng: seed }
    let fights = 0
    while (run.phase !== 'won' && run.phase !== 'lost' && fights < 6) {
      if (run.phase === 'battle' && run.battle!.phase === 'battle') {
        step(run)
        continue
      }
      const deploying = run.phase === 'battle' && run.battle!.phase === 'deploy'
      expect(apply(run, bots.strategic(run, rng)).ok).toBe(true)
      if (!deploying) continue
      fights++
      const battle = run.battle!
      expect(battle.kills).toBe(0)
      for (const u of battle.units) {
        // Cryo Charges chill the aliens as the squad lands.
        expect(u).toMatchObject(run.relics.includes('cryo') ? { ...FRESH, chill: u.chill } : FRESH)
        expect(u.twice ?? false).toBe(false)
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

test('Might adds damage to every hit, to at most MIGHT_MAX; Blood Rite gives it for a kill', () => {
  const { hero, aliens, beats } = arena(['bloodRite'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  hero.stats = { ...hero.stats, damage: 3, crit: 0 }
  aliens[0].hp = 1
  const events = beats(2)
  expect(hero.might).toBe(1)
  expect(shots(events).at(-1)).toMatchObject({ damage: 4 })
  empower(hero, 99, 'bloodRite', [])
  expect(hero.might).toBe(MIGHT_MAX)
})

test("Kinetic Engine: a slam or a fall the hero causes does the hero's damage again; Kilned and Hailing gear add a burn or chill stack on a slam", () => {
  const { battle, hero, aliens } = arena(['impetus', 'kiln', 'quench'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  hero.stats = { ...hero.stats, damage: 5 }
  battle.actor = hero.id
  knockback(battle, hero, aliens[0], [])
  expect(aliens[0]).toMatchObject({ hp: 40 - SLAM_DAMAGE - 5, burn: 1, chill: 1 })
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

test("payoffs spend stacks for a share of the hero's damage a stack: a hit at enough burn the burn, any hit the chill, at enough marks the marks", () => {
  const each = 4 * TUNING.spend.factor
  for (const [effect, stacks, worth] of [['accelerant', { burn: 4 }, 4 * each], ['shatter', { chill: 3 }, 3 * each], ['spotter', { mark: 3 }, 3 * each + TUNING.markDamage]] as const) {
    const { hero, aliens, beats } = arena([effect], [{ x: 11, y: 10 }])
    hero.stats = { ...hero.stats, damage: 4, crit: 0 }
    Object.assign(aliens[0], stacks)
    const [shot] = shots(beats(1))
    expect(shot.damage).toBeGreaterThanOrEqual(4 + worth)
    expect(aliens[0][Object.keys(stacks)[0] as 'burn']).toBe(0)
  }
})

test('on-hit and on-kill healing gives a hero at most TUNING.healCap a battle by each source', () => {
  const { hero } = arena([], [{ x: 11, y: 10 }])
  hero.hp = 1
  for (let i = 0; i < 5; i++) mend(hero, 2, 'feast', [])
  mend(hero, 2, 'vampiric', [])
  expect(hero.hp).toBe(1 + TUNING.healCap + 2)
})

test('Toppling gear: a fall the hero causes hurts more by its levels and leaves the alien exposed: hits do half again', () => {
  const { battle, hero, aliens, beats } = arena(['topple'], [{ x: 11, y: 10 }])
  battle.actor = hero.id
  expect(fell(battle, aliens[0], 4, [])).toBe(4)
  expect(aliens[0].exposed).toBe(EXPOSED.turns)
  battle.actor = null
  hero.stats = { ...hero.stats, damage: 4, crit: 0 }
  expect(shots(beats(1))[0]).toMatchObject({ damage: 6 })
})

test('Lasting Guard: armor is whole again each turn, and half of what was kept carries on top, to double', () => {
  const { hero } = arena(['lasting'], [])
  hero.stats = { ...hero.stats, armor: 4 }
  hero.armor = 4
  lastingArmor(hero)
  expect(hero.armor).toBe(6)
  for (let turn = 0; turn < 5; turn++) lastingArmor(hero)
  expect(hero.armor).toBeLessThanOrEqual(8)
  expect(hero.armor).toBeGreaterThan(6)
  hero.armor = 0
  lastingArmor(hero)
  expect(hero.armor).toBe(4)
})

test('Shield Slam: a shield hit does its armor in more damage', () => {
  const { hero, aliens, beats } = arena(['shieldSlam'], [{ x: 11, y: 10 }])
  hero.stats = { ...hero.stats, damage: 2, crit: 0 }
  hero.armor = 5
  expect(shots(beats(1))[0].damage).toBe(2)
  hero.weapon = 'shield'
  const slam = shots(beats(2)).find((s) => s.id === hero.id && s.with.includes('shieldSlam'))
  expect(slam).toBeDefined()
  expect(aliens[0].hp).toBeLessThan(40 - 7)
})

test('Catalyst Prism: every CATALYST_EVERY-th hit doubles the burn, chill and marks on its target', () => {
  const { battle, hero, aliens, beats } = arena(['catalyst'], [{ x: 11, y: 10 }])
  hero.stats = { ...hero.stats, damage: 1, crit: 0 }
  hero.hits = CATALYST_EVERY - 1
  kindle(battle, aliens[0], 2)
  Object.assign(aliens[0], { chill: 1, mark: 1 })
  beats(1)
  expect(aliens[0].burn).toBeGreaterThanOrEqual(4)
  expect(aliens[0].chill).toBeGreaterThanOrEqual(2)
  expect(aliens[0].mark).toBeGreaterThanOrEqual(2)
})

test('Cadenced gear: every CADENCE-th shot does double damage', () => {
  const { hero, beats } = arena(['cadence'], [{ x: 11, y: 10 }])
  hero.stats = { ...hero.stats, damage: 2, crit: 0 }
  hero.hits = CADENCE - 2
  const [first, second] = shots(beats(2)).filter((s) => s.id === hero.id)
  expect(first.damage).toBe(2)
  expect(second.damage).toBe(4)
})

test('Chrono Coil: every 3rd human turn the hardest-hitting hero attacks twice over', () => {
  const { battle, hero } = arena(['chrono'], [{ x: 11, y: 10 }])
  battle.round = 1
  chrono(battle, [])
  expect(hero.twice).toBe(false)
  battle.round = 2
  chrono(battle, [])
  expect(hero.twice).toBe(true)
})

test('Boon Reservoir: a fight won with no boon adds a charge; BOON_CHARGES take a second boon in', () => {
  const run = begun(1)
  gainRelic(run, 'reservoir', true)
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  run.utilities = ['overcharge', 'thrusters']
  expect(apply(run, { type: 'enter', utility: 0, second: 1 }).ok).toBe(false)
  run.boons = BOON_CHARGES
  expect(apply(run, { type: 'enter', utility: 0, second: 1 }).ok).toBe(true)
  expect(run.boons).toBe(0)
  expect(run.battle).toMatchObject({ utility: 'overcharge', second: 'thrusters' })
  Object.assign(run.battle!, { phase: 'over', winner: 'human', utility: null, second: null })
  endBattle(run)
  expect(run.boons).toBe(1)
})

test('Unbroken Line: every STREAK_FIGHTS fights in a row won with no hero down pay more', () => {
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

test('Focus Fire: each hit in a row on one alien does 1 more, to COMBO_MAX; another target starts over', () => {
  const { hero, aliens, beats } = arena(['combo'], [{ x: 11, y: 10 }, { x: 14, y: 14 }])
  hero.stats = { ...hero.stats, damage: 1, crit: 0 }
  Object.assign(hero, { comboOn: aliens[0].id, combo: 9 })
  expect(shots(beats(1))[0]).toMatchObject({ target: aliens[0].id, damage: 1 + COMBO_MAX })
  Object.assign(hero, { comboOn: aliens[1].id, combo: 3 })
  beats(1)
  expect(hero).toMatchObject({ comboOn: aliens[0].id, combo: 1 })
})

test('Living Projectile: an alien thrown onto another hits it for its own HP', () => {
  const { battle, hero, aliens } = arena(['projectile'], [{ x: 11, y: 10 }, { x: 13, y: 10 }])
  hero.stats = { ...hero.stats, strength: 6 }
  Object.assign(aliens[0], { kind: 'swarmling', hp: 7 })
  aliens[0].stats = { ...aliens[0].stats, move: 4 }
  battle.actor = hero.id
  const events = leverage(battle, hero)
  expect(events.some((e) => e.type === 'throw' && e.thrown === aliens[0].id)).toBe(true)
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: aliens[1].id, effect: 'projectile', amount: -7 }))
})

test('Lofty gear: crit for each level above the target', () => {
  const { battle, hero, aliens } = arena(['lofty'], [{ x: 11, y: 10 }])
  battle.height[10 * GRID + 10] = 3
  expect(highCrit(battle, hero, aliens[0])).toBeCloseTo(3 * HIGH_CRIT)
})

test('Fault Line: every FAULT.every-th hit up close drops the ground around the target and hurts each alien on it', () => {
  const { battle, hero, aliens, beats } = arena(['faultLine'], [{ x: 11, y: 10 }, { x: 12, y: 11 }])
  battle.height.fill(4)
  hero.stats = { ...hero.stats, damage: 1, crit: 0 }
  hero.hits = FAULT.every - 1
  const events = beats(1)
  expect(events).toContainEqual(expect.objectContaining({ type: 'effect', id: aliens[0].id, effect: 'faultLine', amount: 0 }))
  expect(battle.height[10 * GRID + 11]).toBe(4 - FAULT.levels)
  expect(aliens[1].hp).toBe(40 - FAULT.damage)
})

test("Witch's Hex passes a dead alien's stacks on; Frost Fracture shatters a frozen one over those beside it", () => {
  const { battle, aliens } = arena(['hex', 'fracture'], [{ x: 11, y: 10 }, { x: 12, y: 10 }])
  Object.assign(aliens[0], { mark: 2, burn: 5, frozen: true, chill: 3 })
  died(battle, aliens[0], null, [])
  expect(aliens[1].burn).toBe(5)
  expect(aliens[1].hp).toBe(40 - FRACTURE_DAMAGE * 3)
})

test("Executioner's Oath: every 3rd kill of a battle gives every hero 1 Might", () => {
  const { battle, hero, aliens } = arena([], [{ x: 11, y: 10 }])
  battle.rules = ['reckoning']
  for (let i = 0; i < 3; i++) died(battle, aliens[0], hero, [])
  expect(battle.kills).toBe(3)
  expect(hero.might).toBe(1)
})
