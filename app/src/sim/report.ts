// Turns run results into a report, and says of what is off whether the game or the bot is at fault.
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import { KEYS } from '../core/run'
import type { Answer, RunResult, Toll } from './run'

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
  /** Falls, fall kills and throws a battle, and the farthest throw in tiles. */
  moments: { falls: number; fallKills: number; throws: number; farthest: number }
  /** Jumps a battle, by arena kind. */
  jumps: Record<string, number>
  /** What battles cost the squad, as shares of its most health in percent: lost and left, each by mean, and left by leg; points lost; soldiers downed a battle; battles ended under 75%. */
  attrition: { lost: number; hp: number; points: number; downed: number; worn: number; legs: number[] }
  /** Heroes' hits on aliens: the hardest, and the hardest but one in a hundred battles; and rounds a boss from leg LATE_LEG on takes to fell, by median and least. */
  hits: { max: number; p99: number; bossRounds: number; leastBossRounds: number }
  /** Battles past MAX_BATTLE_SECONDS, which the report warns of without failing. */
  warnings: string[]
  /** What fails the batch: battles stuck at the beat limit. */
  failures: string[]
}

/** The leg from which a boss counts as late in a run. */
export const LATE_LEG = 2
/** The least median rounds a late boss may take to fell, and the hardest hit a hero may land. */
export const BOSS_ROUNDS_FLOOR = 4
export const HIT_CEILING = 40

/** Seconds a battle may take to play in the view before the report warns. */
const MAX_BATTLE_SECONDS = 60

/** Jumps a battle on each arena kind, over all runs. */
function jumpsByArena(results: RunResult[]): Record<string, number> {
  const sum: Record<string, { battles: number; jumps: number }> = {}
  for (const r of results)
    for (const [kind, { battles, jumps }] of Object.entries(r.jumps)) {
      const s = (sum[kind] ??= { battles: 0, jumps: 0 })
      s.battles += battles
      s.jumps += jumps
    }
  return Object.fromEntries(Object.entries(sum).map(([kind, s]) => [kind, Math.round((10 * s.jumps) / s.battles) / 10]))
}

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
  const battles = Math.max(1, results.reduce((sum, r) => sum + r.battles, 0))
  const per = (of: (m: RunResult['moments']) => number) => Math.round((100 * results.reduce((sum, r) => sum + of(r.moments), 0)) / battles) / 100
  const share = (of: Toll[], value: (t: Toll) => number) => Math.round((100 * of.reduce((sum, t) => sum + value(t) / t.most, 0)) / Math.max(1, of.length))
  const each = (value: (t: Toll) => number) => tolls.reduce((sum, t) => sum + value(t), 0) / Math.max(1, tolls.length)
  const hardest = tolls.map((t) => t.maxHit).sort((a, b) => a - b)
  const felled = tolls.filter((t) => t.leg >= LATE_LEG && t.bossRounds !== null).map((t) => t.bossRounds!).sort((a, b) => a - b)
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
    moments: { falls: per((m) => m.falls), fallKills: per((m) => m.fallKills), throws: per((m) => m.throws), farthest: Math.max(0, ...results.map((r) => r.moments.farthest)) },
    jumps: jumpsByArena(results),
    attrition: {
      lost: share(tolls, (t) => t.before - t.after),
      hp: share(tolls, (t) => t.after),
      points: Math.round(10 * each((t) => t.before - t.after)) / 10,
      downed: Math.round(100 * each((t) => t.downed)) / 100,
      worn: Math.round(100 * each((t) => (t.after < 0.75 * t.most ? 1 : 0))),
      legs: Array.from({ length: KEYS + 1 }, (_, leg) => share(tolls.filter((t) => t.leg === leg), (t) => t.after)),
    },
    hits: { max: hardest.at(-1) ?? 0, p99: hardest[Math.floor(0.99 * hardest.length)] ?? 0, bossRounds: felled[Math.floor(felled.length / 2)] ?? 0, leastBossRounds: felled[0] ?? 0 },
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
    `a battle            ${r.moments.falls} falls, ${r.moments.fallKills} fall kills, ${r.moments.throws} throws, farthest ${r.moments.farthest} tiles`,
    `jumps a battle      ${Object.entries(r.jumps).map(([kind, n]) => `${kind} ${n}`).join(', ')}`,
    `squad health        loses ${r.attrition.lost}% (${r.attrition.points}) a battle, ends at ${r.attrition.hp}%; ${r.attrition.worn}% of battles end under 75%; ${r.attrition.downed} downed a battle`,
    `ends at, by leg     ${r.attrition.legs.map((n) => `${n}%`).join(', ')}`,
    `hero hits           hardest ${r.hits.max}, p99 battle ${r.hits.p99}; a late boss falls in ${r.hits.bossRounds} rounds by median, ${r.hits.leastBossRounds} at least`,
    ...r.warnings.map((w) => `WARN                ${w}`),
    ...r.failures.map((f) => `FAIL                ${f}`),
  ].join('\n')
}

/** Each bot's win rate on the same seeds, best first. */
export const ranked = (rates: Record<string, number>) => Object.entries(rates).sort((a, b) => b[1] - a[1]).map(([name, rate]) => `${name.padEnd(12)}${`${Math.round(100 * rate)}%`.padStart(5)}`).join('\n')

