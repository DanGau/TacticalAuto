import { CLASSES } from '../core/classes'
import type { Run, Soldier } from '../core/run'
import { PATHS, SKILLS } from '../core/skills'
import { TRAITS, type Trait } from '../core/traits'
import { button } from './html'

/** The title screen, before a run begins. */
export function title(): string {
  return `<div class="menu">
    <h1>TacticalAuto</h1>
    <p>Gather the world's last heroes. Raid the alien hub.</p>
    <button id="start" class="decide">New run</button>
  </div>`
}

/** The story so far, line by line, before the run's first choice. */
const STORY = [
  'Three years ago they came down at the South Pole. Their hub lies under the Antarctic ice, and every month it reaches farther.',
  'No army has got near it. A squad might: the best soldiers left alive, scattered across the world.',
  'Cross the globe to find them, one continent at a time. Each you reach joins you. Lose one, and it is over.',
  'The aliens will notice. Every stop you make, they hunt you harder.',
]

/** The story told in lines that fade in one after another, then a button on to the first choice. */
export function story(): string {
  return `<div class="menu story">
    ${STORY.map((line, i) => `<p style="animation-delay: ${0.3 + i * 1.4}s">${line}</p>`).join('')}
    <button id="begin" class="decide" style="animation-delay: ${0.3 + STORY.length * 1.4}s">Choose who leads</button>
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
    <small class="home">🌍 ${recruit.home!.name}, ${recruit.home!.country}</small>
    <span class="feats">${named.map((n, i) => `<span class="chip ${i === 0 ? 'feat' : ''}">${n.name}</span>`).join('')}<span class="more">ⓘ</span></span>
    <div class="trait">${quirk}</div>
    <span class="defs">${named.map((n) => `<span class="def"><b>${n.name}</b>${n.text}.</span>`).join('')}</span>
  </button>`
}

/** The run's first choice: which of its recruits leads the squad, then a button to confirm. */
export function recruits(run: Run, chosen: number | null): string {
  const go = chosen === null ? '<button class="decide" disabled>Choose a recruit</button>' : button({ type: 'recruit', index: chosen }, `Deploy with ${run.recruits[chosen].name}`, 'decide')
  return `<div class="menu">
    <h2>Who leads the squad? Each starts somewhere else in the world.</h2>
    <div class="choices">${run.recruits.map((r, i) => card(r, i, chosen)).join('')}</div>
    ${go}
  </div>`
}
