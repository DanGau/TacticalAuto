// The sim command: plays runs with bots and prints a report.
import { parseArgs } from 'node:util'
import { bots } from '../bots/bots'
import { DOCTRINES, type DoctrineId } from '../core/doctrines'
import { formatForks, formatMatrix } from './forks'
import { playAll } from './pool'
import { formatRest, POLICIES } from './rest'
import { byBattle, byGoal, formatDiagnosis, formatReport, ranked, report, rows, OPENING_FLOOR, STRATEGIC_FLOOR, BOSS_ROUNDS_FLOOR, HIT_CEILING } from './report'
import { OPENING } from '../core/progress'

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '100' },
    'seed-start': { type: 'string', default: '0' },
    bot: { type: 'string', default: 'standard' },
    /** Doctrines, comma-separated, the squad holds from the start of every run. */
    doctrine: { type: 'string', default: '' },
    /** Print battles by challenge and answer, and whose fault what is off is. */
    diagnose: { type: 'boolean', default: false },
    /** Print the clean comparison: each deploy screen played on with every utility and with none. */
    clean: { type: 'boolean', default: false },
    /** Print the rest comparison: each safehouse and medkit on offer played on both ways, and fixed rest policies on the same seeds. */
    rest: { type: 'boolean', default: false },
    /** Fail if the strategic bot wins fewer runs than STRATEGIC_FLOOR or fewer opening battles than OPENING_FLOOR, a late boss falls faster than BOSS_ROUNDS_FLOOR, or a hit passes HIT_CEILING. */
    floor: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    /** Most sim processes at once; by default one fewer than the cores. */
    workers: { type: 'string' },
  },
})

const runs = Number(values.runs)
const threads = values.workers ? Number(values.workers) : undefined
const start = Number(values['seed-start'])
const doctrines = values.doctrine.split(',').filter(Boolean) as DoctrineId[]
for (const id of doctrines) if (!(id in DOCTRINES)) throw new Error(`unknown doctrine "${id}"; choose from ${Object.keys(DOCTRINES).join(', ')}`)

if (values.rest) {
  const forks = (await playAll(['strategic'], runs, start, { doctrines, rests: true, threads })).strategic
  console.log(formatRest(forks.flatMap((r) => r.restForks)))
  const played = { strategic: forks, ...(await playAll(Object.keys(POLICIES), runs, start, { doctrines, threads })) }
  console.log('policy       wins%  safehouses  medkits')
  for (const [name, results] of Object.entries(played)) {
    const mean = (f: (r: (typeof forks)[number]) => number) => (results.reduce((sum, r) => sum + f(r), 0) / runs).toFixed(1).padStart(10)
    console.log(`${name.padEnd(12)}${String(Math.round((100 * results.filter((r) => r.won).length) / runs)).padStart(5)}  ${mean((r) => r.rests.safehouses)}  ${mean((r) => r.rests.medkits)}`)
  }
} else if (values.bot === 'all') {
  // Every bot on the same seeds.
  const names = Object.keys(bots)
  const played = await playAll(names, runs, start, { doctrines, threads })
  console.log(ranked(Object.fromEntries(names.map((bot) => [bot, played[bot].filter((r) => r.won).length / runs]))))
  if (values.diagnose) for (const bot of ['standard', 'strategic']) console.log(`\n${formatDiagnosis(bot, rows(played[bot]))}`)
} else {
  if (!bots[values.bot]) throw new Error(`unknown bot "${values.bot}"; choose from all, ${Object.keys(bots).join(', ')}`)
  const results = (await playAll([values.bot], runs, start, { doctrines, forks: values.clean, threads }))[values.bot]
  const summary = report(results)
  if (values.floor && summary.wins / summary.runs < STRATEGIC_FLOOR) summary.failures.push(`the strategic bot won ${summary.wins} of ${summary.runs}, under its floor of ${Math.round(100 * STRATEGIC_FLOOR)}%: the game has become unwinnable, or the bot has broken`)
  const opening = results.flatMap((r) => r.tolls.filter((t) => t.nth <= OPENING))
  const openingWon = opening.filter((t) => t.won).length / opening.length
  if (values.floor && openingWon < OPENING_FLOOR) summary.failures.push(`the strategic bot won ${Math.round(100 * openingWon)}% of the first ${OPENING} battles, under their floor of ${Math.round(100 * OPENING_FLOOR)}%: the opening is too hard`)
  if (values.floor && summary.hits.bossRounds < BOSS_ROUNDS_FLOOR) summary.failures.push(`a late boss falls in ${summary.hits.bossRounds} rounds by median, under the floor of ${BOSS_ROUNDS_FLOOR}: heroes hit too hard for bosses`)
  if (values.floor && summary.hits.max > HIT_CEILING) summary.failures.push(`a hero hit for ${summary.hits.max}, over the ceiling of ${HIT_CEILING}: bonuses stack too high`)
  console.log(values.json ? JSON.stringify(summary) : formatReport(summary))
  if (values.diagnose) console.log(`\nby battle:\n${byBattle(results)}\nby goal: ${byGoal(results)}\n${formatDiagnosis(values.bot, rows(results))}`)
  if (values.clean) console.log(`\n${formatForks(results.flatMap((r) => r.forks))}\n\n${formatMatrix(results.flatMap((r) => r.forks))}`)
  if (summary.failures.length > 0) process.exitCode = 1
}
