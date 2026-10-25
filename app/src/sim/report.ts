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

/**
 * Win-rate bands a healthy game sits in, after roguelikes like Slay the Spire: random play rarely wins but can,
 * the baseline wins about half its runs, the best play still loses some, and good choices clearly beat random ones.
 */
export const BANDS = { floor: [0.03, 0.25], baseline: [0.35, 0.6], ceiling: [0, 0.85], gap: 0.25 } as const

/** Each bot's win rate on the same seeds, best first, and the bands they break. */
export function compare(rates: Record<string, number>): { table: string; warnings: string[] } {
  const ranked = Object.entries(rates).sort((a, b) => b[1] - a[1])
  const pct = (n: number) => `${Math.round(100 * n)}%`
  const outside = (name: string, rate: number, [low, high]: readonly [number, number]) =>
    rate < low || rate > high ? [`${name} wins ${pct(rate)}, outside ${pct(low)}–${pct(high)}`] : []
  const [top, topRate] = ranked[0]
  const warnings = [
    ...outside('random (floor)', rates.random, BANDS.floor),
    ...outside('standard (baseline)', rates.standard, BANDS.baseline),
    ...outside(`${top} (ceiling)`, topRate, BANDS.ceiling),
    ...(topRate - rates.random < BANDS.gap ? [`the best play beats random by only ${pct(topRate - rates.random)}; choices matter too little`] : []),
  ]
  return { table: ranked.map(([name, rate]) => `${name.padEnd(12)}${pct(rate).padStart(5)}`).join('\n'), warnings }
}
