import { roots } from './skills'
import { expect, test } from 'vitest'
import { deploy, begun } from './roads'
import { apply } from './apply'
import { HASTE_MOVE, isSoldier, revealed, SOLDIER_ATTACKS, type Battle } from './battle'
import { stepBattle } from './combat'
import type { GameEvent } from './combat-event'
import { detects } from './sight'
import { costOf, DASH_MOVE } from './pathing'

function battle(seed: number): Battle {
  const run = begun(seed)
  run.soldiers[0].skills = [roots(run.soldiers[0].cls!)[0]]
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  deploy(run, 0)
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

test('a turn is one move beat, then an attack per beat in id order, two by each soldier and one by each alien, then the other side', () => {
  let turn = ''
  let stage = 'move'
  let shooter = 0
  let attacks = 0
  let twice = 0
  const end = play(1, (events, before, after) => {
    const first = events.find((e) => ['move', 'shot', 'rocket', 'heal', 'spit', 'panic', 'frozen'].includes(e.type)) as Extract<GameEvent, { id: number }> | undefined
    if (!first) return
    // A turn spent standing still shows no event, so turns are told apart by the round as well as the side. A unit
    // arriving this beat is only in the after.
    const side = `${after.round}:${[...before.units, ...after.units].find((u) => u.id === first.id)!.side}`
    if (side !== turn) {
      turn = side
      stage = 'move'
      shooter = 0
    }
    // After the move beat, a move opens a soldier's attack: its walk to a shot.
    if (first.type === 'move' && stage === 'move') {
      stage = 'shoot'
    } else {
      stage = 'shoot'
      expect(first.id).toBeGreaterThanOrEqual(shooter)
      attacks = first.id === shooter ? attacks + 1 : 1
      shooter = first.id
      const unit = [...before.units, ...after.units].find((u) => u.id === first.id)!
      expect(attacks).toBeLessThanOrEqual(isSoldier(unit) ? SOLDIER_ATTACKS : 1)
      if (attacks === SOLDIER_ATTACKS) twice++
    }
  })
  expect(end.winner).not.toBeNull()
  expect(twice).toBeGreaterThan(0)
})

test('no unit moves farther than its move, and a soldier its dash', () => {
  play(2, (events, before) => {
    for (const e of events) {
      if (e.type !== 'move') continue
      const unit = before.units.find((u) => u.id === e.id)!
      expect(e.path.length).toBeLessThanOrEqual(unit.stats.move + (isSoldier(unit) ? DASH_MOVE : 0))
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

test('a pod is revealed once a soldier notices one of its aliens', () => {
  play(4, (_, __, after) => {
    const soldiers = after.units.filter(isSoldier)
    for (const alien of after.units.filter((u) => u.side === 'alien')) {
      const seen = soldiers.some((s) => detects(after, s, alien))
      if (seen) expect(revealed(after, alien)).toBe(true)
    }
  })
})

test('before contact, soldiers walk their full move from the first turn', () => {
  for (let seed = 1; seed <= 6; seed++) {
    let checked = false
    play(seed, (events, before) => {
      if (checked || before.turn !== 'human' || before.stage !== 'move' || before.pods.some((p) => p.revealed)) return
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

test('a soldier may walk between and after its attacks, its walks in a turn together within its move', () => {
  let strides = 0
  for (let seed = 1; seed <= 6; seed++) {
    const walked = new Map<string, number>()
    play(seed, (events, before) => {
      for (const e of events) {
        const unit = e.type === 'move' && !e.with ? before.units.find((u) => u.id === e.id) : undefined
        if (e.type !== 'move' || !unit || !isSoldier(unit) || unit.ability === 'runAndGun' || before.turn !== 'human') continue
        if (before.stage === 'shoot') strides++
        const key = `${before.round}:${unit.id}`
        walked.set(key, (walked.get(key) ?? 0) + e.path.length)
        expect(walked.get(key)).toBeLessThanOrEqual(unit.stats.move + HASTE_MOVE + DASH_MOVE)
      }
    })
  }
  expect(strides).toBeGreaterThan(0)
})
