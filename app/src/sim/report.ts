// Turns run results into a report, with its balance bands and warnings.
import type { Goal } from '../core/goals'
import { KEYS } from '../core/run'
import type { RunResult, Toll } from './run'

export interface Report {
  runs: number
  wins: number
  lostToBattle: number
  lostToRecovery: number
  lostToAmbush: number
  lostToExtraction: number
  lostToFinal: number
  /** Mean access keys won, of KEYS. */
  meanKeys: number
  meanBattles: number
  /** Seconds a battle takes to play in the view: the median, the 90th percentile, and the longest. */
  seconds: { median: number; p90: number; max: number }
  /** What battles cost the squad, as shares of its most health in percent: lost and left, each by mean, and left by leg; points lost; soldiers downed a battle; battles ended under 75%. */
  attrition: { lost: number; hp: number; points: number; downed: number; worn: number; legs: number[] }
  /** Battles past MAX_BATTLE_SECONDS, which the report warns of without failing. */
  warnings: string[]
  /** Failed health thresholds. Any entry fails the batch. */
  failures: string[]
}

/** Seconds a battle may take to play in the view before the report warns. */
const MAX_BATTLE_SECONDS = 60

export function report(results: RunResult[]): Report {
  const mean = (value: (r: RunResult) => number) => Math.round((10 * results.reduce((sum, r) => sum + value(r), 0)) / results.length) / 10
  const lost = (kind: RunResult['endedOn']) => results.filter((r) => !r.won && r.endedOn === kind).length
  const failures: string[] = []
  const drawn = results.filter((r) => r.draws > 0)
  if (drawn.length > 0) failures.push(`battles hit the beat limit undecided in seeds ${drawn.map((r) => r.seed).join(', ')}`)
  const timed = results.flatMap((r) => r.durations.map((ms) => ({ seed: r.seed, s: ms / 1000 }))).sort((a, b) => a.s - b.s)
  const at = (q: number) => Math.round(timed[Math.min(timed.length - 1, Math.floor(q * timed.length))]?.s ?? 0)
  const slow = timed.filter((t) => t.s > MAX_BATTLE_SECONDS)
  const warnings = slow.length > 0 ? [`${slow.length} of ${timed.length} battles play longer than ${MAX_BATTLE_SECONDS}s, in seeds ${[...new Set(slow.map((t) => t.seed))].join(', ')}`] : []
  const tolls = results.flatMap((r) => r.tolls)
  const share = (of: Toll[], value: (t: Toll) => number) => Math.round((100 * of.reduce((sum, t) => sum + value(t) / t.most, 0)) / Math.max(1, of.length))
  const each = (value: (t: Toll) => number) => tolls.reduce((sum, t) => sum + value(t), 0) / Math.max(1, tolls.length)
  return {
    runs: results.length,
    wins: results.filter((r) => r.won).length,
    lostToBattle: lost('battle'),
    lostToRecovery: lost('recovery'),
    lostToAmbush: lost('ambush'),
    lostToExtraction: lost('key'),
    lostToFinal: lost('final'),
    meanKeys: mean((r) => r.keys),
    meanBattles: mean((r) => r.battles),
    seconds: { median: at(0.5), p90: at(0.9), max: at(1) },
    attrition: {
      lost: share(tolls, (t) => t.before - t.after),
      hp: share(tolls, (t) => t.after),
      points: Math.round(10 * each((t) => t.before - t.after)) / 10,
      downed: Math.round(100 * each((t) => t.downed)) / 100,
      worn: Math.round(100 * each((t) => (t.after < 0.75 * t.most ? 1 : 0))),
      legs: Array.from({ length: KEYS + 1 }, (_, leg) => share(tolls.filter((t) => t.leg === leg), (t) => t.after)),
    },
    warnings,
    failures,
  }
}

