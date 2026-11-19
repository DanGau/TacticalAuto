import { expect, test } from 'vitest'
import { ALIENS } from '../core/aliens'
import { BASE_STATS, GRID, type Alien, type Battle } from '../core/battle'
import { createBattle } from '../core/setup'
import { CIVILIANS, GOALS, type Goal } from '../core/goals'
import { YAW } from '../view/space'
import { axisYaw, CAPTION_WORDS, GLIDE_MS, HOLD_MS, introShots, ORBIT, POINTS, type Intro } from './briefing'

const trooper = (boss = false): Alien => ({ kind: 'trooper', stats: BASE_STATS, stance: ALIENS.trooper.stance, boss, spawns: false, target: boss, resists: [], ...(boss ? { exam: 'plates' as const } : {}) })
const force = (boss: boolean, n: number) => [trooper(boss), ...Array.from({ length: n - 1 }, () => trooper())]
const battles = (boss: boolean, n = 4): Battle[] =>
  (Object.keys(GOALS) as Goal[]).filter((g) => g !== 'ambush').flatMap((goal) => [1, 2].map((seed) => createBattle(seed, 'town', force(boss, n), [], goal)))
const ms = (intro: Intro) => intro.shots.reduce((sum, s) => sum + s.glide + s.hold, 0)

test('a mission intro tours 3 to 5 points, each orbiting slowly and easing in, and ends on the goal', () => {
  for (const battle of [...battles(false), ...battles(false, 14)]) {
    const intro = introShots(battle, 'Clear the streets', YAW)
    expect(intro.shots.length).toBeGreaterThanOrEqual(POINTS[0])
    expect(intro.shots.length).toBeLessThanOrEqual(POINTS[1])
    for (const shot of intro.shots) {
      expect(shot.to.zoom).toBeGreaterThan(shot.from.zoom)
      expect(Math.sign(shot.to.orbit)).toBe(-Math.sign(shot.from.orbit))
    }
    expect(intro.shots.at(-1)!.caption).toBe(battle.goal === 'rescue' ? `${CIVILIANS} civilians. Save 2.` : 'Clear the streets.')
  }
})

test('a busy battle shows more points than a quiet one', () => {
  const count = (n: number) => battles(false, n).reduce((sum, b) => sum + introShots(b, 'Go', YAW).shots.length, 0)
  expect(count(14)).toBeGreaterThanOrEqual(count(2))
})

test('a boss intro opens close on the boss under its title card', () => {
  for (const battle of battles(true)) {
    const [first] = introShots(battle, 'Fell the Guardian', YAW).shots
    const boss = battle.units.find((u) => u.boss)!
    expect(Math.hypot(first.from.x - boss.x, first.from.y - boss.y)).toBeLessThan(4)
    expect(first.title).toBe('Plated Guardian')
  }
})

test('every shot glides or cuts within limits, holds 1.5 to 2.5 s, stays on the map and on the axis, and captions briefly', () => {
  for (const battle of [...battles(false), ...battles(true)]) {
    for (const seen of [0, 1]) {
      for (const shot of introShots(battle, 'Hold the uplink', YAW, seen).shots) {
        if (shot.glide > 0) expect(shot.glide).toBeGreaterThanOrEqual(GLIDE_MS[0])
        expect(shot.glide).toBeLessThanOrEqual(GLIDE_MS[1])
        expect(shot.hold).toBeGreaterThanOrEqual(HOLD_MS[0])
        expect(shot.hold).toBeLessThanOrEqual(HOLD_MS[1])
        for (const f of [shot.from, shot.to]) {
          expect(f.x - f.extent).toBeGreaterThanOrEqual(0)
          expect(f.y - f.extent).toBeGreaterThanOrEqual(0)
          expect(f.x + f.extent).toBeLessThanOrEqual(GRID - 1)
          expect(f.y + f.extent).toBeLessThanOrEqual(GRID - 1)
          expect(Math.abs(f.orbit)).toBeLessThanOrEqual(ORBIT)
        }
        if (shot.caption) expect(shot.caption.split(' ').length).toBeLessThanOrEqual(CAPTION_WORDS)
      }
    }
  }
})

test('repeats shorten: two points, then one glide', () => {
  for (const battle of [...battles(false), ...battles(true)]) {
    const [full, second, later] = [0, 1, 2].map((seen) => introShots(battle, 'Go', YAW, seen))
    expect(second.shots.length).toBe(2)
    expect(ms(second)).toBeLessThan(ms(full))
    expect(later.shots.length).toBe(1)
    expect(ms(later)).toBeLessThanOrEqual(1500)
  }
})

test('the turn puts the hero screen-left of the aliens', () => {
  for (const yaw of [YAW, YAW + Math.PI / 2]) {
    const left = { x: 10, y: 10 }
    const right = { x: 60, y: 30 }
    const turned = axisYaw(yaw, left, right)
    expect((right.x - left.x) * Math.cos(turned) - (right.y - left.y) * Math.sin(turned)).toBeGreaterThan(0)
  }
})
