import { expect, test } from 'vitest'
import { begun, enterAt } from './roads'
import { apply } from './apply'
import { isSoldier, SOLDIER_ATTACKS, type Battle, type Unit } from './battle'
import { shoot } from './attack'
import { CLASSES } from './classes'
import { stepBattle } from './combat'
import type { GameEvent } from './combat-event'
import { spotted } from './fighters'
import { SECONDARIES } from './secondaries'
import { PACE, staggerOf, tick } from './pace'

function battle(seed: number): Battle {
  const run = begun(seed)
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  enterAt(run, 0)
  return run.battle!
}

/** A hero and an alien `apart` tiles away on one row, the only units; the alien tough enough to live. */
function duel(apart: number, effects: Unit['effects'] = []): { b: Battle; hero: Unit; alien: Unit } {
  const b = battle(1)
  const hero = b.units.find(isSoldier)!
  const alien = b.units.find((u) => u.side === 'alien')!
  b.units = [hero, alien]
  b.props.fill('none')
  b.bulk.fill(0 as never)
  b.height.fill(0)
  b.north.fill('none' as never)
  b.west.fill('none' as never)
  Object.assign(hero, { x: 5, y: 5, effects, stats: { ...hero.stats, crit: 0 }, secondary: 'frag' })
  Object.assign(alien, { x: 5 + apart, y: 5, hp: 50, armor: 0, kind: 'trooper', stats: { ...alien.stats, hp: 50 } })
  alien.revealed = true
  alien.engaged = true
  return { b, hero, alien }
}

const shots = (events: GameEvent[]) => events.filter((e) => e.type === 'shot') as Extract<GameEvent, { type: 'shot' }>[]

test('every class has its own secondary', () => {
  const ids = Object.values(CLASSES).map((c) => c.secondary)
  expect(new Set(ids).size).toBe(ids.length)
})

test("a hero's turn is its weapon's attack, then its secondary, the combo marked for the view", () => {
  let checked = 0
  for (let seed = 0; seed < 5 && checked === 0; seed++) {
    const b = battle(seed)
    let last: Extract<GameEvent, { type: 'shot' }> | null = null
    while (b.phase === 'battle') {
      for (const shot of shots(stepBattle(b))) {
        const unit = b.units.find((u) => u.id === shot.id)
        if (!unit || !isSoldier(unit)) continue
        if (shot.secondary) {
          expect(shot.secondary).toBe(unit.secondary)
          expect(last?.id).toBe(shot.id)
          checked++
        }
        last = shot
      }
    }
  }
  expect(checked).toBeGreaterThan(0)
})

test('a secondary does its own damage, and reaches only as far as it does', () => {
  const near = duel(2)
  const weapon = shots(shoot(near.b, near.hero, spotted(near.b)))[0]
  const frag = shots(shoot(near.b, near.hero, spotted(near.b), undefined, undefined, SECONDARIES.frag))[0]
  expect(frag.damage).toBe(weapon.damage + SECONDARIES.frag.damage)
  expect(frag.secondary).toBe('frag')
  const far = duel(SECONDARIES.flameBurst.range + 1)
  far.hero.stats.range = 20
  expect(shoot(far.b, far.hero, spotted(far.b), undefined, undefined, SECONDARIES.flameBurst)).toEqual([])
  expect(shots(shoot(far.b, far.hero, spotted(far.b)))).toHaveLength(1)
})

test('a hero its weapon cannot reach with attacks with its secondary alone', () => {
  const { b, hero, alien } = duel(3)
  Object.assign(hero, { ability: null, stats: { ...hero.stats, range: 1, move: 0 }, secondary: 'frag' })
  Object.assign(alien, { stats: { ...alien.stats, move: 0, range: 0 } })
  b.turn = 'human'
  b.stage = 'shoot'
  b.shooter = 0
  const fired = shots(stepBattle(b))
  expect(fired.map((s) => s.secondary)).toEqual(['frag'])
  expect(b.attacks).toBe(SOLDIER_ATTACKS)
})

test('each effect lands on a hit', () => {
  const hit = (id: keyof typeof SECONDARIES) => {
    const d = duel(2)
    shoot(d.b, d.hero, spotted(d.b), undefined, undefined, SECONDARIES[id])
    return d
  }
  expect(hit('flare').alien.marked).toBe(true)
  expect(hit('shockCoil').alien.suppressed).toBeGreaterThan(0)
  expect(hit('iceShard').alien.rooted).toBeGreaterThan(0)
  expect(hit('shieldThrow').alien.x).toBe(8)
})

test('what grants an extra attack grants the weapon, not the secondary', () => {
  const d = duel(2, ['surge'])
  const fired = shots(shoot(d.b, d.hero, spotted(d.b), undefined, undefined, SECONDARIES.frag))
  expect(fired).toHaveLength(2)
  expect(fired[0].secondary).toBe('frag')
  expect(fired[1].secondary).toBeUndefined()
  expect(fired[1].with).toContain('surge')
})

test("a combo's blows are closer together than two heroes' attacks", () => {
  const opens: GameEvent = { type: 'shot', id: 1, target: 2, crit: false, damage: 3, with: [], opens: true }
  const lone: GameEvent = { type: 'shot', id: 1, target: 2, crit: false, damage: 3, with: [] }
  expect(staggerOf([opens])).toBeLessThan(staggerOf([lone]))
  expect(tick({ next: 0, done: 0 }, PACE.attack, true, staggerOf([opens])).next).toBe(PACE.combo)
})
