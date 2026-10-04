import type { BattleResult } from './battle'

export interface Report {
  runs: number
  humanWins: number
  alienWins: number
  draws: number
  meanTicks: number
  /** Failed health thresholds. Any entry fails the batch. */
  failures: string[]
}

export function report(results: BattleResult[]): Report {
  const count = (winner: BattleResult['winner']) => results.filter((r) => r.winner === winner).length
  const draws = count(null)
  const failures: string[] = []
  if (draws > 0) {
    const seeds = results.filter((r) => r.winner === null).map((r) => r.seed)
    failures.push(`${draws} battles ended undecided (seeds ${seeds.join(', ')})`)
  }
  return {
    runs: results.length,
    humanWins: count('human'),
    alienWins: count('alien'),
    draws,
    meanTicks: Math.round(results.reduce((sum, r) => sum + r.ticks, 0) / results.length),
    failures,
  }
}

export function formatReport(r: Report): string {
  const percent = (n: number) => `${n} (${Math.round((100 * n) / r.runs)}%)`
  return [
    `runs        ${r.runs}`,
    `human wins  ${percent(r.humanWins)}`,
    `alien wins  ${percent(r.alienWins)}`,
    `draws       ${percent(r.draws)}`,
    `mean ticks  ${r.meanTicks}`,
    ...r.failures.map((f) => `FAIL        ${f}`),
  ].join('\n')
}
