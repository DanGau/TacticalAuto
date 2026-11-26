// Turns run results into a report, and says of what is off whether the game or the bot is at fault.
import { CHALLENGES, type ChallengeId } from '../core/challenges'
import { KEYS } from '../core/run'
import type { RunResult, Toll } from './run'

export interface Report {
  runs: number
  wins: number
  lostToBattle: number
  lostToAmbush: number
  lostToExtraction: number
  lostToFinal: number
  /** Mean access keys won, of KEYS. */
  meanKeys: number
  meanBattles: number
  /** Seconds a battle takes to play in the view: the median, the 90th percentile, and the longest. */
  seconds: { median: number; p90: number; max: number }
  /** Falls and fall kills a battle. */
  moments: { falls: number; fallKills: number }
  /** Jumps a battle, by arena kind. */
  jumps: Record<string, number>
  /** What battles cost the hero, as shares of its most health in percent: lost and left, each by mean, and left by leg; points lost; falls a battle; battles ended under 75%. */
  attrition: { lost: number; hp: number; points: number; downed: number; worn: number; legs: number[] }
  /** Runs lost, by the hero's health entering the last battle: sudden from SUDDEN up, attrition under WORN, mixed between; the share of sudden ones with a boss or commander; and what the sudden ones were. */
  losses: { sudden: number; mixed: number; attrition: number; elite: number; what: string }
  /** Battles begun from SUDDEN up that ended under SPIKE or lost, in percent of such battles, by what they were. */
  spikes: { rate: number; what: string }
  /** Heroes' hits on aliens: the hardest, and the hardest but one in a hundred battles; and rounds a boss from leg LATE_LEG on takes to fell, by median and least. */
  hits: { max: number; p99: number; bossRounds: number; leastBossRounds: number }
  /** Cards added to the deck a run, by leg; and the deck's size at the end by mean. */
  taken: number[]
  deck: number
  /** Safehouses rested at and medkits bought a run. */
  rests: { safehouses: number; medkits: number }
  /** Battles past MAX_BATTLE_SECONDS, which the report warns of without failing. */
  warnings: string[]
  /** What fails the batch: battles stuck at the beat limit. */
  failures: string[]
}

/** The leg from which a boss counts as late in a run. */
export const LATE_LEG = 2
/** The least median rounds a late boss may take to fell, and the hardest hit a hero may land: payoffs multiply by stacks, so a built hero hits far above its damage. */
export const BOSS_ROUNDS_FLOOR = 4
export const HIT_CEILING = 80

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
  const fatal = results.filter((r) => !r.won && r.tolls.length > 0).map((r) => r.tolls.at(-1)!)
  const hardest = tolls.map((t) => t.maxHit).sort((a, b) => a - b)
  const felled = tolls.filter((t) => t.leg >= LATE_LEG && t.bossRounds !== null).map((t) => t.bossRounds!).sort((a, b) => a - b)
  return {
    runs: results.length,
    wins: results.filter((r) => r.won).length,
    lostToBattle: lost('battle'),
    lostToAmbush: lost('ambush'),
    lostToExtraction: lost('key'),
    lostToFinal: lost('final'),
    meanKeys: mean((r) => r.keys),
    meanBattles: mean((r) => r.battles),
    seconds: { median: at(0.5), p90: at(0.9), max: at(1) },
    moments: { falls: per((m) => m.falls), fallKills: per((m) => m.fallKills) },
    jumps: jumpsByArena(results),
    attrition: {
      lost: share(tolls, (t) => t.before - t.after),
      hp: share(tolls, (t) => t.after),
      points: Math.round(10 * each((t) => t.before - t.after)) / 10,
      downed: Math.round(100 * each((t) => t.downed)) / 100,
      worn: Math.round(100 * each((t) => (t.after < 0.75 * t.most ? 1 : 0))),
      legs: Array.from({ length: KEYS + 1 }, (_, leg) => share(tolls.filter((t) => t.leg === leg), (t) => t.after)),
    },
    losses: losses(fatal),
    spikes: spikes(tolls),
    hits: { max: hardest.at(-1) ?? 0, p99: hardest[Math.floor(0.99 * hardest.length)] ?? 0, bossRounds: felled[Math.floor(felled.length / 2)] ?? 0, leastBossRounds: felled[0] ?? 0 },
    taken: Array.from({ length: KEYS + 1 }, (_, leg) => mean((r) => r.taken[leg])),
    deck: mean((r) => r.deck),
    rests: { safehouses: mean((r) => r.rests.safehouses), medkits: mean((r) => r.rests.medkits) },
    warnings,
    failures,
  }
}

