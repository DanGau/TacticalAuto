// The power comparison: the strategic bot plays the same seeds holding each relic or gear effect from the start, and with none.
import type { GearEffect } from '../core/battle'
import { EFFECTS } from '../core/gear'
import { RELICS, type RelicId } from '../core/relics'
import type { Loadout, RunResult } from './run'

/** A loadout from its name: relic and gear effect ids joined by '+'; 'none' holds nothing. */
export function loadoutOf(name: string): Loadout {
  const ids = name === 'none' ? [] : name.split('+')
  for (const id of ids) if (!(id in RELICS) && !(id in EFFECTS)) throw new Error(`unknown relic or gear effect "${id}"`)
  const effects = ids.filter((id) => id in EFFECTS) as GearEffect[]
  if (effects.length > 1) throw new Error(`a weapon has one effect, not ${effects.join(' and ')}`)
  return { relics: ids.filter((id) => id in RELICS) as RelicId[], effect: effects[0] }
}

/** Every relic and gear effect alone, and none. */
export const SINGLES = ['none', ...Object.keys(RELICS), ...Object.keys(EFFECTS)]

const wins = (rs: RunResult[]) => rs.filter((r) => r.won).length / rs.length
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pp = (n: number) => `${n >= 0 ? '+' : ''}${(100 * n).toFixed(1)}`

/** By loadout: wins, the difference from none and its standard error over paired seeds, keys won, and health healed a battle, most first. */
export function formatPower(played: Record<string, RunResult[]>): string {
  const base = played.none
  const lines = ['loadout                 wins%   diff    ±se   keys  healed/battle  wonBattles%']
  const rows = Object.entries(played).map(([name, rs]) => {
    const diffs = rs.map((r, i) => Number(r.won) - Number(base[i].won))
    const se = Math.sqrt(mean(diffs.map((d) => (d - mean(diffs)) ** 2)) / rs.length)
    const tolls = rs.flatMap((r) => r.tolls)
    return { name, w: wins(rs), d: mean(diffs), se, keys: mean(rs.map((r) => r.keys)), healed: mean(tolls.map((t) => t.healed)), battles: tolls.filter((t) => t.won).length / tolls.length }
  })
  for (const r of rows.sort((a, b) => b.d - a.d)) lines.push(`${r.name.padEnd(22)}${(100 * r.w).toFixed(1).padStart(7)}${pp(r.d).padStart(7)}${(100 * r.se).toFixed(1).padStart(7)}${r.keys.toFixed(2).padStart(7)}${r.healed.toFixed(2).padStart(15)}${(100 * r.battles).toFixed(1).padStart(13)}`)
  const pairs = rows.filter((r) => r.name.includes('+'))
  if (pairs.length) {
    lines.push('', 'pair                    diff   a+b alone   synergy')
    const of = (name: string) => rows.find((r) => r.name === name)?.d ?? NaN
    for (const p of pairs) {
      const [a, b] = p.name.split('+')
      lines.push(`${p.name.padEnd(22)}${pp(p.d).padStart(6)}${pp(of(a) + of(b)).padStart(12)}${pp(p.d - of(a) - of(b)).padStart(10)}`)
    }
  }
  return lines.join('\n')
}
