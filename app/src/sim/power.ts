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

/** Over a loadout's Guardian fights: how many, the mean rounds from first wound to fall of those felled, and the mean share of the squad's health lost; each with its standard error. */
function guardian(rs: RunResult[]) {
  const fights = rs.flatMap((r) => r.tolls).filter((t) => t.kind === 'key' || t.kind === 'final')
  const stat = (xs: number[]) => {
    const m = mean(xs)
    return [m, Math.sqrt(mean(xs.map((x) => (x - m) ** 2)) / Math.max(1, xs.length))]
  }
  const [rounds, roundsSe] = stat(fights.flatMap((t) => (t.bossRounds === null ? [] : [t.bossRounds])))
  const [lost, lostSe] = stat(fights.map((t) => (t.before - t.after) / t.most))
  return { fights: fights.length, rounds, roundsSe, lost, lostSe }
}

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
  lines.push('', 'Guardian fights          fights   rounds    ±se   hp lost%    ±se')
  const guard = Object.fromEntries(Object.entries(played).map(([name, rs]) => [name, guardian(rs)]))
  for (const r of rows) {
    const g = guard[r.name]
    lines.push(`${r.name.padEnd(22)}${String(g.fights).padStart(8)}${g.rounds.toFixed(2).padStart(9)}${g.roundsSe.toFixed(2).padStart(7)}${(100 * g.lost).toFixed(1).padStart(11)}${(100 * g.lostSe).toFixed(1).padStart(7)}`)
  }
  const pairs = rows.filter((r) => r.name.includes('+'))
  if (pairs.length) {
    lines.push('', 'pair                    diff   a+b alone   synergy')
    const of = (name: string) => rows.find((r) => r.name === name)?.d ?? NaN
    for (const p of pairs) {
      const [a, b] = p.name.split('+')
      lines.push(`${p.name.padEnd(22)}${pp(p.d).padStart(6)}${pp(of(a) + of(b)).padStart(12)}${pp(p.d - of(a) - of(b)).padStart(10)}`)
    }
    // On Guardian fights, what each loadout saves over none: rounds to fell it, and the squad's health lost to it.
    lines.push('', 'Guardian synergy        rounds saved  a+b   synergy ±se   hp saved%  a+b   synergy ±se')
    const saved = (name: string, key: 'rounds' | 'lost') => guard.none[key] - guard[name][key]
    const se = (names: string[], key: 'roundsSe' | 'lostSe') => Math.sqrt(names.reduce((sum, n) => sum + guard[n][key] ** 2, 0))
    for (const p of pairs) {
      const [a, b] = p.name.split('+')
      const four = [p.name, a, b, 'none']
      const r = [saved(p.name, 'rounds'), saved(a, 'rounds') + saved(b, 'rounds')]
      const h = [saved(p.name, 'lost'), saved(a, 'lost') + saved(b, 'lost')]
      lines.push(`${p.name.padEnd(22)}${r[0].toFixed(2).padStart(9)}${r[1].toFixed(2).padStart(7)}${(r[0] - r[1]).toFixed(2).padStart(8)}${se(four, 'roundsSe').toFixed(2).padStart(6)}${(100 * h[0]).toFixed(1).padStart(10)}${(100 * h[1]).toFixed(1).padStart(6)}${(100 * (h[0] - h[1])).toFixed(1).padStart(8)}${(100 * se(four, 'lostSe')).toFixed(1).padStart(6)}`)
    }
  }
  return lines.join('\n')
}
