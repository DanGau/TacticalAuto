// Numbers after a fight and after a run, charted: the battle's statistics page, and the post-game summary.
import { CLASSES } from '../core/classes'
import { DOCTRINES } from '../core/doctrines'
import type { Tally } from '../core/feats'
import { GOALS } from '../core/goals'
import { RELICS } from '../core/relics'
import { relicIcon } from './relic-icons'
import type { Fought, Run } from '../core/run-state'
import { SKILLS } from '../core/skills'
import { level, MAX_SQUAD } from '../core/squad'
import { UTILITIES } from '../core/utilities'
import { barCard, columns, heroColour, scale, type Column, type Mark } from './charts'
import { badge, gearName, STOP_NAMES } from './html'

const TANKED = '#9aa6bd'

type Row = { name: string; cls: Fought['soldiers'][number]['cls']; tally: Pick<Tally, 'dealt' | 'taken' | 'blocked' | 'kills' | 'healed'> }

/** Each stat charted: its name, its value, and how it reads in a tip. */
const METRICS: [string, (t: Row['tally']) => number, (t: Row['tally']) => string][] = [
  ['Damage', (t) => t.dealt, (t) => `${t.dealt} damage dealt`],
  ['Tanked', (t) => t.taken + t.blocked, (t) => `${t.taken + t.blocked} tanked: ${t.taken} to health, ${t.blocked} to armor`],
  ['Kills', (t) => t.kills, (t) => `${t.kills} kills`],
  ['Healed', (t) => t.healed, (t) => `${t.healed} healed`],
]

/** Every hero who fought in the run, what each did summed over its battles, in order of first battle. */
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

/** Each hero's colour, by first battle in the run. */
export const colours = (run: Run) => new Map(runRows(run).map((r, i) => [r.name, heroColour(i)]))

/** Each stat's marks, a hero each, its tip the exact value and share of the squad's. */
export function heroMarks(rows: Row[], colour: Map<string, string>): { title: string; marks: Mark[] }[] {
  return METRICS.map(([title, value, text]) => {
    const share = scale(rows.map((r) => value(r.tally)), 'sum')
    const marks = rows.map((r, i) => ({ label: `${badge(r.cls)} ${r.name}`, value: value(r.tally), colour: colour.get(r.name) ?? heroColour(i), tip: [r.name, text(r.tally), `${Math.round(share[i])}% of the squad's`] }))
    return { title, marks }
  })
}

const charts = (rows: Row[], colour: Map<string, string>) => `<div class="charts">${heroMarks(rows, colour).map(({ title, marks }) => barCard(title, marks)).join('')}</div>`

const foughtName = (fought: Fought) => (fought.stop === 'battle' ? GOALS[fought.goal].name : STOP_NAMES[fought.stop])

/** A battle's statistics page. */
export function battlePage(run: Run, fought: Fought): string {
  return `<div class="statpage"><h2>${foughtName(fought)} · ${fought.won ? 'won' : 'lost'} in ${fought.rounds} rounds</h2>${charts(fought.soldiers, colours(run))}<button class="decide" data-stats="">Back</button></div>`
}

/** A column per battle: each hero's damage stacked above the line, the squad's tanked below. */
export function battleColumns(run: Run): Column[] {
  const colour = colours(run)
  return run.log.map((f, i) => {
    const sum = (key: keyof Row['tally']) => f.soldiers.reduce((total, s) => total + s.tally[key], 0)
    const tanked = sum('taken') + sum('blocked')
    return {
      label: String(i + 1),
      look: f.won ? 'won' : 'lost',
      up: f.soldiers.map((s) => ({ label: s.name, value: s.tally.dealt, colour: colour.get(s.name)!, tip: [] })),
      down: tanked,
      tip: [`${i + 1}. ${foughtName(f)}: ${f.won ? 'won' : 'lost'} in ${f.rounds} rounds`, `${sum('dealt')} damage: ${f.soldiers.map((s) => `${s.name} ${s.tally.dealt}`).join(', ')}`, `${tanked} tanked, ${sum('kills')} kills, ${sum('healed')} healed`],
    }
  })
}

const legend = (colour: Map<string, string>) => `<p class="legend">${[...colour].map(([name, c]) => `<span><i style="background:${c}"></i>${name}</span>`).join('')}<span><i style="background:${TANKED}"></i>Tanked</span></p>`

const list = (name: string, items: string[]) => (items.length > 0 ? `<section><h3>${name}</h3><p>${items.join(' · ')}</p></section>` : '')

/** The victory or defeat screen: how it ended, who fought and with what, the run's totals, and each battle. */
export function runSummary(run: Run): string {
  const won = run.phase === 'won'
  const last = run.log.at(-1)
  const ended = won ? 'The source is destroyed. Earth is saved.' : 'Earth has fallen'
  const cause = won || !last ? '' : `<p>Ended by: ${foughtName(last)}, round ${last.rounds}, with ${run.soldiers.length} of ${MAX_SQUAD} heroes.</p>`
  const heroes = run.soldiers.map((hero) => `<div class="endhero"><span class="portrait">${badge(hero.cls)}</span><div><b>${hero.name}</b> <small>Level ${level(hero)}${hero.cls ? ` ${CLASSES[hero.cls].name}` : ''}</small><br>
    <small class="tier ${hero.gear?.rarity ?? ''}">${hero.gear ? `${gearName(hero.gear)}` : 'Empty hands'}</small><br>
    <small>${hero.skills.map((id) => SKILLS[id].name).join(' · ') || 'No powers'}</small></div></div>`)
  const colour = colours(run)
  return `<div class="summary">
    <h1 class="${won ? 'down' : 'up'}">${ended}</h1>${cause}
    <button id="again" class="decide">New run</button>
    <section><h3>Heroes</h3><div class="endheroes">${heroes.join('')}</div></section>
    ${list('Relics', run.relics.map((id) => `${relicIcon(id)} ${RELICS[id].name}`))}
    ${list('Oaths', run.doctrines.map((id) => DOCTRINES[id].name))}
    ${list('Boons', run.utilities.map((id) => `${UTILITIES[id].icon} ${UTILITIES[id].name}`))}
    <section><h3>Run totals · ${run.log.length} battles, ${run.log.filter((f) => f.won).length} won</h3>${charts(runRows(run), colour)}</section>
    <section><h3>Battles · damage dealt above, tanked below</h3>${legend(colour)}${columns(battleColumns(run), TANKED)}</section>
  </div>`
}
