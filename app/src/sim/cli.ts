import { parseArgs } from 'node:util'
import { bots } from '../bots/bots'
import { TUNING } from '../core/tuning'
import { winRates } from './pool'
import { runWith } from './run'
import { compare, formatReport, report } from './report'

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '100' },
    'seed-start': { type: 'string', default: '0' },
    bot: { type: 'string', default: 'standard' },
    json: { type: 'boolean', default: false },
  },
})

const start = Number(values['seed-start'])
const play = (name: string) => Array.from({ length: Number(values.runs) }, (_, i) => runWith(start + i, bots[name]))

if (values.bot === 'all') {
  // Every bot on the same seeds, against the win-rate bands.
  const { table, warnings } = compare(await winRates(Object.keys(bots), Number(values.runs), start, TUNING))
  console.log([table, ...warnings.map((w) => `WARN ${w}`)].join('\n'))
} else {
  if (!bots[values.bot]) throw new Error(`unknown bot "${values.bot}"; choose from all, ${Object.keys(bots).join(', ')}`)
  const summary = report(play(values.bot))
  console.log(values.json ? JSON.stringify(summary) : formatReport(summary))
  if (summary.failures.length > 0) process.exitCode = 1
}
