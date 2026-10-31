// The tune command: hill-climbs tuning.ts toward the balance bands.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  ...[0, 1, 2, 3].map((index) => ({ key: 'legForce' as const, index, step: 1, min: 1, max: 60 })),
  { key: 'markDamage', step: 1, min: 0, max: 4 },
  { key: 'accelerantDamage', step: 1, min: 0, max: 4 },
  { key: 'shatterDamage', step: 1, min: 0, max: 5 },
  { key: 'thermalDamage', step: 1, min: 0, max: 6 },
  { key: 'impactDamage', step: 1, min: 0, max: 6 },
  { key: 'dangerSupplies', step: 1, min: 0, max: 10 },
  { key: 'hunt', step: 0.1, min: 0, max: 2 },
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
  hunt: 'The share of its own force the hunt adds to a battle at full threat',
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

const { values } = parseArgs({ options: { runs: { type: 'string', default: '300' }, rounds: { type: 'string', default: '10' }, threads: { type: 'string', default: '8' }, memory: { type: 'string' } } })
const runs = Number(values.runs)
let finished = false
process.on('exit', (code) => {
  if (code !== 0 || finished) return
  console.error('tune: ended before finishing; rerun to resume from .tune.json')
  process.exitCode = 1
})
const names = Object.keys(bots)
const score = async (t: Tuning, start: number) => {
  const rates = await winRates(names, runs, start, t, { threads: Number(values.threads), memoryMb: values.memory ? Number(values.memory) : undefined })
  return { rates, miss: miss(rates) }
}
/** Seeds the climb never sees, which judge where it ends. */
const HELD_OUT = 1_000_000
/** How much less a move must miss by to count, as two standard errors of a win rate near half at this many runs. */
const MARGIN = 2 * Math.sqrt(0.25 / runs)

/**
 * Progress saved after every step, so a climb that crashes resumes where it stopped. It applies only while tuning.ts
 * and the runs asked for match the ones it began with.
 */
const CHECKPOINT = new URL('../../.tune.json', import.meta.url)
interface Checkpoint {
  start: Tuning
  runs: number
  best: { tuning: Tuning; rates: Record<string, number>; miss: number }
  round: number
  knob: number
  improved: boolean
}
const saved: Checkpoint | null = existsSync(CHECKPOINT) ? JSON.parse(readFileSync(CHECKPOINT, 'utf8')) : null
const resumed = saved && saved.runs === runs && JSON.stringify(saved.start) === JSON.stringify(TUNING) ? saved : null
const save = (c: Checkpoint) => writeFileSync(CHECKPOINT, JSON.stringify(c))

// Greedy hill climb: try each knob a step either way on the same seeds, and keep a move that misses the bands by
// clearly less than chance would.
const start = structuredClone(TUNING) as Tuning
let best = resumed?.best ?? { tuning: start, ...(await score(start, 0)) }
console.log(`${resumed ? `resumed at round ${resumed.round + 1}, knob ${resumed.knob + 1}` : 'start'}  miss ${round(best.miss)}`)
for (let round_ = resumed?.round ?? 0; round_ < Number(values.rounds) && best.miss > 0; round_++) {
  let improved = round_ === resumed?.round && resumed.improved
  for (let k = round_ === resumed?.round ? resumed.knob : 0; k < KNOBS.length; k++) {
    save({ start, runs, best, round: round_, knob: k, improved })
    const knob = KNOBS[k]
    for (const by of [knob.step, -knob.step]) {
      const tuning = moved(best.tuning, knob, by)
      if (!tuning) continue
      const tried = await score(tuning, 0)
      if (tried.miss > best.miss - MARGIN) continue
      best = { tuning, ...tried }
      improved = true
      console.log(`${knob.key}${knob.index === undefined ? '' : `[${knob.index}]`} → ${get(tuning, knob)}  miss ${round(best.miss)}`)
      break
    }
  }
  if (!improved) break
}

// The climb's seeds flatter it, so the held-out seeds decide whether its tuning replaces the old.
const [before, after] = [await score(start, HELD_OUT), await score(best.tuning, HELD_OUT)]
const kept = after.miss < before.miss
if (kept) write(best.tuning)
rmSync(CHECKPOINT, { force: true })
console.log(`held-out miss ${round(before.miss)} → ${round(after.miss)}: ${kept ? 'tuning.ts rewritten' : 'tuning.ts unchanged'}`)
const { table, warnings } = compare((kept ? after : before).rates)
console.log([table, ...warnings.map((w) => `WARN ${w}`)].join('\n'))
finished = true
