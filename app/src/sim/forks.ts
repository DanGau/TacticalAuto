// The clean comparison: at each deploy screen of a run, the same battle played from there with every utility and with none.
import { tankFor } from '../bots/strategic'
import { apply } from '../core/apply'
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import { fuelTanks } from '../core/objects'
import { type Run } from '../core/run-state'
import { health } from '../core/squad'
import { step } from '../core/step'
import { carries, UTILITY_IDS, type UtilityId } from '../core/utilities'

/** One battle played on from a deploy screen: the utility taken, whether it won, and the share of the party's most health lost. */
export interface Fork {
  challenge: ChallengeId
  party: number
  utility: UtilityId | null
  won: boolean
  lost: number
}

function playOn(run: Run, utility: UtilityId | null): Fork | null {
  const fork = structuredClone(run)
  fork.utilities = utility ? [utility] : []
  if (utility === 'tank' && fuelTanks(fork.battle!).length === 0) return null
  apply(fork, utility ? { type: 'enter', utility: 0, tank: utility === 'tank' ? tankFor(fork) : 0 } : { type: 'enter' })
  const before = fork.soldiers.reduce((sum, s) => sum + health(fork, s), 0)
  while (fork.phase === 'battle') step(fork)
  const fought = fork.report!.soldiers
  return { challenge: run.battle!.challenge!, party: run.soldiers.length, utility, won: fork.report!.won, lost: (before - fought.reduce((sum, s) => sum + s.hp, 0)) / fought.reduce((sum, s) => sum + s.maxHp, 0) }
}

/** The battle at this deploy screen, played with no utility and with each; the run itself is left as it was. */
export const forksOf = (run: Run): Fork[] => (run.battle!.challenge ? [null, ...UTILITY_IDS].flatMap((utility) => playOn(run, utility) ?? []) : [])

const cell = (of: Fork[]) => (of.length === 0 ? '-' : `${Math.round((100 * of.filter((f) => f.won).length) / of.length)}/${Math.round((100 * of.reduce((sum, f) => sum + f.lost, 0)) / of.length)}`).padEnd(8)

/** Wins/health lost in percent, by challenge and party: with no utility, with each answer, and with any other. */
export function formatForks(forks: Fork[]): string {
  const lines = ['challenge     party  battles  none    answers (wins/health lost)                    mismatch']
  for (const challenge of Object.keys(CHALLENGES) as ChallengeId[]) {
    for (const party of [1, 2, 3]) {
      const of = forks.filter((f) => f.challenge === challenge && f.party === party)
      if (of.length === 0) continue
      const { answers } = CHALLENGES[challenge]
      const shown = answers.map((id) => `${id} ${cell(of.filter((f) => f.utility === id))}`).join(' ').padEnd(46)
      lines.push(`${challenge.padEnd(14)}${party}  ${String(of.filter((f) => f.utility === null).length).padStart(8)}  ${cell(of.filter((f) => f.utility === null))}${shown}${cell(of.filter((f) => f.utility && !carries(f.utility, answers)))}`)
    }
  }
  return lines.join('\n')
}

/** Every utility's wins/health lost, by challenge and party. */
export function formatMatrix(forks: Fork[]): string {
  const lines = [`${''.padEnd(16)}${['none', ...UTILITY_IDS].map((id) => id.slice(0, 7).padEnd(8)).join('')}`]
  for (const challenge of Object.keys(CHALLENGES) as ChallengeId[]) {
    for (const party of [1, 2, 3]) {
      const of = forks.filter((f) => f.challenge === challenge && f.party === party)
      if (of.length > 0) lines.push(`${challenge.padEnd(14)}${party} ${[null, ...UTILITY_IDS].map((id) => cell(of.filter((f) => f.utility === id))).join('')}`)
    }
  }
  return lines.join('\n')
}
