// The rest comparison: at each safehouse on offer, and each shop's medkit, the run played on both ways by the strategic bot.
import { resting, squadHealth, strategic } from '../bots/strategic'
import type { Bot } from '../bots/bots'
import { apply, type Action } from '../core/apply'
import { MEDKIT } from '../core/events'
import { current, legOf, ways } from '../core/run'
import { type Run } from '../core/run-state'
import { wounded } from '../core/squad'
import { step } from '../core/step'

/** A choice played on both ways: rest (safehouse or medkit) or not, the squad's health and leg then, whether the bot rested, and which way won the run. */
export interface RestFork {
  kind: 'safehouse' | 'medkit'
  health: number
  leg: number
  took: boolean
  rested: boolean
  pressed: boolean
}

/** Fixed policies, by name: rest at every safehouse on the way when the squad's health is under the threshold. */
export const POLICIES: Record<string, Bot> = { never: resting(0), 'under 50%': resting(0.5), 'under 60%': resting(0.6), 'under 75%': resting(0.75), 'under 90%': resting(0.9), always: resting(1.01) }

function playOut(run: Run, first: Action): boolean {
  apply(run, first)
  while (run.phase !== 'won' && run.phase !== 'lost') {
    if (run.phase === 'battle' && run.battle!.phase === 'battle') step(run)
    else if (!apply(run, strategic(run, { rng: 0 })).ok) throw new Error('action rejected')
  }
  return run.phase === 'won'
}

/** The forks at this point of the run, if it offers a safehouse or a fresh shop's medkit; the run is left as it was. */
export function restForks(run: Run, took: Action): RestFork | null {
  const at = { health: squadHealth(run), leg: run.keys }
  if (run.phase === 'overworld' && !current(run)) {
    const column = legOf(run).columns[run.stop]
    const safehouse = ways(run).find((i) => column[i].stop!.kind === 'safehouse')
    if (safehouse === undefined || ways(run).length < 2) return null
    const pressed = structuredClone(run)
    return { kind: 'safehouse', ...at, took: took.type === 'go' && took.index === safehouse, rested: playOut(structuredClone(run), { type: 'go', index: safehouse }), pressed: playOut(pressed, resting(0)(pressed, { rng: 0 })) }
  }
  const shop = run.shop
  if (run.phase !== 'shop' || !shop || shop.medkit || MEDKIT.price > run.supplies || !wounded(run) || shop.wares.some((w) => w.sold) || shop.relics.some((r) => r.sold) || shop.utilities.some((u) => u.sold)) return null
  const pressed = structuredClone(run)
  pressed.shop!.medkit = true
  return { kind: 'medkit', ...at, took: took.type === 'medkit', rested: playOut(structuredClone(run), { type: 'medkit' }), pressed: playOut(pressed, strategic(pressed, { rng: 0 })) }
}

const BANDS = [0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, Infinity]
const pct = (n: number) => `${Math.round(100 * n)}`
const row = (label: string, of: RestFork[]) =>
  of.length === 0 ? `${label.padEnd(12)}     -` : `${label.padEnd(12)}${String(of.length).padStart(6)}  ${pct(of.filter((f) => f.rested).length / of.length).padStart(5)}  ${pct(of.filter((f) => f.pressed).length / of.length).padStart(5)}  ${`${(100 * (of.filter((f) => f.rested).length - of.filter((f) => f.pressed).length) / of.length).toFixed(1)}`.padStart(6)}  ${pct(of.filter((f) => f.took).length / of.length).padStart(5)}`

/** Wins in percent resting and not, and their difference, by health at the choice and by leg; with how often the bot rested. */
export function formatRest(forks: RestFork[]): string {
  const lines: string[] = []
  for (const kind of ['safehouse', 'medkit'] as const) {
    const of = forks.filter((f) => f.kind === kind)
    lines.push(`${kind}: health     forks  rest%  not%   diff   bot%`)
    let low = 0
    for (const high of BANDS) {
      lines.push(row(`<${high === Infinity ? 'all' : pct(high)}%`.replace('<all%', '≥90%'), of.filter((f) => f.health >= low && f.health < high)))
      low = high
    }
    for (const leg of [0, 1, 2, 3]) {
      for (const [label, lo, hi] of [['<50', 0, 0.5], ['50-75', 0.5, 0.75], ['>75', 0.75, Infinity]] as const) lines.push(row(`leg ${leg} ${label}`, of.filter((f) => f.leg === leg && f.health >= lo && f.health < hi)))
    }
    lines.push(row('all', of), '')
  }
  return lines.join('\n')
}
