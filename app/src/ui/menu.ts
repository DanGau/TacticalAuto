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

/**
 * A recruit as a card to pick: its class, path and trait at a glance, its ability and skills by name. Hovering or
 * picking the card tells what they do.
 */
function card(recruit: Soldier, index: number, chosen: number | null): string {
  const cls = CLASSES[recruit.cls!]
  const path = PATHS[recruit.cls!].find((p) => p.core === recruit.skills[0])!
  const trait: Trait | null = recruit.trait ? TRAITS[recruit.trait] : null
  const quirk = trait ? `<b>${trait.name}</b><span class="down">${trait.pro}</span><span class="up">${trait.con}</span>` : '<b>Steady</b><small>No quirks</small>'
  const named = [{ name: cls.abilityName, text: cls.abilityText }, ...recruit.skills.map((id) => SKILLS[id])]
  return `<button data-recruit="${index}" class="card recruit ${index === chosen ? 'chosen' : ''}">
    <small>${cls.name} · ${path.name}</small>
    <b class="name">${recruit.name}</b>
    <span class="feats">${named.map((n, i) => `<span class="chip ${i === 0 ? 'feat' : ''}">${n.name}</span>`).join('')}<span class="more">ⓘ</span></span>
    <div class="trait">${quirk}</div>
    <span class="defs">${named.map((n) => `<span class="def"><b>${n.name}</b>${n.text}.</span>`).join('')}</span>
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
