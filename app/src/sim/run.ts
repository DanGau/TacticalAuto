import type { Bot } from '../bots/bots'
import { apply, type Action } from '../core/apply'
import { createRun, type Mission, type Run } from '../core/run'
import { step } from '../core/step'

export interface RunResult {
  seed: number
  won: boolean
  /** Access keys won. */
  keys: number
  /** The kind of mission the run ended on. */
  endedOn: Mission['kind']
  battles: number
  /** Battles that hit the beat limit undecided. */
  draws: number
  /** With the seed, enough to replay the run. */
  actions: Action[]
}

/** Plays a run to its end, taking each action from `next` when the run waits for the player. */
function play(seed: number, next: (run: Run) => Action): { run: Run; result: RunResult } {
  const run = createRun(seed)
  const result: RunResult = { seed, won: false, keys: 0, endedOn: 'battle', battles: 0, draws: 0, actions: [] }
  while (run.phase !== 'won' && run.phase !== 'lost') {
    if (run.phase === 'battle' && run.battle!.phase === 'battle') {
      for (const event of step(run)) {
        if (event.type !== 'end') continue
        result.battles++
        if (event.winner === null) result.draws++
      }
      continue
    }
    const action = next(run)
    const applied = apply(run, action)
    if (!applied.ok) throw new Error(`action rejected: ${applied.reason}`)
    result.actions.push(action)
  }
  return { run, result: { ...result, won: run.phase === 'won', keys: run.keys, endedOn: run.mission!.kind } }
}

/** The final state of the run these inputs produce. */
export function replay(seed: number, actions: Action[]): Run {
  const queue = [...actions]
  return play(seed, () => queue.shift()!).run
}

export function runWith(seed: number, bot: Bot): RunResult {
  const rng = { rng: seed }
  return play(seed, (run) => bot(run, rng)).result
}
