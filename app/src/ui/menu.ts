import { CLASSES } from '../core/classes'
import type { Run, Soldier } from '../core/run'
import { PATHS, SKILLS } from '../core/skills'
import { TRAITS, type Trait } from '../core/traits'
import { choices } from './globe'

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
    <button id="begin" class="decide" style="animation-delay: ${0.3 + STORY.length * 1.4}s">Choose where to begin</button>
  </div>`
}

/** The recruit who waits in a city: class, path and trait at a glance, and what its ability and skills do. */
function card(recruit: Soldier): string {
  const cls = CLASSES[recruit.cls!]
  const path = PATHS[recruit.cls!].find((p) => p.core === recruit.skills[0])!
  const trait: Trait | null = recruit.trait ? TRAITS[recruit.trait] : null
  const quirk = trait ? `<b>${trait.name}</b><span class="down">${trait.pro}</span><span class="up">${trait.con}</span>` : '<b>Steady</b><small>No quirks</small>'
  const named = [{ name: cls.abilityName, text: cls.abilityText }, ...recruit.skills.map((id) => SKILLS[id])]
  return `<div class="card recruit chosen">
    <small>${cls.name} · ${path.name}</small>
    <b class="name">${recruit.name}</b>
    <small class="home">🌍 ${recruit.home!.name}, ${recruit.home!.country}</small>
    <span class="feats">${named.map((n, i) => `<span class="chip ${i === 0 ? 'feat' : ''}">${n.name}</span>`).join('')}<span class="more">ⓘ</span></span>
    <div class="trait">${quirk}</div>
    <span class="defs">${named.map((n) => `<span class="def"><b>${n.name}</b>${n.text}.</span>`).join('')}</span>
  </div>`
}

/** The run's first choice: the city it begins in, on the globe, and with it the recruit who waits there to lead. Tap a city to meet them, again to begin. */
export function recruits(run: Run, chosen: number | null): string {
  const cities = run.recruits.map((r, i) => ({
    at: r.home!.at,
    chosen: i === chosen,
    html: `<button class="option${i === chosen ? ' picked' : ''}" data-recruit="${i}"><span class="node key">🌍</span><b class="label">${r.home!.name}</b></button>`,
  }))
  return `<div class="menu">
    <h2>${chosen === null ? 'Where does the fight begin? A soldier waits in each city.' : `${run.recruits[chosen].home!.name}, ${run.recruits[chosen].home!.country}. Tap it again to begin here.`}</h2>
    <div class="start"><div class="map">${choices(cities)}</div>${chosen === null ? '' : card(run.recruits[chosen])}</div>
  </div>`
}
