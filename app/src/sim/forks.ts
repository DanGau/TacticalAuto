// The clean comparison: at each deploy screen of a run, the same battle played from there with every utility and with none.
import { tankFor } from '../bots/strategic'
import { apply } from '../core/apply'
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import { fuelTanks } from '../core/objects'
import { type Run } from '../core/run-state'
import { health } from '../core/hero'
import { step } from '../core/step'
import { carries, UTILITY_IDS, type EffectId, type UtilityId } from '../core/utilities'
import { ARENA_KINDS, type ArenaKind } from '../core/arena-kinds'

/** One battle played on from a deploy screen: the utility taken, whether it won, and the share of the hero's most health lost. */
export interface Fork {
  challenge: ChallengeId | null
  /** The ground it is fought over. */
  ground: ArenaKind
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
  return { challenge: run.battle!.challenge, ground: run.battle!.arenaKind, leg: run.keys, utility, won: fork.report!.won, lost: (before - fought.hp) / fought.maxHp }
}

/** The battle at this deploy screen, if it tests anything, played with no utility and with each; the run itself is left as it was. */
export const forksOf = (run: Run): Fork[] => (run.battle!.challenge || ARENA_KINDS[run.battle!.arenaKind].pays.length > 0 ? [null, ...UTILITY_IDS].flatMap((utility) => playOn(run, utility) ?? []) : [])

/** What answers a fork's battle: its challenge's answers and what exploits its ground. */
const answersOf = (f: Fork): EffectId[] => [...(f.challenge ? CHALLENGES[f.challenge].answers : []), ...ARENA_KINDS[f.ground].pays]

/** The legs a run crosses, the hub's last. */
const LEGS = [0, 1, 2, 3]

const cell = (of: Fork[]) => (of.length === 0 ? '-' : `${Math.round((100 * of.filter((f) => f.won).length) / of.length)}/${Math.round((100 * of.reduce((sum, f) => sum + f.lost, 0)) / of.length)}`).padEnd(8)

/**
 * Wins/health lost in percent: from the second leg, with a boon that answers what was scouted, with one that answers
 * none, and with none; on ground with no challenge, with a boon that exploits it and with any other; then by ground and
 * by challenge and leg, with each answer and with any other.
 */
export function formatForks(forks: Fork[]): string {
  // The first leg's fights pace the run, not test it.
  const tested = forks.filter((f) => f.leg > 0)
  const right = tested.filter((f) => f.utility && carries(f.utility, answersOf(f)))
  const wrong = tested.filter((f) => f.utility && !carries(f.utility, answersOf(f)))
  // Ground alone: battles with no challenge, where only the ground favours a pick.
  const bare = forks.filter((f) => !f.challenge && ARENA_KINDS[f.ground].pays.length > 0)
  const exploits = (f: Fork) => !!f.utility && carries(f.utility, ARENA_KINDS[f.ground].pays)
  const lines = [
    `scouted pick, legs 2+  right ${cell(right)} wrong ${cell(wrong)} none ${cell(tested.filter((f) => f.utility === null))}`,
    `ground alone           right ${cell(bare.filter(exploits))} wrong ${cell(bare.filter((f) => f.utility && !exploits(f)))} none ${cell(bare.filter((f) => f.utility === null))}`,
    '',
  ]
  lines.push('ground        leg    battles  none    pays (wins/health lost)                       others')
  for (const ground of (Object.keys(ARENA_KINDS) as ArenaKind[]).filter((k) => ARENA_KINDS[k].pays.length > 0)) {
    for (const leg of LEGS) {
      const of = forks.filter((f) => f.ground === ground && f.leg === leg)
      if (of.length === 0) continue
      const { pays } = ARENA_KINDS[ground]
      const shown = pays.map((id) => `${id} ${cell(of.filter((f) => f.utility === id))}`).join(' ').padEnd(46)
      lines.push(`${ground.padEnd(14)}${leg}  ${String(of.filter((f) => f.utility === null).length).padStart(8)}  ${cell(of.filter((f) => f.utility === null))}${shown}${cell(of.filter((f) => f.utility && !carries(f.utility, pays)))}`)
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