/** Shares of the hero's most health: entering a fatal battle at SUDDEN or more makes a loss sudden, under WORN attrition; a battle begun at SUDDEN that ends under SPIKE is a spike. */
export const SUDDEN = 0.75
export const WORN = 0.5
export const SPIKE = 0.25

/** What a battle was: its mission kind or goal, its challenge, and * if it had a commander or big one. */
const what = (t: Toll) => `${t.kind === 'battle' ? t.goal : t.kind}${t.challenge ? `/${t.challenge}` : ''}${t.elite && t.kind === 'battle' ? '*' : ''}`

/** `of`, counted by what each was, most first, as `what n`. */
function tally(of: Toll[], top = 8): string {
  const counts = new Map<string, number>()
  for (const t of of) counts.set(what(t), (counts.get(what(t)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => `${k} ${n}`).join(', ')
}

function losses(fatal: Toll[]): Report['losses'] {
  const pct = (n: number) => Math.round((100 * n) / Math.max(1, fatal.length))
  const sudden = fatal.filter((t) => t.before >= SUDDEN * t.most)
  const attrition = fatal.filter((t) => t.before < WORN * t.most).length
  return { sudden: pct(sudden.length), mixed: pct(fatal.length - sudden.length - attrition), attrition: pct(attrition), elite: Math.round((100 * sudden.filter((t) => t.elite).length) / Math.max(1, sudden.length)), what: tally(sudden) }
}

function spikes(tolls: Toll[]): Report['spikes'] {
  const healthy = tolls.filter((t) => t.before >= SUDDEN * t.most)
  const spiked = new Set(healthy.filter((t) => !t.won || t.after < SPIKE * t.most))
  const rate = (of: Toll[]) => Math.round((1000 * of.filter((t) => spiked.has(t)).length) / Math.max(1, of.length)) / 10
  const kinds = [...new Set([...spiked].map(what))].map((k) => ({ k, of: healthy.filter((t) => what(t) === k) }))
  return { rate: rate(healthy), what: kinds.sort((a, b) => rate(b.of) * b.of.length - rate(a.of) * a.of.length).slice(0, 10).map(({ k, of }) => `${k} ${rate(of)}% of ${of.length}`).join(', ') }
}
export function formatReport(r: Report): string {
  const percent = (n: number) => `${n} (${Math.round((100 * n) / r.runs)}%)`
  return [
    `runs                ${r.runs}`,
    `wins                ${percent(r.wins)}`,
    `lost a battle       ${percent(r.lostToBattle)}`,
    `lost an ambush      ${percent(r.lostToAmbush)}`,
    `lost an extraction  ${percent(r.lostToExtraction)}`,
    `lost final mission  ${percent(r.lostToFinal)}`,
    `mean keys won       ${r.meanKeys} of ${KEYS}`,
    `mean battles        ${r.meanBattles}`,
    `battle seconds      median ${r.seconds.median}, p90 ${r.seconds.p90}, max ${r.seconds.max}`,
    `a battle            ${r.moments.falls} falls, ${r.moments.fallKills} fall kills`,
    `jumps a battle      ${Object.entries(r.jumps).map(([kind, n]) => `${kind} ${n}`).join(', ')}`,
    `hero health         loses ${r.attrition.lost}% (${r.attrition.points}) a battle, ends at ${r.attrition.hp}%; ${r.attrition.worn}% of battles end under 75%; ${r.attrition.downed} fell a battle`,
    `ends at, by leg     ${r.attrition.legs.map((n) => `${n}%`).join(', ')}`,
    `losses by health   ${r.losses.sudden}% sudden (began the last battle at ${100 * SUDDEN}%+), ${r.losses.mixed}% mixed, ${r.losses.attrition}% attrition (under ${100 * WORN}%); ${r.losses.elite}% of sudden had a boss`,
    `sudden losses       ${r.losses.what}`,
    `spikes              ${r.spikes.rate}% of battles begun at ${100 * SUDDEN}%+ end under ${100 * SPIKE}% or lost: ${r.spikes.what}`,
    `hero hits           hardest ${r.hits.max}, p99 battle ${r.hits.p99}; a late boss falls in ${r.hits.bossRounds} rounds by median, ${r.hits.leastBossRounds} at least`,
    `rests a run         ${r.rests.safehouses} safehouses, ${r.rests.medkits} medkits`,
    `cards taken a run   ${Math.round(10 * r.taken.reduce((a, b) => a + b, 0)) / 10}, by leg ${r.taken.join(', ')}; deck at the end ${r.deck}`,
    ...r.warnings.map((w) => `WARN                ${w}`),
    ...r.failures.map((f) => `FAIL                ${f}`),
  ].join('\n')
}

/** Each bot's win rate on the same seeds, best first. */
export const ranked = (rates: Record<string, number>) => Object.entries(rates).sort((a, b) => b[1] - a[1]).map(([name, rate]) => `${name.padEnd(12)}${`${Math.round(100 * rate)}%`.padStart(5)}`).join('\n')

/** Battles needed before a row is read at all. */
const READ_FROM = 10
/** Wins below which a challenge is too hard; Energy a turn the bot may leave unspent with a card it could play before its play is at fault. */
const HARD = 70
const WASTE = 0.5

/** A challenge's battles on a leg: how many, won and health lost in percent, and Energy wasted a turn. */
interface Row {
  test: string
  leg: number
  battles: number
  won: number
  lost: number
  waste: number
}

/** The bot's battles by challenge, or mission kind with none, and leg. */
export function rows(results: RunResult[]): Row[] {
  const tolls = results.flatMap((r) => r.tolls)
  const keys = [...new Set(tolls.map((t) => `${t.challenge ?? t.kind}|${t.leg}`))]
  return keys
    .map((key) => {
      const [test, leg] = key.split('|')
      const of = tolls.filter((t) => (t.challenge ?? t.kind) === test && t.leg === Number(leg))
      const pct = (v: (t: Toll) => number) => Math.round((100 * of.reduce((sum, t) => sum + v(t), 0)) / of.length)
      const turns = of.reduce((sum, t) => sum + t.turns, 0)
      return { test, leg: Number(leg), battles: of.length, won: pct((t) => (t.won ? 1 : 0)), lost: pct((t) => (t.before - t.after) / t.most), waste: Math.round((10 * of.reduce((sum, t) => sum + t.wasted, 0)) / Math.max(1, turns)) / 10 }
    })
    .sort((a, b) => a.leg - b.leg || a.test.localeCompare(b.test))
}

/** The name of a challenge, or a mission kind with none. */
const nameOf = (test: string) => (test in CHALLENGES ? CHALLENGES[test as ChallengeId].name : test)

/**
 * What each row says. A challenge lost often while the bot spends its Energy is too hard: the game's fault. One where
 * the bot leaves Energy unspent with a card it could play: the bot's.
 */
export function verdicts(of: Row[]): string[] {
  const found: string[] = []
  for (const row of of) {
    const name = `${nameOf(row.test)} (leg ${row.leg + 1})`
    if (row.battles < READ_FROM) continue
    if (row.waste >= WASTE) found.push(`BOT: it leaves ${row.waste} Energy a turn unspent on ${name}, with a card it could play`)
    else if (row.won < HARD) found.push(`GAME: ${name} too hard though the bot spends its Energy: won ${row.won}% of ${row.battles}`)
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

export function formatDiagnosis(bot: string, results: RunResult[]): string {
  const of = rows(results)
  const head = `${bot}: challenge or mission, leg, battles, won%, health lost%, Energy wasted a turn`
  const lines = of.map((r) => `${nameOf(r.test).padEnd(16)}${r.leg + 1}${String(r.battles).padStart(8)}${String(r.won).padStart(6)}${String(r.lost).padStart(6)}${r.waste.toFixed(1).padStart(6)}`)
  const found = verdicts(of)
  return [head, ...lines, ...(found.length > 0 ? found : ['nothing off'])].join('\n')
}

/** Wins the strategic bot must reach for `npm run check` to pass: that good choices can win runs, not a target for balance. */
export const STRATEGIC_FLOOR = 0.15
/** Of the first leg's opening battles, the share it must win: they pace the run, not test it. */
export const OPENING_FLOOR = 0.95
