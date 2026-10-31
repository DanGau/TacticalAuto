import { expect, test } from 'vitest'
import { apply } from './apply'
import { CLOAK_DAMAGE, SHADOW_DAMAGE, type Battle } from './battle'
import { stepBattle } from './combat'
import type { GameEvent } from './combat-event'
import { deploy, begun } from './roads'

/** Plays a battle with every soldier a phantom, calling `check` with each beat's events and the battle before it. */
function play(seed: number, check: (events: GameEvent[], before: Battle) => void): Battle {
  const run = begun(seed)
  for (const s of run.soldiers) Object.assign(s, { cls: 'phantom', skills: ['shadowStrike'] })
  apply(run, { type: 'go', index: 1 })
  apply(run, { type: 'advance' })
  deploy(run, 0)
  const state = run.battle!
  // Wounded, a phantom cloaks once any alien can shoot it.
  for (const u of state.units) if (u.ability === 'cloak') u.hp = Math.floor(u.stats.hp / 2)
  while (state.phase === 'battle') {
    const before = structuredClone(state)
    check(stepBattle(state), before)
  }
  return state
}

test('phantoms cloak, no alien targets a cloaked one, and an attack out of cloak hits harder and breaks it', () => {
  let cloaks = 0
  let strikes = 0
  // Seeds whose first battle is no raid, which waits on the player's choice.
  for (const seed of [1, 2, 4, 5, 6, 7, 10, 14]) {
    const end = play(seed, (events, before) => {
      const cloaked = (id: number) => !!before.units.find((u) => u.id === id)?.cloaked
      for (const e of events) {
        if (e.type === 'cloak' && e.on) cloaks++
        if ((e.type === 'shot' || e.type === 'spit' || e.type === 'panic') && before.units.find((u) => u.id === e.id)?.side === 'alien') expect(cloaked(e.target)).toBe(false)
        if (e.type !== 'shot' || !cloaked(e.id)) continue
        const shooter = before.units.find((u) => u.id === e.id)!
        // Only a shield or a last stand takes from a hit's damage.
        const blunted = events.some((b) => b.type === 'effect' && b.id === e.target && (b.effect === 'shield' || b.effect === 'lastStand'))
        if (e.hit && !blunted) expect(e.damage).toBeGreaterThanOrEqual(shooter.stats.damage + CLOAK_DAMAGE + SHADOW_DAMAGE)
        expect(events).toContainEqual({ type: 'cloak', id: e.id, on: false })
        strikes++
      }
    })
    expect(end.winner).not.toBeNull()
  }
  expect(cloaks).toBeGreaterThan(0)
  expect(strikes).toBeGreaterThan(0)
})
