// Plays one run with a bot, and replays a recorded one.
import type { Bot } from '../bots/bots'
import { apply, type Action } from '../core/apply'
import { createRun } from '../core/run'
import { type Run } from '../core/run-state'
import { type Mission } from '../core/run-state'
import { health } from '../core/squad'
import { distance } from '../core/grid'
import { timedFlow } from '../core/step'
import type { DoctrineId } from '../core/doctrines'
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import type { Goal } from '../core/goals'
import type { ArenaKind } from '../core/arena-kinds'
import type { UtilityId } from '../core/utilities'
import { forksOf, type Fork } from './forks'

/** Whether a party met a challenge with an answer it picked, with one it held and left behind, or with none. */
export type Answer = 'picked' | 'held' | 'none'

/** A battle's toll: which of the run it was, the leg it was on, the squad's most health, its health at the start and end, soldiers downed, whether it was won, and what it tested. */
export interface Toll {
  /** Which battle of the run it was, from 1. */
  nth: number
  leg: number
  party: number
  won: boolean
  goal: Goal
  challenge: ChallengeId | null
  answer: Answer
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
  /** Units fallen off a ledge or over the edge, those the fall killed, and objects or aliens thrown, over all its battles; and the farthest throw in tiles. */
  moments: { falls: number; fallKills: number; throws: number; farthest: number }
  /** By arena kind: battles fought there, and the jumps units made in them. */
  jumps: Partial<Record<ArenaKind, { battles: number; jumps: number }>>
  /** Each battle's toll on the squad's health. */
  tolls: Toll[]
  /** With `forks` asked for: each deploy screen played on with every utility. */
  forks: Fork[]
  /** With the seed, enough to replay the run. */
  actions: Action[]
}

/** How the party met the battle's challenge, given the utilities it held going in. */
function answerOf(battle: NonNullable<Run['battle']>, held: UtilityId[]): Answer {
  const answers: UtilityId[] = battle.challenge ? CHALLENGES[battle.challenge].answers : []
  if (battle.utility && answers.includes(battle.utility)) return 'picked'
  return answers.some((id) => held.includes(id)) ? 'held' : 'none'
}

/** More player actions than any run takes: a run past it is stuck, and fails instead of hanging. */
const MAX_ACTIONS = 10000

/**
 * Plays a run to its end, taking each action from `next` when the run waits for the player.
 */
function play(seed: number, next: (run: Run) => Action, doctrines: DoctrineId[] = [], forks = false): { run: Run; result: RunResult } {
  const run = createRun(seed)
  run.doctrines.push(...doctrines)
  const result: RunResult = { seed, won: false, keys: 0, endedOn: 'battle', battles: 0, draws: 0, durations: [], moments: { falls: 0, fallKills: 0, throws: 0, farthest: 0 }, jumps: {}, tolls: [], forks: [], actions: [] }
  let clock = { next: 0, done: 0 }
  let leaps = 0
  /** The battle under way, its leg, the squad's health as it began, and the utilities it held. */
  let begun: [Run['battle'], number, number, UtilityId[]] = [null, 0, 0, []]
  while (run.phase !== 'won' && run.phase !== 'lost') {
    const battle = run.battle
    if (run.phase === 'battle' && begun[0] !== battle) begun = [battle, run.keys, run.soldiers.reduce((sum, s) => sum + health(run, s), 0), [...run.utilities]]
    if (run.phase === 'battle' && battle!.phase === 'battle') {
      const played = timedFlow(run, clock)
      clock = played.clock
      for (const event of played.events) {
        if (event.type === 'fall') result.moments.falls++
        if (event.type === 'fall' && !!event.fatal) result.moments.fallKills++
        if (event.type === 'throw') result.moments.throws++
        if (event.type === 'throw') result.moments.farthest = Math.max(result.moments.farthest, distance(event.from, event.to))
        if (event.type === 'move') leaps += event.leaps ?? 0
        if (event.type !== 'end') continue
        result.battles++
        const arena = (result.jumps[battle!.arenaKind] ??= { battles: 0, jumps: 0 })
        arena.battles++
        arena.jumps += leaps
        leaps = 0
        if (event.winner === null) result.draws++
        result.durations.push(clock.done)
        const fought = run.report!.soldiers
        result.tolls.push({ nth: result.battles, leg: begun[1], party: fought.length, won: event.winner === 'human', goal: battle!.goal, challenge: battle!.challenge, answer: answerOf(battle!, begun[3]), most: fought.reduce((sum, s) => sum + s.maxHp, 0), before: begun[2], after: fought.reduce((sum, s) => sum + s.hp, 0), downed: battle!.downed.length })
        clock = { next: 0, done: 0 }
      }
      continue
    }
    if (result.actions.length >= MAX_ACTIONS) throw new Error(`seed ${seed}: no end after ${MAX_ACTIONS} actions, in phase ${run.phase}`)
    if (forks && run.phase === 'battle' && run.battle!.phase === 'deploy') result.forks.push(...forksOf(run))
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
export function runWith(seed: number, bot: Bot, doctrines: DoctrineId[] = [], forks = false): RunResult {
  const rng = { rng: seed }
  return play(seed, (run) => bot(run, rng), doctrines, forks).result
}
