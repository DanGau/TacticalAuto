// Advances the run's battle a beat, and settles it into the run when it ends.
import { revealed } from './battle'
import { stepBattle } from './combat'
import type { GameEvent } from './combat-event'
import { beatMs, overlaps, PACE, tick, tilePace, type Clock } from './pace'
import type { Run } from './run-state'
import { endBattle } from './debrief'

/** Advances the battle being fought one beat and, when it ends, settles it into the run. Does nothing otherwise. */
export function step(run: Run): GameEvent[] {
  if (run.phase !== 'battle' || run.battle?.phase !== 'battle') return []
  const events = stepBattle(run.battle)
  if (events.some((e) => e.type === 'end')) endBattle(run)
  return events
}

/** Steps one beat and advances `clock` by how long the view takes to play it; a beat that passes the turn first waits for all before it, then a pause. */
export function timedFlow(run: Run, clock: Clock): { events: GameEvent[]; clock: Clock } {
  const battle = run.battle
  const side = battle?.turn
  const events = step(run)
  const units = battle?.units ?? []
  const pace = new Map(units.map((u) => [u.id, tilePace(u.side === 'human')]))
  const shown = new Set(units.filter((u) => revealed(battle!, u)).map((u) => u.id))
  const passed = battle?.turn !== side ? clock.done + PACE.turn : null
  return { events, clock: tick(passed === null ? clock : { next: passed, done: passed }, beatMs(events, pace, shown), overlaps(events)) }
}
