// Numbers after a fight and after a run, charted: the battle's statistics page, and the post-game summary.
import { CLASSES } from '../core/classes'
import { DOCTRINES } from '../core/doctrines'
import type { Tally } from '../core/feats'
import { GOALS } from '../core/goals'
import { RELICS } from '../core/relics'
import { relicIcon } from './relic-icons'
import { skillIcon } from './skill-icons'
import type { Fought, Run } from '../core/run-state'
import { SKILLS } from '../core/skills'
import { level } from '../core/hero'
import { boonName } from '../core/utilities'
import { boonIcon } from './boon-icons'
import { barCard, columns, heroColour, type Column, type Mark } from './charts'
import { badge, gearName, STOP_NAMES } from './html'

const TANKED = '#9aa6bd'

type Row = { name: string; cls: Run['hero']['cls']; tally: Pick<Tally, 'dealt' | 'taken' | 'blocked' | 'kills' | 'healed'> }

/** Each stat charted: its name, its value, and how it reads in a tip. */
const METRICS: [string, (t: Row['tally']) => number, (t: Row['tally']) => string][] = [
  ['Damage', (t) => t.dealt, (t) => `${t.dealt} damage dealt`],
  ['Tanked', (t) => t.taken + t.blocked, (t) => `${t.taken + t.blocked} tanked: ${t.taken} to health, ${t.blocked} to Armor`],
  ['Kills', (t) => t.kills, (t) => `${t.kills} kills`],
  ['Healed', (t) => t.healed, (t) => `${t.healed} healed`],
]

/** What the hero did over the run, summed over its battles. */
function runRow(run: Run): Row {
  const tally = { dealt: 0, taken: 0, blocked: 0, kills: 0, healed: 0 }
  for (const f of run.log) for (const key of Object.keys(tally) as (keyof Row['tally'])[]) tally[key] += f.tally[key]
  return { name: run.hero.name, cls: run.hero.cls, tally }
}

/** The hero's colour in every chart. */
const COLOUR = heroColour(0)

/** Each stat's mark, its tip the exact value. */
export function heroMarks(row: Row): { title: string; marks: Mark[] }[] {
  return METRICS.map(([title, value, text]) => ({ title, marks: [{ label: `${badge(row.cls)} ${row.name}`, value: value(row.tally), colour: COLOUR, tip: [row.name, text(row.tally)] }] }))
}

const charts = (row: Row) => `<div class="charts">${heroMarks(row).map(({ title, marks }) => barCard(title, marks)).join('')}</div>`

const foughtName = (fought: Fought) => (fought.stop === 'battle' ? GOALS[fought.goal].name : STOP_NAMES[fought.stop])

/** A battle's statistics page. */
export function battlePage(run: Run, fought: Fought): string {
  return `<div class="statpage"><h2>${foughtName(fought)} · ${fought.won ? 'won' : 'lost'} in ${fought.rounds} rounds</h2>${charts({ name: run.hero.name, cls: run.hero.cls, tally: fought.tally })}<button class="decide" data-stats="">Back</button></div>`
}

/** A column per battle: the hero's damage above the line, what it tanked below. */
export function battleColumns(run: Run): Column[] {
  return run.log.map((f, i) => {
    const t = f.tally
    const tanked = t.taken + t.blocked
    return {
      label: String(i + 1),
      look: f.won ? 'won' : 'lost',
      up: [{ label: run.hero.name, value: t.dealt, colour: COLOUR, tip: [] }],
      down: tanked,
      tip: [`${i + 1}. ${foughtName(f)}: ${f.won ? 'won' : 'lost'} in ${f.rounds} rounds`, `${t.dealt} damage`, `${tanked} tanked, ${t.kills} kills, ${t.healed} healed`],
    }
  })
}

const legend = (name: string) => `<p class="legend"><span><i style="background:${COLOUR}"></i>${name}</span><span><i style="background:${TANKED}"></i>Tanked</span></p>`

const list = (name: string, items: string[]) => (items.length > 0 ? `<section><h3>${name}</h3><p>${items.join(' · ')}</p></section>` : '')

/** The victory or defeat screen: how it ended, the hero and what it fought with, the run's totals, and each battle. */
export function runSummary(run: Run): string {
  const won = run.phase === 'won'
  const last = run.log.at(-1)
  const ended = won ? 'The source is destroyed. Earth is saved.' : 'Earth has fallen.'
  const cause = won || !last ? '' : `<p>Ended by: ${foughtName(last)}, round ${last.rounds}.</p>`
  const hero = run.hero
  const card = `<div class="endhero"><span class="portrait">${badge(hero.cls)}</span><div><b>${hero.name}</b> <small>Level ${level(hero)}${hero.cls ? ` ${CLASSES[hero.cls].name}` : ''}</small><br>
    <small class="tier ${hero.gear?.rarity ?? ''}">${hero.gear ? `${gearName(hero.gear)}` : 'Empty hands'}</small><br>
    <small>${hero.skills.map((id) => `${skillIcon(id)} ${SKILLS[id].name}`).join(' · ') || 'No powers'}</small></div></div>`
  return `<div class="summary">
    <h1 class="${won ? 'down' : 'up'}">${ended}</h1>${cause}
    <button id="again" class="decide">New run</button>
    <section><h3>Hero</h3><div class="endheroes">${card}</div></section>
    ${list('Relics', run.relics.map((id) => `${relicIcon(id)} ${RELICS[id].name}`))}
    ${list('Oaths', run.doctrines.map((id) => DOCTRINES[id].name))}
    ${list('Boons', run.utilities.map((h) => `${boonIcon(h.id)} ${boonName(h.id, h.level)}`))}
    <section><h3>Run totals · ${run.log.length} battles, ${run.log.filter((f) => f.won).length} won</h3>${charts(runRow(run))}</section>
    <section><h3>Battles · damage dealt above, tanked below</h3>${legend(hero.name)}${columns(battleColumns(run), TANKED)}</section>
  </div>`
}
