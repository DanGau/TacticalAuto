import { KEYS } from '../core/run'
import type { RunResult } from './run'

export interface Report {
  runs: number
  wins: number
  lostToLastStand: number
  lostToFinal: number
  /** Mean access keys won, of KEYS. */
  meanKeys: number
  meanBattles: number
  /** Failed health thresholds. Any entry fails the batch. */
  failures: string[]
}

export function report(results: RunResult[]): Report {
  const mean = (value: (r: RunResult) => number) => Math.round((10 * results.reduce((sum, r) => sum + value(r), 0)) / results.length) / 10
  const lost = (kind: RunResult['endedOn']) => results.filter((r) => !r.won && r.endedOn === kind).length
  const failures: string[] = []
  const drawn = results.filter((r) => r.draws > 0)
  if (drawn.length > 0) failures.push(`battles hit the beat limit undecided in seeds ${drawn.map((r) => r.seed).join(', ')}`)
  return {
    runs: results.length,
    wins: results.filter((r) => r.won).length,
    lostToLastStand: lost('lastStand'),
    lostToFinal: lost('final'),
    meanKeys: mean((r) => r.keys),
    meanBattles: mean((r) => r.battles),
    failures,
  }
}

export function formatReport(r: Report): string {
  const percent = (n: number) => `${n} (${Math.round((100 * n) / r.runs)}%)`
  return [
    `runs                ${r.runs}`,
    `wins                ${percent(r.wins)}`,
    `lost a last stand   ${percent(r.lostToLastStand)}`,
    `lost final mission  ${percent(r.lostToFinal)}`,
    `mean keys won       ${r.meanKeys} of ${KEYS}`,
    `mean battles        ${r.meanBattles}`,
    ...r.failures.map((f) => `FAIL                ${f}`),
  ].join('\n')
}
