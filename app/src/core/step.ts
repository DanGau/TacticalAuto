import { stepBattle, type GameEvent } from './combat'
import { endBattle, type Run } from './run'

/** Advances the battle being fought one beat and, when it ends, settles it into the run. Does nothing otherwise. */
export function step(run: Run): GameEvent[] {
  if (run.phase !== 'battle' || run.battle?.phase !== 'battle') return []
  const events = stepBattle(run.battle)
  if (events.some((e) => e.type === 'end')) endBattle(run)
  return events
}