/** One row of the diagnosis: how battles of a challenge went, by whether the party met it with an answer. */
export interface Row {
  challenge: ChallengeId
  party: number
  answer: Answer
  battles: number
  won: number
  /** Health lost, as a share of the party's most, in percent. */
  lost: number
}

/** Battles of each challenge, by party size and answer. */
export function rows(results: RunResult[]): Row[] {
  const tolls = results.flatMap((r) => r.tolls)
  return (Object.keys(CHALLENGES) as ChallengeId[]).flatMap((challenge) =>
    [1, 2, 3].flatMap((party) => (['picked', 'held', 'none'] as const).flatMap((answer): Row[] => {
      const of = tolls.filter((t) => t.challenge === challenge && t.party === party && t.answer === answer)
      if (of.length === 0) return []
      return [{ challenge, party, answer, battles: of.length, won: Math.round((100 * of.filter((t) => t.won).length) / of.length), lost: Math.round((100 * of.reduce((sum, t) => sum + (t.before - t.after) / t.most, 0)) / of.length) }]
    })),
  )
}

/** Battles needed before a row is read at all. */
const READ_FROM = 10
/** Wins with the answer picked below which a challenge is too hard; wins and health lost without one above and below which a mismatch is too cheap. */
const HARD = 70
const CHEAP = { won: 95, lost: 20 }

/**
 * What each row says. Won with the answer: the encounter is fine. Lost with it: the encounter is too hard, the game's
 * fault. Held the answer and went in without it: the bot's fault. No answer held: what a mismatch costs, the game's
 * if it costs too little; how often it happened is the bot's route and keeping, or the shops' luck.
 */
export function verdicts(of: Row[]): string[] {
  const found: string[] = []
  for (const row of of) {
    const name = `${CHALLENGES[row.challenge].name} (party of ${row.party})`
    if (row.answer === 'held') found.push(`BOT: held an answer to ${name} and went in without it, ${row.battles} times`)
    if (row.battles < READ_FROM) continue
    if (row.answer === 'picked' && row.won < HARD) found.push(`GAME: ${name} too hard even with its answer: won ${row.won}% of ${row.battles}`)
    if (row.answer === 'none' && row.won >= CHEAP.won && row.lost < CHEAP.lost) found.push(`GAME: a mismatch on ${name} costs too little: won ${row.won}%, lost ${row.lost}% health`)
    const none = of.find((r) => r.challenge === row.challenge && r.party === row.party && r.answer === 'none')
    if (row.answer === 'picked' && none && none.battles >= READ_FROM && row.lost >= none.lost && row.won <= none.won) found.push(`GAME: the answer to ${name} does not answer it: lost ${row.lost}% health with, ${none.lost}% without`)
  }
  return found
}

/** Battles 1 to `upTo` by their place in the run, as `nth won% lost% of n`, and what each met. */
export function byBattle(results: RunResult[], upTo = 10): string {
  const tolls = results.flatMap((r) => r.tolls)
  return Array.from({ length: upTo }, (_, i) => {
    const of = tolls.filter((t) => t.nth === i + 1)
    if (of.length === 0) return ''
    const won = Math.round((100 * of.filter((t) => t.won).length) / of.length)
    const lost = Math.round((100 * of.reduce((sum, t) => sum + (t.before - t.after) / t.most, 0)) / of.length)
    const met = [...new Set(of.map((t) => t.challenge))].map((c) => {
      const each = of.filter((t) => t.challenge === c)
      return `${c ?? 'normal'} ${each.length} (${Math.round((100 * each.filter((t) => t.won).length) / each.length)}%)`
    }).join(', ')
    return `${String(i + 1).padStart(2)}  won ${won}%  lost ${lost}%  of ${of.length}: ${met}`
  }).filter(Boolean).join('\n')
}

/** Battle wins by goal, as `name won% of n`. */
export function byGoal(results: RunResult[]): string {
  const tolls = results.flatMap((r) => r.tolls)
  return [...new Set(tolls.map((t) => t.goal))].map((goal) => {
    const of = tolls.filter((t) => t.goal === goal)
    return `${goal} ${Math.round((100 * of.filter((t) => t.won).length) / of.length)}% of ${of.length}`
  }).join(', ')
}

export function formatDiagnosis(bot: string, of: Row[]): string {
  const head = `${bot}: challenge, party, answer, battles, won, health lost`
  const lines = of.map((r) => `${CHALLENGES[r.challenge].name.padEnd(14)}${r.party}  ${r.answer.padEnd(9)}${String(r.battles).padStart(7)}${`${r.won}%`.padStart(6)}${`${r.lost}%`.padStart(13)}`)
  const found = verdicts(of)
  return [head, ...lines, ...(found.length > 0 ? found : ['nothing off'])].join('\n')
}

/** Wins the strategic bot must reach for `npm run check` to pass: that good choices can win runs, not a target for balance. */
export const STRATEGIC_FLOOR = 0.15
/** Of the first leg's opening battles, the share it must win: they pace the run, not test it. */
export const OPENING_FLOOR = 0.95
