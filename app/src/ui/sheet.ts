// Character sheets and stat blocks: a hero's or alien's numbers, weapon and powers, told one way everywhere.
import { ALIENS, type AlienKind } from '../core/aliens'
import type { Stats } from '../core/battle'
import { classPower, CLASSES } from '../core/classes'
import type { Keyword } from '../core/keywords'
import { usage, type Power } from '../core/powers'
import type { Run, Soldier } from '../core/run-state'
import { secondaryOf, charges, health, level, soldierStats, weaponOf } from '../core/squad'
import { secondaryPower, SECONDARIES } from '../core/secondaries'
import { SKILLS } from '../core/skills'
import { weaponText } from '../core/weapons'
import { describe, resistChip } from './html'

/** A row of named numbers. */
export const statBlock = (cells: [string, string | number][]) => `<div class="statblock">${cells.map(([name, value]) => `<span><small>${name}</small><b>${value}</b></span>`).join('')}</div>`

/** A power in full: its name, usage line and effect. */
export const powerBlock = (power: Power, tags?: Keyword[], held?: Keyword[]) => `<div class="power described"><b>${power.name}</b> <small class="use">${usage(power)}</small><div>${describe(power.text, tags, held)}</div></div>`

/** A power in brief, for a card: its name and when it works. */
const powerChip = (power: Power) => `<span class="chip">${power.name} <small class="use">${power.use}</small></span>`

/** A hero's numbers. */
const heroStats = (run: Run, hero: Soldier) => {
  const stats = soldierStats(run, hero)
  return statBlock([['HP', `${health(run, hero)}/${stats.hp}`], ['Armor', stats.armor], ['Move', stats.move], ['Damage', stats.damage], ['Range', stats.range], ['Crit', `${Math.round(100 * stats.crit)}%`]])
}

/** What a hero's weapon does, with its damage worked out. */
const kit = (run: Run, hero: Soldier) => {
  const weapon = weaponOf(hero)
  return weapon ? weaponText(weapon, soldierStats(run, hero).damage) : 'Bare hands'
}

/** A hero's powers: its class's, its bonus attack, then those it learned. */
const powers = (run: Run, hero: Soldier): (Power & { tags?: Keyword[] })[] => [
  ...(hero.cls ? [classPower(CLASSES[hero.cls], charges(run, hero))] : []),
  secondaryPower(SECONDARIES[secondaryOf(hero)]),
  ...hero.skills.map((id) => SKILLS[id]),
]

/** Class and level, as a sheet heads them. */
const heading = (hero: Soldier) => `Level ${level(hero)}${hero.cls ? ` ${CLASSES[hero.cls].name}` : ''}`

/** A hero as a card: name, class and level, numbers, weapon and kit, and its powers by name. */
export const heroCard = (run: Run, hero: Soldier) => `<small>${heading(hero)}</small>
  <b class="name">${hero.name}</b>
  ${heroStats(run, hero)}
  <div class="weapon"><b>${hero.gear?.name ?? 'Empty hands'}</b><small>${kit(run, hero)}</small></div>
  <span class="feats">${powers(run, hero).map(powerChip).join('')}</span>`

/** A hero's powers in full. */
export const powerList = (run: Run, hero: Soldier, held?: Keyword[]) => `<div class="powers">${powers(run, hero).map((p) => powerBlock(p, p.tags, held)).join('')}</div>`

/** A hero's whole sheet: numbers, weapon and kit, how it fights, and its powers in full. */
export function heroSheet(run: Run, hero: Soldier): string {
  const stance = hero.cls && !weaponOf(hero)?.stance ? `<small>${CLASSES[hero.cls].stanceText}.</small>` : ''
  return `<div class="charsheet"><small>${heading(hero)}</small>${heroStats(run, hero)}
    <div class="weapon"><b>${hero.gear?.name ?? 'Empty hands'}</b><small>${kit(run, hero)}.</small></div>${stance}
    ${powerList(run, hero)}</div>`
}

/** An alien's stat block: name, numbers, what it does, what it resists. */
export const alienBlock = (kind: AlienKind, stats: Stats, hp = stats.hp) => `<div class="charsheet alien"><b class="name">${ALIENS[kind].name}</b> ${ALIENS[kind].resists.map(resistChip).join('')}
  ${statBlock([['HP', hp], ['Armor', stats.armor], ['Move', stats.move], ['Damage', stats.damage], ['Range', stats.range]])}
  <small>${ALIENS[kind].text}.</small></div>`
