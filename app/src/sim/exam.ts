// The exam lab: a fixed squad holding each loadout fights each Guardian exam and a late elite, on many seeds, and prints rounds to fell it, health lost, and each combo's synergy.
import { parseArgs } from 'node:util'
import { arena } from '../core/arena'
import { BASE_STATS, isSoldier, type Battle, type Effect, type Stats, type Unit } from '../core/battle'
import { stepBattle } from '../core/combat'
import { EXAMS, type Exam } from '../core/exams'
import { RELICS } from '../core/relics'
import { WEAPONS, type WeaponId } from '../core/weapons'
import { loadoutOf } from './power'

const { values } = parseArgs({ options: { seeds: { type: 'string', default: '100' }, loadouts: { type: 'string', default: '' }, escorts: { type: 'string', default: '12' } } })

/** The squad every loadout is fought with: one of each kind of weapon reach, at a late leg's strength. */
const SQUAD: { weapon: WeaponId; x: number; y: number }[] = [
  { weapon: 'rifle', x: 10, y: 10 },
  { weapon: 'smg', x: 10, y: 12 },
  { weapon: 'shotgun', x: 10, y: 14 },
]

/** The foes fought: each Guardian exam, and a late elite with none. Each stands with two escorts. */
const FIGHTS: (Exam | 'elite')[] = [...(Object.keys(EXAMS) as Exam[]), 'elite']

/** The boss's health and damage, and an escort's: tough enough to last the rounds a Guardian fight does. */
const BOSS = { hp: 220, damage: 3 }
/** `--escorts` sets an escort's health: tough ones leave overkill to carry. */
const ESCORT = { hp: Number(values.escorts), damage: 2 }

/** Rounds a fight may last before it counts as a stall. */
const MOST_ROUNDS = 30

/** The template battle, staged once and cloned for each fight. */
const template = arena([], [{ x: 16, y: 12 }, { x: 16, y: 10 }, { x: 16, y: 14 }])

/** One fight: rounds from the start until the boss falls, MOST_ROUNDS if it stands, and the share of the squad's health lost. */
function fight(seed: number, foe: Exam | 'elite', { effects, stats }: Kit): { rounds: number; lost: number } {
  const battle: Battle = structuredClone(template.battle)
  battle.rng = seed * 7919 + FIGHTS.indexOf(foe)
  const [hero, boss, ...escorts] = battle.units
  const heroes: Unit[] = SQUAD.map((s, i) => ({ ...structuredClone(hero), id: 1 + i, soldier: hero.soldier! + i, x: s.x, y: s.y, weapon: s.weapon, effects: [...effects, ...(WEAPONS[s.weapon].effect ? [WEAPONS[s.weapon].effect!] : [])], stance: WEAPONS[s.weapon].stance ?? 'balanced', ...withStats({ ...BASE_STATS, hp: 30, armor: 1, damage: 5, crit: 0.25, move: 4, range: 6 }, stats) }))
  Object.assign(boss, { boss: true, effects: foe === 'elite' ? [] : [foe], hp: BOSS.hp, stats: { ...boss.stats, hp: BOSS.hp, damage: foe === 'elite' ? BOSS.damage + 1 : BOSS.damage, move: 3, range: 5 } })
  for (const e of escorts) Object.assign(e, { hp: ESCORT.hp, stats: { ...e.stats, hp: ESCORT.hp, damage: ESCORT.damage, move: 3, range: 5 } })
  battle.units = [...heroes, boss, ...escorts]
  const most = heroes.reduce((sum, h) => sum + h.hp, 0)
  while (battle.phase === 'battle' && boss.hp > 0 && battle.round < MOST_ROUNDS && heroes.some((h) => h.hp > 0)) stepBattle(battle)
  const left = battle.units.filter(isSoldier).reduce((sum, h) => sum + Math.max(0, h.hp), 0)
  return { rounds: boss.hp > 0 ? MOST_ROUNDS : battle.round, lost: (most - left) / most }
}

/** What a loadout gives every hero: its relics' effects and stats, and its gear effect. */
interface Kit {
  effects: Effect[]
  stats: Partial<Stats>[]
}
const kitOf = (name: string): Kit => {
  const { relics = [], effect } = loadoutOf(name)
  return { effects: [...relics.flatMap((id) => RELICS[id].effect ?? []), ...(effect ? [effect] : [])], stats: relics.flatMap((id) => RELICS[id].stats ?? []) }
}

/** A hero's health, armor and stats with `more` added. */
function withStats(base: Stats, more: Partial<Stats>[]): { hp: number; armor: number; stats: Stats } {
  const stats = { ...base }
  for (const m of more) for (const [k, v] of Object.entries(m) as [keyof Stats, number][]) stats[k] += v
  return { hp: stats.hp, armor: stats.armor, stats }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const se = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)) / xs.length)

/** A loadout's halves for its synergy: all but the last id together, and the last. */
const halves = (name: string) => [name.slice(0, name.lastIndexOf('+')), name.slice(name.lastIndexOf('+') + 1)]

const asked = values.loadouts.split(',').filter(Boolean)
const names = [...new Set(['none', ...asked.flatMap((n) => n.split('+').flatMap((id, i, ids) => [id, ids.slice(0, i + 1).join('+')])), ...asked])]
const seeds = Number(values.seeds)
/** Each loadout's rounds and health lost, fight by fight in the same order, so loadouts pair on seed and foe. */
const played: Record<string, { rounds: number[]; lost: number[] }> = {}
for (const name of names) {
  const kit = kitOf(name)
  const rs = Array.from({ length: seeds }, (_, s) => FIGHTS.map((foe) => fight(s + 1, foe, kit))).flat()
  played[name] = { rounds: rs.map((r) => r.rounds), lost: rs.map((r) => r.lost) }
}
console.log('loadout                         rounds   ±se  hp lost%  felled%')
for (const name of names) console.log(`${name.padEnd(30)}${mean(played[name].rounds).toFixed(2).padStart(8)}${se(played[name].rounds).toFixed(2).padStart(6)}${(100 * mean(played[name].lost)).toFixed(1).padStart(9)}${(100 * mean(played[name].rounds.map((r) => (r < MOST_ROUNDS ? 1 : 0)))).toFixed(0).padStart(9)}`)
console.log(`\nrounds by foe: ${FIGHTS.join(', ')}`)
for (const name of names) console.log(`${name.padEnd(30)}${FIGHTS.map((_, f) => mean(played[name].rounds.filter((_, i) => i % FIGHTS.length === f)).toFixed(1).padStart(7)).join('')}`)
console.log('\nsynergy: rounds saved beyond the halves, and health saved, each ± se over paired fights')
for (const name of names.filter((n) => n.includes('+'))) {
  const [a, b] = halves(name)
  const syn = (key: 'rounds' | 'lost') => played.none[key].map((n, i) => n - played[name][key][i] - (n - played[a][key][i]) - (n - played[b][key][i]))
  const r = syn('rounds')
  const h = syn('lost')
  console.log(`${name.padEnd(30)}${mean(r).toFixed(2).padStart(8)} ± ${se(r).toFixed(2)}${(100 * mean(h)).toFixed(1).padStart(9)} ± ${(100 * se(h)).toFixed(1)}`)
}
