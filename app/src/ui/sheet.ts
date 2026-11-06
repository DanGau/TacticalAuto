// Character sheets and stat blocks: a hero's or alien's numbers, weapon and powers, told one way everywhere.
import { ALIENS, type AlienKind } from '../core/aliens'
import type { Stats } from '../core/battle'
import { classPower, CLASSES } from '../core/classes'
import type { Keyword } from '../core/keywords'
import { usage, type Power } from '../core/powers'
import type { Run, Soldier } from '../core/run-state'
import { secondaryOf, charges, skillOffers, health, level, soldierStats, weaponOf } from '../core/squad'
import { secondaryPower, SECONDARIES } from '../core/secondaries'
import { powerOf, SKILLS, TREES, unlocked, type SkillId } from '../core/skills'
import { describe, gearText, gearType, resistChip } from './html'
import { DUOS, duosFor } from '../core/duos'

/** The duos a hero forms with the squad, or with no squad yet, the classes it can: each by name and partner, its effect on hover. */
export function duoHint(run: Run, hero: Soldier): string {
  const duos = duosFor(run, hero)
  if (duos.length === 0) return ''
  const alone = run.soldiers.every((s) => s === hero)
  const chips = duos.map(({ id, partner }) => `<span title="${DUOS[id].text}">${alone ? partner : `${DUOS[id].name} with ${partner}${run.duos.includes(id) ? ' ✓' : ''}`}</span>`)
  return `<small class="duos">✦ Duos${alone ? ' with' : ':'} ${chips.join(', ')}</small>`
}

/** A row of named numbers. */
export const statBlock = (cells: [string, string | number][]) => `<div class="statblock">${cells.map(([name, value]) => `<span><small>${name}</small><b>${value}</b></span>`).join('')}</div>`

/** A power in full: its name, usage line and effect. */
export const powerBlock = (power: Power, tags?: Keyword[], held?: Keyword[]) => `<div class="power described"><b>${power.name}</b> <small class="use">${usage(power)}</small><div>${describe(power.text, tags, held)}</div></div>`

/** A power in brief, for a card: its name and when it works. */
const powerChip = (power: Power) => `<span class="chip">${power.name} <small class="use">${power.use}</small></span>`

/** A hero's numbers. */
const heroStats = (run: Run, hero: Soldier) => {
  const stats = soldierStats(run, hero)
  return statBlock([['HP', `${health(run, hero)}/${stats.hp}`], ['Armor', stats.armor], ['Move', stats.move], ['Damage', stats.damage], ['Range', stats.range], ['Crit', `${Math.round(100 * stats.crit)}%`], ['Strength', stats.strength], ['Jump', stats.jump]])
}

/** A hero's weapon: its type and special. */
const kit = ({ gear }: Soldier) => (gear ? `${gearType(gear)}. ${gearText(gear)}` : '')

/** A hero's powers: its bonus attack, then those it learned, its class's ability with its uses worked out. */
const powers = (run: Run, hero: Soldier): (Power & { tags?: Keyword[] })[] => [
  secondaryPower(SECONDARIES[secondaryOf(hero)]),
  ...hero.skills.map((id) => (id === powerOf(hero.cls!) ? classPower(CLASSES[hero.cls!], charges(run, hero)) : SKILLS[id])),
]

/** Class and level, as a sheet heads them. */
const heading = (hero: Soldier) => `Level ${level(hero)}${hero.cls ? ` ${CLASSES[hero.cls].name}` : ''}`

/** A hero as a card: name, class and level, numbers, weapon and kit, and its powers by name. */
export const heroCard = (run: Run, hero: Soldier) => `<small>${heading(hero)}</small>
  <b class="name">${hero.name}</b>
  ${heroStats(run, hero)}
  <div class="weapon"><b>${hero.gear?.name ?? 'Empty hands'}</b><small>${kit(hero)}</small></div>
  <span class="feats">${powers(run, hero).map(powerChip).join('')}</span>
  ${duoHint(run, hero)}`

/** A hero's powers in full. */
export const powerList = (run: Run, hero: Soldier, held?: Keyword[]) => `<div class="powers">${powers(run, hero).map((p) => powerBlock(p, p.tags, held)).join('')}</div>`

/** A hero's whole sheet: numbers, weapon and kit, how it fights, and its powers in full. */
export function heroSheet(run: Run, hero: Soldier): string {
  const stance = hero.cls && !weaponOf(hero)?.stance ? `<small>${CLASSES[hero.cls].stanceText}.</small>` : ''
  return `<div class="charsheet"><small>${heading(hero)}</small>${heroStats(run, hero)}
    <div class="weapon"><b>${hero.gear?.name ?? 'Empty hands'}</b><small>${kit(hero)}</small></div>${stance}
    ${powerList(run, hero)}${duoHint(run, hero)}${heroTree(hero)}</div>`
}

/** A class's tree as a grid, a column per branch and a row per tier, with `cell` drawing each skill. */
export const treeGrid = (hero: Soldier, cell: (id: SkillId) => string) => {
  const branches = TREES[hero.cls!]
  return `<div class="tree" style="--branches:${branches.length}">${branches.map(({ name, tiers }) => `<div class="branch"><b>${name}</b>${tiers.map((skills, tier) => `<small class="t${tier + 1}">Tier ${tier + 1}</small>${skills.map(cell).join('')}`).join('')}</div>`).join('')}</div>`
}

/** Whether a hero knows a skill, is offered it now, turned it down for good, could be offered it later, or has it locked. */
export type SkillState = 'taken' | 'offered' | 'lost' | 'open' | 'locked'
export const skillState = (hero: Soldier, id: SkillId): SkillState =>
  hero.skills.includes(id) ? 'taken' : skillOffers(hero).includes(id) ? 'offered' : hero.lost.includes(id) ? 'lost' : unlocked(hero.cls!, hero.skills).includes(id) ? 'open' : 'locked'

/** A hero's tree in brief, each skill's name marked by its state. */
export const heroTree = (hero: Soldier) => (hero.cls ? treeGrid(hero, (id) => `<span class="node-name ${skillState(hero, id)}" title="${SKILLS[id].text}">${SKILLS[id].name}</span>`) : '')

/** An alien's stat block: name, numbers, what it does, what it resists. */
export const alienBlock = (kind: AlienKind, stats: Stats, hp = stats.hp) => `<div class="charsheet alien"><b class="name">${ALIENS[kind].name}</b> ${ALIENS[kind].resists.map(resistChip).join('')}
  ${statBlock([['HP', hp], ['Armor', stats.armor], ['Move', stats.move], ['Damage', stats.damage], ['Range', stats.range], ['Strength', stats.strength], ['Jump', stats.jump]])}
  <small>${ALIENS[kind].text}.</small></div>`
