import { revealed } from './battle'
import { stepBattle } from './combat'
import type { GameEvent } from './combat-event'
import { beatMs, overlaps, PACE, tick, type Clock } from './pace'
import { endBattle, type Run } from './run'

/** Advances the battle being fought one beat and, when it ends, settles it into the run. Does nothing otherwise. */
export function step(run: Run): GameEvent[] {
  if (run.phase !== 'battle' || run.battle?.phase !== 'battle') return []
  const events = stepBattle(run.battle)
  if (events.some((e) => e.type === 'end')) endBattle(run)
  return events
}

/** Steps one beat and advances `clock` by how long the view takes to play it, with a pause as the turn passes. */
export function timedFlow(run: Run, clock: Clock): { events: GameEvent[]; clock: Clock } {
  const battle = run.battle
  const creep = battle?.concealed ? PACE.creep : 1
  const side = battle?.turn
  const events = step(run)
  const units = battle?.units ?? []
  const pace = new Map(units.map((u) => [u.id, PACE.tile * (u.side === 'human' ? creep : 1)]))
  const shown = new Set(units.filter((u) => revealed(battle!, u)).map((u) => u.id))
  const played = tick(clock, beatMs(events, pace, shown), overlaps(events))
  if (battle?.turn === side) return { events, clock: played }
  const settled = played.done + PACE.turn
  return { events, clock: { next: settled, done: settled } }
}
