import { parseArgs } from 'node:util'
import { bots } from '../bots/bots'
import { runWith } from './run'
import { formatReport, report } from './report'

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '100' },
    'seed-start': { type: 'string', default: '0' },
    bot: { type: 'string', default: 'standard' },
    json: { type: 'boolean', default: false },
  },
})

const bot = bots[values.bot]
if (!bot) throw new Error(`unknown bot "${values.bot}"; choose from ${Object.keys(bots).join(', ')}`)

const start = Number(values['seed-start'])
const results = Array.from({ length: Number(values.runs) }, (_, i) => runWith(start + i, bot))
const summary = report(results)
console.log(values.json ? JSON.stringify(summary) : formatReport(summary))
if (summary.failures.length > 0) process.exitCode = 1
