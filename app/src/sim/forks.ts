// The clean comparison: at each deploy screen of a run, the same battle played from there with every utility and with none.
import { tankFor } from '../bots/strategic'
import { apply } from '../core/apply'
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import { fuelTanks } from '../core/objects'
import { type Run } from '../core/run-state'
import { health } from '../core/hero'
import { step } from '../core/step'
import { carries, UTILITY_IDS, type EffectId, type UtilityId } from '../core/utilities'
import { ARENA_KINDS, isBarrier, type ArenaKind } from '../core/arena-kinds'

/** One battle played on from a deploy screen: the utility taken, whether it won, and the share of the hero's most health lost. */
export interface Fork {
  challenge: ChallengeId | null
  /** The barrier across the route, if any. */
  barrier: ArenaKind | null
  leg: number
  utility: UtilityId | null
  won: boolean
  lost: number
}

function playOn(run: Run, utility: UtilityId | null): Fork | null {
  const fork = structuredClone(run)
  fork.utilities = utility ? [utility] : []
  if (utility === 'tank' && fuelTanks(fork.battle!).length === 0) return null
  apply(fork, utility ? { type: 'enter', utility: 0, tank: utility === 'tank' ? tankFor(fork) : 0 } : { type: 'enter' })
  const before = health(fork, fork.hero)
  while (fork.phase === 'battle') step(fork)
  const fought = fork.report!.hero!
  const kind = run.battle!.arenaKind
  return { challenge: run.battle!.challenge, barrier: isBarrier(kind) ? kind : null, leg: run.keys, utility, won: fork.report!.won, lost: (before - fought.hp) / fought.maxHp }
}

/** The battle at this deploy screen, if it tests anything, played with no utility and with each; the run itself is left as it was. */
export const forksOf = (run: Run): Fork[] => (run.battle!.challenge || isBarrier(run.battle!.arenaKind) ? [null, ...UTILITY_IDS].flatMap((utility) => playOn(run, utility) ?? []) : [])

/** What answers a fork's battle: its challenge's answers and what opens its barrier. */
const answersOf = (f: Fork): EffectId[] => [...(f.challenge ? CHALLENGES[f.challenge].answers : []), ...(f.barrier ? ARENA_KINDS[f.barrier].opens! : [])]

/** The legs a run crosses, the hub's last. */
const LEGS = [0, 1, 2, 3]

const cell = (of: Fork[]) => (of.length === 0 ? '-' : `${Math.round((100 * of.filter((f) => f.won).length) / of.length)}/${Math.round((100 * of.reduce((sum, f) => sum + f.lost, 0)) / of.length)}`).padEnd(8)

/**
 * Wins/health lost in percent: from the second leg, with a boon that answers what was scouted, with one that answers
 * none, and with none; then by barrier and by challenge and leg, with each answer and with any other.
 */
export function formatForks(forks: Fork[]): string {
  // The first leg's fights pace the run, not test it.
  const tested = forks.filter((f) => f.leg > 0)
  const right = tested.filter((f) => f.utility && carries(f.utility, answersOf(f)))
  const wrong = tested.filter((f) => f.utility && !carries(f.utility, answersOf(f)))
  const barred = tested.filter((f) => f.barrier)
  const opener = (f: Fork) => !!f.utility && carries(f.utility, ARENA_KINDS[f.barrier!].opens!)
  const lines = [
    `scouted pick, legs 2+  right ${cell(right)} wrong ${cell(wrong)} none ${cell(tested.filter((f) => f.utility === null))}`,
    `barrier, legs 2+       opener ${cell(barred.filter(opener))} other ${cell(barred.filter((f) => f.utility && !opener(f)))} none ${cell(barred.filter((f) => f.utility === null))}`,
    '',
  ]
  lines.push('barrier       leg    battles  none    openers (wins/health lost)                    others')
  for (const barrier of Object.keys(ARENA_KINDS).filter((k) => isBarrier(k as ArenaKind)) as ArenaKind[]) {
    for (const leg of LEGS) {
      const of = forks.filter((f) => f.barrier === barrier && f.leg === leg)
      if (of.length === 0) continue
      const opens = ARENA_KINDS[barrier].opens!
      const shown = opens.map((id) => `${id} ${cell(of.filter((f) => f.utility === id))}`).join(' ').padEnd(46)
      lines.push(`${barrier.padEnd(14)}${leg}  ${String(of.filter((f) => f.utility === null).length).padStart(8)}  ${cell(of.filter((f) => f.utility === null))}${shown}${cell(of.filter((f) => f.utility && !carries(f.utility, opens)))}`)
    }
  }
  lines.push('', 'challenge     leg    battles  none    answers (wins/health lost)                    mismatch')
  for (const challenge of Object.keys(CHALLENGES) as ChallengeId[]) {
    for (const leg of LEGS) {
      const of = forks.filter((f) => f.challenge === challenge && f.leg === leg)
      if (of.length === 0) continue
      const { answers } = CHALLENGES[challenge]
      const shown = answers.map((id) => `${id} ${cell(of.filter((f) => f.utility === id))}`).join(' ').padEnd(46)
      lines.push(`${challenge.padEnd(14)}${leg}  ${String(of.filter((f) => f.utility === null).length).padStart(8)}  ${cell(of.filter((f) => f.utility === null))}${shown}${cell(of.filter((f) => f.utility && !carries(f.utility, answers)))}`)
    }
  }
  return lines.join('\n')
}

/** Every utility's wins/health lost, by challenge and leg. */
export function formatMatrix(forks: Fork[]): string {
  const lines = [`${''.padEnd(16)}${['none', ...UTILITY_IDS].map((id) => id.slice(0, 7).padEnd(8)).join('')}`]
  for (const challenge of Object.keys(CHALLENGES) as ChallengeId[]) {
    for (const leg of LEGS) {
      const of = forks.filter((f) => f.challenge === challenge && f.leg === leg)
      if (of.length > 0) lines.push(`${challenge.padEnd(14)}${leg} ${[null, ...UTILITY_IDS].map((id) => cell(of.filter((f) => f.utility === id))).join('')}`)
    }
  }
  return lines.join('\n')
}
