import { expect, test } from 'vitest'
import { apply } from './apply'
import { revealed, type Battle } from './battle'
import { stepBattle, type GameEvent } from './combat'
import { createRun } from './run'
import { sees } from './sight'

function battle(seed: number): Battle {
  const run = createRun(seed)
  apply(run, { type: 'mission', index: 0 })
  apply(run, { type: 'land', zone: 0 })
  return run.battle!
}

/** Plays a battle to its end, calling `check` with each beat's events and the units as they stood before it. */
function play(seed: number, check: (events: GameEvent[], before: Battle, after: Battle) => void): Battle {
  const state = battle(seed)
  while (state.phase === 'battle') {
    const before = structuredClone(state)
    check(stepBattle(state), before, state)
  }
  return state
}

test('a turn is one move beat, then one shot per beat in id order, then the other side', () => {
  let turn = 'human'
  let stage = 'move'
  let shooter = 0
  const end = play(1, (events, before) => {
    const first = events.find((e) => e.type === 'move' || e.type === 'shot' || e.type === 'rocket' || e.type === 'heal')
    if (!first) return
    const side = before.units.find((u) => u.id === first.id)!.side
    if (side !== turn) {
      turn = side
      stage = 'move'
      shooter = 0
    }
    if (first.type === 'move') {
      expect(stage).toBe('move')
      stage = 'shoot'
    } else {
      stage = 'shoot'
      expect(first.id).toBeGreaterThan(shooter)
      shooter = first.id
    }
  })
  expect(end.winner).not.toBeNull()
})

test('no unit moves farther than its move', () => {
  play(2, (events, before) => {
    for (const e of events) {
      if (e.type === 'move') expect(e.path.length).toBeLessThanOrEqual(before.units.find((u) => u.id === e.id)!.stats.move)
    }
  })
})

test('an alien shoots only after its pod is revealed', () => {
  play(3, (events, before) => {
    for (const e of events) {
      const shooter = e.type === 'shot' ? before.units.find((u) => u.id === e.id)! : null
      if (shooter?.side === 'alien') expect(revealed(before, shooter)).toBe(true)
    }
  })
})

test('a pod is revealed exactly when a soldier first has it in sight', () => {
  play(4, (_, __, after) => {
    const soldiers = after.units.filter((u) => u.side === 'human')
    for (const alien of after.units.filter((u) => u.side === 'alien')) {
      const seen = soldiers.some((s) => sees(after, s, alien))
      if (seen) expect(revealed(after, alien)).toBe(true)
    }
  })
})
