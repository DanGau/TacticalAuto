import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { bots } from '../bots/bots'
import { TUNING } from '../core/tuning'
import { winRates, type Tuning } from './pool'
import { compare, miss } from './report'

/** A balance number the climber may move: where it sits in the tuning, and its step and bounds. */
interface Knob {
  key: keyof Tuning
  index?: number
  step: number
  min: number
  max: number
}

const KNOBS: Knob[] = [
  { key: 'alienHp', step: 0.1, min: 0.5, max: 2 },
  ...[0, 1, 2, 3].map((index) => ({ key: 'legForce' as const, index, step: 1, min: 1, max: 30 })),
  { key: 'markDamage', step: 1, min: 0, max: 4 },
  { key: 'accelerantDamage', step: 1, min: 0, max: 4 },
  { key: 'shatterDamage', step: 1, min: 0, max: 5 },
  { key: 'thermalDamage', step: 1, min: 0, max: 6 },
  { key: 'impactDamage', step: 1, min: 0, max: 6 },
  { key: 'dangerSupplies', step: 1, min: 0, max: 10 },
]

/** What each tuning number does, for the comments of the file the climber writes. */
const MEANING: Record<keyof Tuning, string> = {
  alienHp: "Every alien's health, as a multiple of its kind's",
  legForce: 'The alien force a battle has in each leg, before its risk and kind are counted',
  markDamage: 'Damage each hit on a marked unit adds',
  accelerantDamage: 'Damage Accelerant Gel adds to hits on a burning target',
  shatterDamage: 'Damage Shatterglass Edge adds to hits on a chilled target',
  thermalDamage: 'Damage Thermal Shock Core adds to hits on a target both burning and chilled',
  impactDamage: "Damage drop pods deal to each alien near a soldier landing in a breach",
  dangerSupplies: 'Supplies an overrun zone pays',
}

const get = (t: Tuning, k: Knob) => (k.index === undefined ? (t[k.key] as number) : t.legForce[k.index])
const round = (n: number) => Math.round(n * 100) / 100

/** `t` with the knob moved `by`, or null where that leaves its bounds or breaks the leg force's rise. */
function moved(t: Tuning, k: Knob, by: number): Tuning | null {
  const value = round(get(t, k) + by)
  if (value < k.min || value > k.max) return null
  const next: Tuning = structuredClone(t)
  if (k.index === undefined) (next[k.key] as number) = value
  else next.legForce[k.index] = value
  return next.legForce.every((f, i) => i === 0 || f > next.legForce[i - 1]) ? next : null
}

function write(t: Tuning) {
  const lines = Object.entries(t).map(([key, value]) => `  /** ${MEANING[key as keyof Tuning]}. */\n  ${key}: ${JSON.stringify(value).replaceAll(',', ', ')},`)
  const head = '/** Balance numbers `npm run tune` climbs toward the win-rate bands in sim/report.ts. It rewrites this file. */'
  writeFileSync(new URL('../core/tuning.ts', import.meta.url), `${head}\nexport const TUNING = {\n${lines.join('\n')}\n}\n`)
}

const { values } = parseArgs({ options: { runs: { type: 'string', default: '100' }, rounds: { type: 'string', default: '10' } } })
const runs = Number(values.runs)
const names = Object.keys(bots)
const score = async (t: Tuning) => {
  const rates = await winRates(names, runs, 0, t)
  return { rates, miss: miss(rates) }
}

// Greedy hill climb: try each knob a step either way on the same seeds, and keep any move that misses the bands less.
let best = { tuning: structuredClone(TUNING) as Tuning, ...(await score(TUNING)) }
console.log(`start  miss ${round(best.miss)}`)
for (let round_ = 0; round_ < Number(values.rounds) && best.miss > 0; round_++) {
  let improved = false
  for (const knob of KNOBS) {
    for (const by of [knob.step, -knob.step]) {
      const tuning = moved(best.tuning, knob, by)
      if (!tuning) continue
      const tried = await score(tuning)
      if (tried.miss >= best.miss) continue
      best = { tuning, ...tried }
      improved = true
      write(tuning)
      console.log(`${knob.key}${knob.index === undefined ? '' : `[${knob.index}]`} → ${get(tuning, knob)}  miss ${round(best.miss)}`)
      break
    }
  }
  if (!improved) break
}
const { table, warnings } = compare(best.rates)
console.log([table, ...warnings.map((w) => `WARN ${w}`)].join('\n'))