export function formatReport(r: Report): string {
  const percent = (n: number) => `${n} (${Math.round((100 * n) / r.runs)}%)`
  return [
    `runs                ${r.runs}`,
    `wins                ${percent(r.wins)}`,
    `lost a battle       ${percent(r.lostToBattle)}`,
    `lost a recovery     ${percent(r.lostToRecovery)}`,
    `lost an ambush      ${percent(r.lostToAmbush)}`,
    `lost an extraction  ${percent(r.lostToExtraction)}`,
    `lost final mission  ${percent(r.lostToFinal)}`,
    `mean keys won       ${r.meanKeys} of ${KEYS}`,
    `mean battles        ${r.meanBattles}`,
    `battle seconds      median ${r.seconds.median}, p90 ${r.seconds.p90}, max ${r.seconds.max}`,
    `squad health        loses ${r.attrition.lost}% (${r.attrition.points}) a battle, ends at ${r.attrition.hp}%; ${r.attrition.worn}% of battles end under 75%; ${r.attrition.downed} downed a battle`,
    `ends at, by leg     ${r.attrition.legs.map((n) => `${n}%`).join(', ')}`,
    ...r.warnings.map((w) => `WARN                ${w}`),
    ...r.failures.map((f) => `FAIL                ${f}`),
  ].join('\n')
}

/**
 * Win-rate bands a healthy game sits in, after roguelikes like Slay the Spire: random play rarely wins but can,
 * the baseline wins about half its runs, the best play still loses some, good choices clearly beat random ones,
 * and building around keywords beats taking the first offer.
 */
const BANDS = { floor: [0.03, 0.25], baseline: [0.35, 0.6], ceiling: [0, 0.85], gap: 0.25, payoff: 0.05 } as const

/** A mission played alone by the encounter sim: a goal, or an extraction or the final mission. */
export type Encounter = Goal | 'key' | 'final'
export type Squad = 'weak' | 'strong'

/**
 * Win rates each mission played alone should land in at every leg, for a weak squad (the levels a careless run
 * reaches, no gear) and a strong one (levelled, geared, a relic a leg): a strong squad rampages, a weak one can
 * lose anywhere, so a run that falls behind must route around danger.
 */
export const ENCOUNTER_BANDS: Record<Encounter, Record<Squad, readonly [number, number]>> = {
  exterminate: { weak: [0.5, 0.85], strong: [0.9, 1] },
  assassinate: { weak: [0.4, 0.85], strong: [0.85, 1] },
  hold: { weak: [0.3, 0.75], strong: [0.8, 1] },
  rescue: { weak: [0.2, 0.6], strong: [0.85, 1] },
  vip: { weak: [0.3, 0.75], strong: [0.8, 1] },
  raid: { weak: [0.5, 0.9], strong: [0.9, 1] },
  ambush: { weak: [0.3, 0.75], strong: [0.75, 1] },
  recover: { weak: [0.3, 0.75], strong: [0.8, 1] },
  key: { weak: [0.3, 0.75], strong: [0.8, 1] },
  final: { weak: [0.1, 0.5], strong: [0.6, 0.95] },
}

/** Each band a set of win rates breaks, with how far outside it they fall. */
function breaches(rates: Record<string, number>): { by: number; text: string }[] {
  const pct = (n: number) => `${Math.round(100 * n)}%`
  const [top, topRate] = Object.entries(rates).sort((a, b) => b[1] - a[1])[0]
  const outside = (name: string, rate: number, [low, high]: readonly [number, number]) =>
    rate < low || rate > high ? [{ by: Math.max(low - rate, rate - high), text: `${name} wins ${pct(rate)}, outside ${pct(low)}–${pct(high)}` }] : []
  const short = (by: number, text: string) => (by > 0 ? [{ by, text }] : [])
  return [
    ...outside('random (floor)', rates.random, BANDS.floor),
    ...outside('standard (baseline)', rates.standard, BANDS.baseline),
    ...outside(`${top} (ceiling)`, topRate, BANDS.ceiling),
    ...short(BANDS.gap - (topRate - rates.random), `the best play beats random by only ${pct(topRate - rates.random)}; choices matter too little`),
    ...short(BANDS.payoff - (rates.synergy - rates.standard), `synergy beats standard by only ${pct(rates.synergy - rates.standard)}; keyword builds pay too little`),
  ]
}

/** How far, in total, a set of win rates falls outside the bands: 0 when it breaks none. */
export const offBand = (rates: Record<string, number>) => breaches(rates).reduce((sum, m) => sum + m.by, 0)

/** Each bot's win rate on the same seeds, best first, and the bands they break. */
export function compare(rates: Record<string, number>): { table: string; warnings: string[] } {
  const ranked = Object.entries(rates).sort((a, b) => b[1] - a[1])
  const table = ranked.map(([name, rate]) => `${name.padEnd(12)}${`${Math.round(100 * rate)}%`.padStart(5)}`).join('\n')
  return { table, warnings: breaches(rates).map((m) => m.text) }
}
