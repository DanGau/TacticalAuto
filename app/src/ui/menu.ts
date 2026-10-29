import { CLASSES } from '../core/classes'
import type { Run, Soldier } from '../core/run'
import { PATHS, SKILLS } from '../core/skills'
import { TRAITS, type Trait } from '../core/traits'
import { button } from './html'

/** The title screen, before a run begins. */
export function title(): string {
  return `<div class="menu">
    <h1>TacticalAuto</h1>
    <p>The aliens have come. One clone stands between them and the last cities of Earth.</p>
    <button id="start" class="decide">New run</button>
  </div>`
}

/** A recruit as a card to pick: its class and ability, its path, and its trait's strength and weakness. */
function card(recruit: Soldier, index: number, chosen: number | null): string {
  const cls = CLASSES[recruit.cls!]
  const path = PATHS[recruit.cls!].find((p) => p.core === recruit.skills[0])!
  const trait: Trait | null = recruit.trait ? TRAITS[recruit.trait] : null
  const quirk = trait
    ? `<b>${trait.name}</b><span class="down">${trait.pro}</span><span class="up">${trait.con}</span>`
    : '<b>Steady</b><small>No strengths, no weaknesses</small>'
  return `<button data-recruit="${index}" class="card recruit ${index === chosen ? 'chosen' : ''}">
    <small>${cls.name} · ${path.name}</small>
    <b class="name">${recruit.name}</b>
    <span><b>${cls.abilityName}:</b> ${cls.abilityText}.</span>
    <span><b>${SKILLS[recruit.skills[0]].name}:</b> ${SKILLS[recruit.skills[0]].text}.</span>
    <div class="trait">${quirk}</div>
  </button>`
}

/** The run's first choice: which of its recruits leads the squad, then a button to confirm. */
export function recruits(run: Run, chosen: number | null): string {
  const go = chosen === null ? '<button class="decide" disabled>Choose a recruit</button>' : button({ type: 'recruit', index: chosen }, `Deploy with ${run.recruits[chosen].name}`, 'decide')
  return `<div class="menu">
    <h2>Three clones are ready. The first to wake leads the squad.</h2>
    <div class="choices">${run.recruits.map((r, i) => card(r, i, chosen)).join('')}</div>
    ${go}
  </div>`
}
