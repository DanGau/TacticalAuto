import { PATHS } from './skills'
import { expect, test } from 'vitest'
import { deploy } from './roads'
import { apply } from './apply'
import { isSoldier, revealed, type Battle } from './battle'
import { stepBattle, type GameEvent } from './combat'
import { createRun } from './run'
import { detects } from './sight'

function battle(seed: number): Battle {
  const run = createRun(seed)
  run.soldiers[0].skills = [PATHS[run.soldiers[0].cls!][0].core]
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

test('a turn is one move beat, then one shot per beat in id order, then the other side', () => {
  let turn = ''
  let stage = 'move'
  let shooter = 0
  const end = play(1, (events, before, after) => {
    const first = events.find((e) => ['move', 'shot', 'rocket', 'heal', 'spit', 'panic', 'frozen'].includes(e.type)) as Extract<GameEvent, { id: number }> | undefined
    if (!first) return
    // A turn spent standing still shows no event, so turns are told apart by the round as well as the side.
    const side = `${after.round}:${before.units.find((u) => u.id === first.id)!.side}`
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

test('a pod is revealed once a soldier notices one of its aliens', () => {
  play(4, (_, __, after) => {
    const soldiers = after.units.filter(isSoldier)
    for (const alien of after.units.filter((u) => u.side === 'alien')) {
      const seen = soldiers.some((s) => detects(after, s, alien))
      if (seen) expect(revealed(after, alien)).toBe(true)
    }
  })
})

test('a squad that sees a pod first holds its fire and sets up, then springs the ambush all at once; unseen, it creeps', () => {
  let sprung = 0
  for (let seed = 1; seed <= 30; seed++) {
    play(seed, (events, before, after) => {
      // Unseen soldiers walk at most CREEP of their move in their move stage.
      for (const e of events) {
        if (e.type !== 'move' || !before.concealed || before.stage !== 'move' || e.with) continue
        const unit = before.units.find((u) => u.id === e.id)!
        if (isSoldier(unit)) expect(e.path.length).toBeLessThanOrEqual(Math.ceil(unit.stats.move * 0.6) + 1)
      }
      // No soldier fires on a pod the squad has seen that has not noticed it.
      for (const e of events.filter((e) => e.type === 'shot')) {
        const target = before.units.find((u) => u.id === e.target)
        const pod = target && target.pod !== null ? before.pods[target.pod] : null
        if (isSoldier(before.units.find((u) => u.id === e.id)!) && pod?.revealed) expect(pod.alert || after.pods[target!.pod!].ambushed).toBe(true)
      }
      sprung += events.filter((e) => e.type === 'reveal' && e.ambush && before.pods.some((p, i) => p.revealed && !p.alert && e.units.some((u) => before.units.find((b) => b.id === u.id)?.pod === i))).length
    })
  }
  expect(sprung).toBeGreaterThan(0)
})
