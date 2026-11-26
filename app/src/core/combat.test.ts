import { powerOf } from './skills'
import { current } from './run'
import { expect, test } from 'vitest'
import { enterAt, begun } from './roads'
import { apply } from './apply'
import { GRID, isSoldier, type Battle } from './battle'
import { beat } from './roads'
import type { GameEvent } from './combat-event'
import { detects } from './sight'
import { costOf, goalOf } from './pathing'
import { CARD_IDS, amount } from './cards'

/** The farthest any card moves the hero. */
const CARD_MOVE = Math.max(...CARD_IDS.map((id) => amount(id, 2, 'move') + amount(id, 2, 'retreat')))
import { blocked, distance, walkingDistances } from './grid'


function battle(seed: number): Battle {
  const run = begun(seed)
  run.hero.skills = [powerOf(run.hero.cls!)]
  apply(run, { type: 'go', index: 1 })
  current(run)!.stop!.goal = 'cross'
  apply(run, { type: 'advance' })
  enterAt(run)
  // The hero fights the aliens here, not makes for the extraction zone.
  run.battle!.extract = null
  return run.battle!
}

/** Plays a battle to its end, calling `check` with each beat's events and the units as they stood before it. */
function play(seed: number, check: (events: GameEvent[], before: Battle, after: Battle) => void): Battle {
  const state = battle(seed)
  while (state.phase === 'battle') {
    const before = structuredClone(state)
    check(beat(state), before, state)
  }
  return state
}

test('a round: the aliens move, then the hero, the battle waits for the player, then each alien acts at most once', () => {
  for (const seed of [1, 2, 3]) {
    const acted = new Set<number>()
    const end = play(seed, (events, before, after) => {
      if (before.stage === 'enemy') {
        const first = events.find((e) => ['shot', 'spit', 'panic', 'frozen'].includes(e.type)) as Extract<GameEvent, { id: number }> | undefined
        if (first && before.units.some((u) => u.id === first.id && u.side === 'alien')) {
          expect(acted.has(first.id)).toBe(false)
          acted.add(first.id)
        }
      }
      if (after.stage === 'move' && before.stage === 'enemy') acted.clear()
      if (before.stage === 'move' && before.turn === 'human' && after.phase === 'battle') expect(after.stage).toBe('play')
      for (const e of events) if (e.type === 'shot' && before.stage !== 'play') expect(before.units.find((u) => u.id === e.id)?.side).not.toBe('human')
    })
    expect(end.winner).not.toBeNull()
  }
})

test('no unit moves farther than its move, and the hero no farther than a card moves it', () => {
  play(2, (events, before) => {
    for (const e of events) {
      if (e.type !== 'move') continue
      const unit = before.units.find((u) => u.id === e.id)!
      expect(e.path.length).toBeLessThanOrEqual(unit.side === 'human' ? Math.max(unit.stats.move, CARD_MOVE) : unit.stats.move)
    }
  })
})

test('an alien shoots only once revealed', () => {
  play(3, (events, before) => {
    for (const e of events) {
      const shooter = e.type === 'shot' ? before.units.find((u) => u.id === e.id)! : null
      if (shooter?.side === 'alien') expect(shooter.revealed).toBe(true)
    }
  })
})

test('an alien is revealed once a soldier notices it', () => {
  play(4, (_, __, after) => {
    const soldiers = after.units.filter(isSoldier)
    for (const alien of after.units.filter((u) => u.side === 'alien')) {
      const seen = soldiers.some((s) => detects(after, s, alien))
      if (seen) expect(alien.revealed).toBe(true)
    }
  })
})

test('before contact, soldiers walk their full move from the first turn', () => {
  for (let seed = 1; seed <= 6; seed++) {
    let checked = false
    play(seed, (events, before) => {
      if (checked || before.turn !== 'human' || before.stage !== 'move' || before.units.some((u) => u.side === 'alien' && u.revealed)) return
      const walks = events.flatMap((e) => (e.type === 'move' && !e.with ? [e] : []))
      if (walks.length === 0) return
      checked = true
      for (const e of walks) {
        const unit = before.units.find((u) => u.id === e.id)!
        if (isSoldier(unit)) expect(costOf(before, unit, e.path)).toBeGreaterThanOrEqual(unit.stats.move - 1)
      }
    })
  }
}, 30_000)

test('with no alien engaged the hero heads for the nearest by the walk, so it never paces between two that take turns being nearest as the crow flies', () => {
  let tried = 0
  for (let seed = 1; seed <= 12; seed++) {
    const state = battle(seed)
    const hero = state.units.find(isSoldier)!
    const [a, b] = state.units.filter((u) => u.side === 'alien')
    if (!b) continue
    state.units = [hero, a, b]
    const open: { x: number; y: number }[] = []
    for (let y = 0; y < GRID; y += 3) for (let x = 0; x < GRID; x += 3) if (!blocked(state, x, y)) open.push({ x, y })
    const here = hero.y * GRID + hero.x
    for (const near of open) {
      for (const far of open) {
        const [walkNear, walkFar] = [walkingDistances(state, near, hero.stats.jump)[here], walkingDistances(state, far, hero.stats.jump)[here]]
        if (walkNear === Infinity || walkNear >= walkFar || distance(hero, near) <= distance(hero, far)) continue
        Object.assign(a, near, { engaged: false, target: false })
        Object.assign(b, far, { engaged: false, target: false })
        tried++
        expect(goalOf(state, hero, [a, b])).toBe(a)
      }
    }
  }
  expect(tried).toBeGreaterThan(0)
})
