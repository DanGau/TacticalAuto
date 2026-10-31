import { revealed } from './battle'
import { stepBattle, type GameEvent } from './combat'
import { beatMs, instant, overlaps, PACE, tick, type Clock } from './pace'
import { endBattle, type Run } from './run'

/** Advances the battle being fought one beat and, when it ends, settles it into the run. Does nothing otherwise. */
export function step(run: Run): GameEvent[] {
  if (run.phase !== 'battle' || run.battle?.phase !== 'battle') return []
  const events = stepBattle(run.battle)
  if (events.some((e) => e.type === 'end')) endBattle(run)
  return events
}

/** Steps what the view plays as one beat: one beat, or after a beat of only moves and instant events, the other side's beat too, so both sides walk as one. */
export function flow(run: Run): GameEvent[] {
  const battle = run.battle
  if (!battle) return []
  const side = battle.turn
  const events = step(run)
  while (events.every((e) => e.type === 'move' || instant(e)) && battle.phase === 'battle' && battle.turn !== side) events.push(...step(run))
  return events
}

/** Flows one played beat and advances `clock` by how long the view takes to play it. */
export function timedFlow(run: Run, clock: Clock): { events: GameEvent[]; clock: Clock } {
  const battle = run.battle
  const creep = battle?.concealed ? PACE.creep : 1
  const events = flow(run)
  const units = battle?.units ?? []
  const pace = new Map(units.map((u) => [u.id, PACE.tile * (u.side === 'human' ? creep : 1)]))
  const shown = new Set(units.filter((u) => revealed(battle!, u)).map((u) => u.id))
  return { events, clock: tick(clock, beatMs(events, pace, shown), overlaps(events)) }
}
