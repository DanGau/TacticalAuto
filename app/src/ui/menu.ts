import { CLASSES } from '../core/classes'
import type { Run, Soldier } from '../core/run'
import { SKILLS } from '../core/skills'
import { TRAITS, type Trait } from '../core/traits'
import { places } from './globe'

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
  return `<button class="skip" data-begin>Skip ⏭</button><div class="menu story">
    ${STORY.map((line, i) => `<p style="animation-delay: ${0.3 + i * 1.4}s">${line}</p>`).join('')}
    <button id="begin" class="decide" style="animation-delay: ${0.3 + STORY.length * 1.4}s">Choose where to begin</button>
  </div>`
}

/** A recruit as a card to pick: class, first skill, home and trait at a glance; hovering an ability or skill tells what it does. */
function card(recruit: Soldier, index: number, chosen: number | null): string {
  const cls = CLASSES[recruit.cls!]
  const trait: Trait | null = recruit.trait ? TRAITS[recruit.trait] : null
  const quirk = trait ? `<b>${trait.name}</b><span class="down">${trait.pro}</span><span class="up">${trait.con}</span>` : '<b>Steady</b><small>No quirks</small>'
  const named = [{ name: cls.abilityName, text: cls.abilityText }, ...recruit.skills.map((id) => SKILLS[id])]
  return `<button data-recruit="${index}" class="card recruit${index === chosen ? ' chosen' : ''}">
    <small>${cls.name}</small>
    <b class="name">${recruit.name}</b>
    <small class="home">🌍 ${recruit.home!.name}, ${recruit.home!.country}</small>
    <span class="feats">${named.map((n, i) => `<span class="chip ${i === 0 ? 'feat' : ''}" title="${n.text}">${n.name}</span>`).join('')}</span>
    <div class="trait">${quirk}</div>
  </button>`
}

/** The run's first choice: which recruit leads the squad, under a globe turned to the city they wait in. Tap a card to pick, again to begin. */
export function recruits(run: Run, chosen: number | null): string {
  const homes = run.recruits.map((r, i) => ({ at: r.home!.at, chosen: i === chosen, html: `<span class="home${i === chosen ? ' chosen' : ''}">${r.home!.name}</span>` }))
  return `<div class="menu picking">
    <h2>${chosen === null ? 'Who leads the squad? Each waits in a different city.' : `Tap ${run.recruits[chosen].name} again to begin in ${run.recruits[chosen].home!.name}.`}</h2>
    <div class="homes">${places({ w: 560, h: 220 }, homes)}</div>
    <div class="choices">${run.recruits.map((r, i) => card(r, i, chosen)).join('')}</div>
  </div>`
}
