import { expect, test } from 'vitest'
import { ALIENS } from '../core/aliens'
import { BASE_STATS, GRID, type Alien, type Battle } from '../core/battle'
import { createBattle } from '../core/setup'
import { GOALS, type Goal } from '../core/goals'
import { YAW } from '../view/space'
import { axisYaw, CAPTION_WORDS, GLIDE_MS, HOLD_MS, introShots, ORBIT, ZOOM, type Intro } from './briefing'

const trooper = (boss = false): Alien => ({ kind: 'trooper', stats: BASE_STATS, stance: ALIENS.trooper.stance, boss, spawns: false, target: boss, resists: [], ...(boss ? { exam: 'plates' as const } : {}) })
const battles = (boss: boolean): Battle[] =>
  (Object.keys(GOALS) as Goal[]).filter((g) => g !== 'ambush').flatMap((goal) => [1, 2].map((seed) => createBattle(seed, 'town', [trooper(boss), trooper(), trooper(), trooper()], [], goal)))
const ms = (intro: Intro) => intro.shots.reduce((sum, s) => sum + s.glide + s.hold, 0)

test('a mission intro: wide, the threat, the ground, the goal, then the hero alone, in about 7.5 s', () => {
  for (const battle of battles(false)) {
    const intro = introShots(battle, 'Clear the streets', 'Vex', YAW)
    expect(intro.shots.length).toBeGreaterThanOrEqual(4)
    expect(intro.shots.length).toBeLessThanOrEqual(5)
    expect(intro.shots[0].from.zoom).toBe(ZOOM.wide)
    expect(intro.shots[0].glide).toBe(0)
    expect(intro.shots.at(-2)!.caption).toBe('Clear the streets.')
    expect(intro.shots.at(-1)).toMatchObject({ hero: true, caption: 'Vex fights alone. You build.' })
    expect(ms(intro)).toBeGreaterThan(6000)
    expect(ms(intro)).toBeLessThan(9000)
  }
})

test('a boss intro opens close on the boss, pulls out under its title card, and ends on the hero', () => {
  for (const battle of battles(true)) {
    const intro = introShots(battle, 'Fell the Guardian', '', YAW)
    const [close, pull] = intro.shots
    const boss = battle.units.find((u) => u.boss)!
    expect(close.from.zoom).toBe(ZOOM.close)
    expect(Math.hypot(close.from.x - boss.x, close.from.y - boss.y)).toBeLessThan(4)
    expect(pull.to.zoom).toBeLessThan(pull.from.zoom)
    expect(pull.title).toBe('Plated Guardian')
    expect(intro.shots.at(-1)).toMatchObject({ hero: true, caption: 'Your hero fights alone. You build.' })
    expect(ms(intro)).toBeLessThan(13000)
  }
})

test('every shot glides or cuts within limits, holds long enough, stays on the map and on the axis, and captions briefly', () => {
  for (const battle of [...battles(false), ...battles(true)]) {
    for (const seen of [0, 1, 2]) {
      const intro = introShots(battle, 'Hold the uplink', 'Vex', YAW, seen)
      for (const shot of intro.shots) {
        if (shot.glide > 0) expect(shot.glide).toBeGreaterThanOrEqual(GLIDE_MS[0])
        expect(shot.glide).toBeLessThanOrEqual(GLIDE_MS[1])
        expect(shot.hold).toBeGreaterThanOrEqual(HOLD_MS)
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

test('repeats shorten: three shots, then one glide', () => {
  for (const battle of [...battles(false), ...battles(true)]) {
    const [full, second, later] = [0, 1, 2].map((seen) => introShots(battle, 'Go', 'Vex', YAW, seen))
    expect(second.shots.length).toBe(3)
    expect(ms(second)).toBeLessThan(ms(full))
    expect(later.shots.length).toBe(1)
    expect(later.shots[0].glide).toBeGreaterThan(0)
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
