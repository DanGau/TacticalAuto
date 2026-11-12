// Plays one run with a bot, and replays a recorded one.
import type { Bot } from '../bots/bots'
import { apply, type Action } from '../core/apply'
import { createRun, KEYS, nextStop } from '../core/run'
import { type Run } from '../core/run-state'
import { type Mission } from '../core/run-state'
import { health } from '../core/squad'
import { distance } from '../core/grid'
import { timedFlow } from '../core/step'
import type { DoctrineId } from '../core/doctrines'
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import type { Goal } from '../core/goals'
import type { ArenaKind } from '../core/arena-kinds'
import { carries, type UtilityId } from '../core/utilities'
import { forksOf, type Fork } from './forks'
import { restForks, type RestFork } from './rest'

/** Whether a party met a challenge with an answer it picked, with one it held and left behind, or with none. */
export type Answer = 'picked' | 'held' | 'none'

/** A battle's toll: which of the run it was, the leg it was on, the squad's most health, its health at the start and end, soldiers downed, whether it was won, and what it tested. */
export interface Toll {
  /** Which battle of the run it was, from 1. */
  nth: number
  leg: number
  party: number
  /** The kind of mission: a battle, key, final, ambush or recovery. */
  kind: Mission['kind']
  /** Whether it had a boss or commander: a key, final, ambush, Big one or takedown. */
  elite: boolean
  won: boolean
  goal: Goal
  challenge: ChallengeId | null
  answer: Answer
  most: number
  before: number
  after: number
  downed: number
  /** The hardest single hit a hero landed on an alien. */
  maxHit: number
  /** Rounds from the boss's first wound to its fall, counting both; null with no boss felled. */
  bossRounds: number | null
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
  /** With `rests` asked for: each safehouse on offer and fresh shop's medkit, the run played on both ways. */
  restForks: RestFork[]
  /** With the seed, enough to replay the run. */
  actions: Action[]
  /** Boons found or bought, by leg; the starting pick not counted. */
  found: number[]
  /** Safehouses rested at and medkits bought. */
  rests: { safehouses: number; medkits: number }
}

/** How the party met the battle's challenge, given the utilities it held going in. */
function answerOf(battle: NonNullable<Run['battle']>, held: UtilityId[]): Answer {
  const answers = battle.challenge ? CHALLENGES[battle.challenge].answers : []
  if (battle.utility && carries(battle.utility, answers)) return 'picked'
  return held.some((id) => carries(id, answers)) ? 'held' : 'none'
}

/** More player actions than any run takes: a run past it is stuck, and fails instead of hanging. */
const MAX_ACTIONS = 10000

/**
 * Plays a run to its end, taking each action from `next` when the run waits for the player.
 */
function play(seed: number, next: (run: Run) => Action, doctrines: DoctrineId[] = [], forks = false, rests = false): { run: Run; result: RunResult } {
  const run = createRun(seed)
  run.doctrines.push(...doctrines)
  const result: RunResult = { seed, won: false, keys: 0, endedOn: 'battle', battles: 0, draws: 0, durations: [], moments: { falls: 0, fallKills: 0, throws: 0, farthest: 0 }, jumps: {}, tolls: [], forks: [], restForks: [], actions: [], found: Array<number>(KEYS + 1).fill(0), rests: { safehouses: 0, medkits: 0 } }
  let clock = { next: 0, done: 0 }
  let leaps = 0
  /** This battle's hardest hero hit, its boss, and the round the boss was first wounded. */
  let hits = { max: 0, boss: -1, from: -1, rounds: null as number | null }
  /** The battle under way, its leg, the squad's health as it began, and the utilities it held. */
  let begun: [Run['battle'], number, number, UtilityId[], boolean] = [null, 0, 0, [], false]
  let had: { leg: number; held: (UtilityId | null)[] } = { leg: 0, held: [] }
  while (run.phase !== 'won' && run.phase !== 'lost') {
    const held = [...run.utilities, run.spare]
    result.found[had.leg] += held.filter((id) => id && !had.held.includes(id)).length
    had = { leg: run.keys, held }
    const battle = run.battle
    if (run.phase === 'battle' && begun[0] !== battle) {
      begun = [battle, run.keys, run.soldiers.reduce((sum, s) => sum + health(run, s), 0), [...run.utilities], battle!.units.some((u) => u.boss || u.target)]
      hits = { max: 0, boss: battle!.units.find((u) => u.boss)?.id ?? -1, from: -1, rounds: null }
    }
    if (run.phase === 'battle' && battle!.phase === 'battle') {
      const played = timedFlow(run, clock)
      clock = played.clock
      for (const event of played.events) {
        if (event.type === 'fall') result.moments.falls++
        if (event.type === 'fall' && !!event.fatal) result.moments.fallKills++
        if (event.type === 'throw') result.moments.throws++
        if (event.type === 'throw') result.moments.farthest = Math.max(result.moments.farthest, distance(event.from, event.to))
        if (event.type === 'move') leaps += event.leaps ?? 0
        if (event.type === 'shot' && event.damage > 0 && battle!.units.find((u) => u.id === event.id)?.side === 'human') {
          hits.max = Math.max(hits.max, event.damage)
          if (event.target === hits.boss && hits.from < 0) hits.from = battle!.round
        }
        if (event.type === 'death' && event.id === hits.boss && hits.from >= 0) hits.rounds = battle!.round - hits.from + 1
        if (event.type !== 'end') continue
        result.battles++
        const arena = (result.jumps[battle!.arenaKind] ??= { battles: 0, jumps: 0 })
        arena.battles++
        arena.jumps += leaps
        leaps = 0
        if (event.winner === null) result.draws++
        result.durations.push(clock.done)
        const fought = run.report!.soldiers
        result.tolls.push({ nth: result.battles, leg: begun[1], party: fought.length, kind: run.mission!.kind, elite: begun[4], won: event.winner === 'human', goal: battle!.goal, challenge: battle!.challenge, answer: answerOf(battle!, begun[3]), most: fought.reduce((sum, s) => sum + s.maxHp, 0), before: begun[2], after: fought.reduce((sum, s) => sum + s.hp, 0), downed: battle!.downed.length, maxHit: hits.max, bossRounds: hits.rounds })
        clock = { next: 0, done: 0 }
      }
      continue
    }
    if (result.actions.length >= MAX_ACTIONS) throw new Error(`seed ${seed}: no end after ${MAX_ACTIONS} actions, in phase ${run.phase}`)
    if (forks && run.phase === 'battle' && run.battle!.phase === 'deploy') result.forks.push(...forksOf(run))
    const action = next(run)
    const rest = rests ? restForks(run, action) : null
    if (rest) result.restForks.push(rest)
    if (action.type === 'advance' && nextStop(run) === 'safehouse') result.rests.safehouses++
    if (action.type === 'medkit') result.rests.medkits++
    const applied = apply(run, action)
    if (action.type === 'boons') had.held = [...run.utilities]
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
export function runWith(seed: number, bot: Bot, doctrines: DoctrineId[] = [], forks = false, rests = false): RunResult {
  const rng = { rng: seed }
  return play(seed, (run) => bot(run, rng), doctrines, forks, rests).result
}
