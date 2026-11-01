// Numbers after a fight and after a run: the battle's statistics page, and the post-game summary.
import { CLASSES } from '../core/classes'
import { DOCTRINES } from '../core/doctrines'
import type { Tally } from '../core/feats'
import { GOALS } from '../core/goals'
import { RELICS } from '../core/relics'
import type { Fought, Run } from '../core/run-state'
import { SKILLS } from '../core/skills'
import { level, MAX_SQUAD } from '../core/squad'
import { UTILITIES } from '../core/utilities'
import { badge, gearType, STOP_NAMES } from './html'

type Row = { name: string; cls: Fought['soldiers'][number]['cls']; tally: Pick<Tally, 'dealt' | 'taken' | 'blocked' | 'kills' | 'healed'> }

const COLUMNS: [string, (t: Row['tally']) => number][] = [
  ['Damage', (t) => t.dealt],
  ['Tanked', (t) => t.taken + t.blocked],
  ['Kills', (t) => t.kills],
  ['Healed', (t) => t.healed],
]

/** A row per hero and the squad's total, the best in each column marked. */
function table(rows: Row[]): string {
  const best = COLUMNS.map(([, value]) => Math.max(1, ...rows.map((r) => value(r.tally))))
  const row = (r: Row) => `<tr><td><span class="portrait">${badge(r.cls)}</span>${r.name}</td>${COLUMNS.map(([, value], i) => `<td class="${value(r.tally) === best[i] ? 'best' : ''}">${value(r.tally)}</td>`).join('')}</tr>`
  const total = `<tr class="total"><td>Squad</td>${COLUMNS.map(([, value]) => `<td>${rows.reduce((sum, r) => sum + value(r.tally), 0)}</td>`).join('')}</tr>`
  return `<table class="tally"><tr><th></th>${COLUMNS.map(([name]) => `<th>${name}</th>`).join('')}</tr>${rows.map(row).join('')}${total}</table>`
}

const foughtName = (fought: Fought) => (fought.stop === 'battle' ? GOALS[fought.goal].name : STOP_NAMES[fought.stop])

/** A battle's statistics page. */
export function battlePage(fought: Fought): string {
  return `<div class="statpage"><h2>${foughtName(fought)} · ${fought.won ? 'won' : 'lost'} in ${fought.rounds} rounds</h2>${table(fought.soldiers)}<button class="decide" data-stats="">Back</button></div>`
}

/** Every hero who fought in the run, what each did summed over its battles. */
function runRows(run: Run): Row[] {
  const rows = new Map<string, Row>()
  for (const { soldiers } of run.log)
    for (const s of soldiers) {
      const row = rows.get(s.name) ?? { name: s.name, cls: s.cls, tally: { dealt: 0, taken: 0, blocked: 0, kills: 0, healed: 0 } }
      for (const key of ['dealt', 'taken', 'blocked', 'kills', 'healed'] as const) row.tally[key] += s.tally[key]
      rows.set(s.name, row)
    }
  return [...rows.values()]
}

const list = (name: string, items: string[]) => (items.length > 0 ? `<section><h3>${name}</h3><p>${items.join(' · ')}</p></section>` : '')

/** The victory or defeat screen: how it ended, who fought and with what, each battle, and the run's totals. */
export function runSummary(run: Run): string {
  const won = run.phase === 'won'
  const last = run.log.at(-1)
  const ended = won ? 'The source is destroyed. Earth is saved.' : 'Earth has fallen'
  const cause = won || !last ? '' : `<p>Ended by: ${foughtName(last)}, round ${last.rounds}, with ${run.soldiers.length} of ${MAX_SQUAD} heroes.</p>`
  const heroes = run.soldiers.map((hero) => `<div class="endhero"><span class="portrait">${badge(hero.cls)}</span><div><b>${hero.name}</b> <small>Level ${level(hero)}${hero.cls ? ` ${CLASSES[hero.cls].name}` : ''}</small><br>
    <small class="tier ${hero.gear?.rarity ?? ''}">${hero.gear ? `${hero.gear.name} · ${gearType(hero.gear)}` : 'Empty hands'}</small><br>
    <small>${hero.skills.map((id) => SKILLS[id].name).join(' · ') || 'No powers'}</small></div></div>`)
  const battles = run.log.map((f, i) => `<li class="${f.won ? 'down' : 'up'}">${i + 1}. ${foughtName(f)} <small>${f.won ? 'won' : 'lost'}, ${f.rounds} rounds, ${f.soldiers.reduce((sum, s) => sum + s.tally.dealt, 0)} damage</small></li>`)
  return `<div class="summary">
    <h1 class="${won ? 'down' : 'up'}">${ended}</h1>${cause}
    <button id="again" class="decide">New run</button>
    <section><h3>Heroes</h3><div class="endheroes">${heroes.join('')}</div></section>
    ${list('Relics', run.relics.map((id) => RELICS[id].name))}
    ${list('Oaths', run.doctrines.map((id) => DOCTRINES[id].name))}
    ${list('Boons', run.utilities.map((id) => `${UTILITIES[id].icon} ${UTILITIES[id].name}`))}
    <section><h3>Run totals · ${run.log.length} battles, ${run.log.filter((f) => f.won).length} won</h3>${table(runRows(run))}</section>
    <section><h3>Battles</h3><ol class="endbattles">${battles.join('')}</ol></section>
  </div>`
}
