import { parseArgs } from 'node:util'
import { bots } from '../bots/bots'
import { DOCTRINES, type DoctrineId } from '../core/doctrines'
import { TUNING } from '../core/tuning'
import { playAll, winRates } from './pool'
import { compare, formatReport, report } from './report'

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '100' },
    'seed-start': { type: 'string', default: '0' },
    bot: { type: 'string', default: 'standard' },
    /** Doctrines, comma-separated, the squad holds from the start of every run. */
    doctrine: { type: 'string', default: '' },
    json: { type: 'boolean', default: false },
  },
})

const start = Number(values['seed-start'])
const doctrines = values.doctrine.split(',').filter(Boolean) as DoctrineId[]
for (const id of doctrines) if (!(id in DOCTRINES)) throw new Error(`unknown doctrine "${id}"; choose from ${Object.keys(DOCTRINES).join(', ')}`)

if (values.bot === 'all') {
  // Every bot on the same seeds, against the win-rate bands.
  const { table, warnings } = compare(await winRates(Object.keys(bots), Number(values.runs), start, TUNING, { doctrines }))
  console.log([table, ...warnings.map((w) => `WARN ${w}`)].join('\n'))
} else {
  if (!bots[values.bot]) throw new Error(`unknown bot "${values.bot}"; choose from all, ${Object.keys(bots).join(', ')}`)
  const summary = report((await playAll([values.bot], Number(values.runs), start, TUNING, { doctrines }))[values.bot])
  console.log(values.json ? JSON.stringify(summary) : formatReport(summary))
  if (summary.failures.length > 0) process.exitCode = 1
}
