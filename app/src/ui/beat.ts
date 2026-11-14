// One beat of the battle loop: the battle steps, then the view plays it, the panel catching up only as the view does.
import type { Side } from '../core/battle'
import type { GameEvent } from '../core/combat-event'
import { PACE } from '../core/pace'

export interface Player {
  step(): GameEvent[]
  /** Whose turn it is, if a battle is on. */
  turn(): Side | undefined
  /** Resolves once every attack begun has finished. */
  settle(): Promise<void>
  /** Redraws the panel for the run as it stands. */
  update(): void
  pause(ms: number): Promise<void>
  /** Plays `events`, then redraws the panel. */
  show(events: GameEvent[]): Promise<void>
}

export async function beat(p: Player): Promise<GameEvent[]> {
  const side = p.turn()
  const events = p.step()
  // A beat that passes the turn opens the new side's turn: the old side's attacks finish, then a breath. One that ends the battle leaves the panel to show the end once it has played.
  if (p.turn() !== side) {
    await p.settle()
    if (!events.some((e) => e.type === 'end')) p.update()
    await p.pause(PACE.turn)
  }
  await p.show(events)
  return events
}
