// Plays one run with a bot, and replays a recorded one.
import type { Bot } from '../bots/bots'
import { apply, type Action } from '../core/apply'
import { createRun } from '../core/run'
import { type Run } from '../core/run-state'
import { type Mission } from '../core/run-state'
import { health } from '../core/squad'
import { timedFlow } from '../core/step'
import type { DoctrineId } from '../core/doctrines'

/** A battle's toll: the leg it was on, the squad's most health, its health at the start and end, and soldiers downed. */
export interface Toll {
  leg: number
  most: number
  before: number
  after: number
  downed: number
}

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
  /** How long each battle takes to play in the view, in ms. */
  durations: number[]
  /** Each battle's toll on the squad's health. */
  tolls: Toll[]
  /** With the seed, enough to replay the run. */
  actions: Action[]
}

/** More player actions than any run takes: a run past it is stuck, and fails instead of hanging. */
const MAX_ACTIONS = 10000

/**
 * Plays a run to its end, taking each action from `next` when the run waits for the player, and in a battle once each
 * squad turn while the kit holds a consumable.
 */
function play(seed: number, next: (run: Run) => Action, doctrines: DoctrineId[] = []): { run: Run; result: RunResult } {
  const run = createRun(seed)
  run.doctrines.push(...doctrines)
  const result: RunResult = { seed, won: false, keys: 0, endedOn: 'battle', battles: 0, draws: 0, durations: [], tolls: [], actions: [] }
  let clock = { next: 0, done: 0 }
  /** The battle and alien turn count at which the bot last chose whether to use a consumable. */
  let asked: [Run['battle'], number] = [null, -1]
  /** The battle under way, its leg, and the squad's health as it began. */
  let begun: [Run['battle'], number, number] = [null, 0, 0]
  while (run.phase !== 'won' && run.phase !== 'lost') {
    const battle = run.battle
    if (run.phase === 'battle' && begun[0] !== battle) begun = [battle, run.keys, run.soldiers.reduce((sum, s) => sum + health(run, s), 0)]
    const choosing = run.phase === 'battle' && battle!.phase === 'battle' && battle!.turn === 'human' && run.kit.length > 0 && (asked[0] !== battle || asked[1] !== battle!.round)
    if (choosing) asked = [battle, battle!.round]
    if (run.phase === 'battle' && battle!.phase === 'battle' && !choosing) {
      const played = timedFlow(run, clock)
      clock = played.clock
      for (const event of played.events) {
        if (event.type !== 'end') continue
        result.battles++
        if (event.winner === null) result.draws++
        result.durations.push(clock.done)
        const fought = run.report!.soldiers
        result.tolls.push({ leg: begun[1], most: fought.reduce((sum, s) => sum + s.maxHp, 0), before: begun[2], after: fought.reduce((sum, s) => sum + s.hp, 0), downed: battle!.downed.length })
        clock = { next: 0, done: 0 }
      }
      continue
    }
    if (result.actions.length >= MAX_ACTIONS) throw new Error(`seed ${seed}: no end after ${MAX_ACTIONS} actions, in phase ${run.phase}`)
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

/** Plays a run with `bot`, the squad holding `doctrines` from the start. */
export function runWith(seed: number, bot: Bot, doctrines: DoctrineId[] = []): RunResult {
  const rng = { rng: seed }
  return play(seed, (run) => bot(run, rng), doctrines).result
}
