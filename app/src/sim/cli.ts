// The sim command: plays runs with bots and prints a report.
import { parseArgs } from 'node:util'
import { bots } from '../bots/bots'
import { DOCTRINES, type DoctrineId } from '../core/doctrines'
import { playAll } from './pool'
import { byGoal, formatDiagnosis, formatReport, ranked, report, rows, STRATEGIC_FLOOR } from './report'

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '100' },
    'seed-start': { type: 'string', default: '0' },
    bot: { type: 'string', default: 'standard' },
    /** Doctrines, comma-separated, the squad holds from the start of every run. */
    doctrine: { type: 'string', default: '' },
    /** Print battles by challenge and answer, and whose fault what is off is. */
    diagnose: { type: 'boolean', default: false },
    /** Fail if the strategic bot wins fewer runs than STRATEGIC_FLOOR. */
    floor: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
})

const runs = Number(values.runs)
const start = Number(values['seed-start'])
const doctrines = values.doctrine.split(',').filter(Boolean) as DoctrineId[]
for (const id of doctrines) if (!(id in DOCTRINES)) throw new Error(`unknown doctrine "${id}"; choose from ${Object.keys(DOCTRINES).join(', ')}`)

if (values.bot === 'all') {
  // Every bot on the same seeds.
  const names = Object.keys(bots)
  const played = await playAll(names, runs, start, { doctrines })
  console.log(ranked(Object.fromEntries(names.map((bot) => [bot, played[bot].filter((r) => r.won).length / runs]))))
  if (values.diagnose) for (const bot of ['standard', 'strategic']) console.log(`\n${formatDiagnosis(bot, rows(played[bot]))}`)
} else {
  if (!bots[values.bot]) throw new Error(`unknown bot "${values.bot}"; choose from all, ${Object.keys(bots).join(', ')}`)
  const results = (await playAll([values.bot], runs, start, { doctrines }))[values.bot]
  const summary = report(results)
  if (values.floor && summary.wins / summary.runs < STRATEGIC_FLOOR) summary.failures.push(`the strategic bot won ${summary.wins} of ${summary.runs}, under its floor of ${Math.round(100 * STRATEGIC_FLOOR)}%: the game has become unwinnable, or the bot has broken`)
  console.log(values.json ? JSON.stringify(summary) : formatReport(summary))
  if (values.diagnose) console.log(`\nby goal: ${byGoal(results)}\n${formatDiagnosis(values.bot, rows(results))}`)
  if (summary.failures.length > 0) process.exitCode = 1
}
