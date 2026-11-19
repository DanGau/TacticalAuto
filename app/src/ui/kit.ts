// A hero's kit grouped by where each part comes from, each tagged as battle callouts tag it; shown on hovering or tapping a hero.
import { PERKS } from '../core/perks'
import { CLASSES } from '../core/classes'
import { DOCTRINES } from '../core/doctrines'
import { EFFECTS } from '../core/gear'
import { RELICS } from '../core/relics'
import { relicIcon } from './relic-icons'
import { bonusIcon, kitIcon } from './ability-icons'
import { perkIcon, skillIcon } from './skill-icons'
import { weaponIcon } from './weapon-icons'
import type { Run, Soldier } from '../core/run-state'
import { SECONDARIES } from '../core/secondaries'
import { BASICS, type SrcKind } from '../core/sources'
import { abilityOf, secondaryOf } from '../core/hero'
import { SKILLS } from '../core/skills'
import { boonName, boonText } from '../core/utilities'
import { boonIcon } from './boon-icons'
import { WEAPONS } from '../core/weapons'
import { css } from '../view/shapes'
import { SOURCE } from '../view/palette'
import type { View } from '../view/view'

/** A name tagged with its source's glyph and colour, `title` on hover. */
export const tag = (kind: SrcKind, name: string, title = '') => `<span class="src" style="color:${css(SOURCE[kind].color)}"${title ? ` title="${title}"` : ''}>${SOURCE[kind].glyph} ${name}</span>`

/** The basic actions a hero has: Throw only with Heave. */
export const basicsOf = (hero: Soldier) => [BASICS.attack, BASICS.jump, ...(hero.perks.includes('heave') ? [BASICS.throw] : [])]

/** What a hero has in a battle, by source: each part's name and what it does. */
export function kitOf(run: Run, hero: Soldier): [SrcKind, { name: string; text: string }[]][] {
  const weapon = hero.gear ? WEAPONS[hero.gear.weapon] : null
  const ability = abilityOf(hero)
  const groups: [SrcKind, { name: string; text: string }[]][] = [
    ['basic', basicsOf(hero).map((name) => ({ name, text: '' }))],
    ['perk', hero.perks.map((id) => ({ name: `${perkIcon(id)} ${PERKS[id].name}`, text: PERKS[id].text }))],
    ['class', [...(ability ? [{ name: `${kitIcon(hero.cls!)} ${CLASSES[hero.cls!].abilityName}`, text: CLASSES[hero.cls!].abilityText }] : []), { name: `${bonusIcon(secondaryOf(hero))} ${SECONDARIES[secondaryOf(hero)].name}`, text: SECONDARIES[secondaryOf(hero)].text ?? '' }]],
    ['skill', hero.skills.filter((id) => !SKILLS[id].teaches).map((id) => ({ name: `${skillIcon(id)} ${SKILLS[id].name}`, text: SKILLS[id].text }))],
    ['weapon', weapon ? [{ name: `${weaponIcon(hero.gear!.weapon)} ${weapon.name}`, text: weapon.special ?? '' }] : []],
    ['gear', hero.gear?.effect ? [{ name: EFFECTS[hero.gear.effect].prefix, text: EFFECTS[hero.gear.effect].text }] : []],
    ['relic', run.relics.map((id) => ({ name: `${relicIcon(id)} ${RELICS[id].name}`, text: RELICS[id].text }))],
    ['doctrine', run.doctrines.map((id) => DOCTRINES[id])],
    ['boon', (run.battle?.boon ? [run.battle.boon] : run.utilities).map((h) => ({ name: `${boonIcon(h.id)} ${boonName(h.id, h.level)}`, text: boonText(h.id, h.level) }))],
  ]
  return groups.filter(([, parts]) => parts.length > 0)
}

/** A hero's kit as a card. */
export const kitCard = (run: Run, hero: Soldier) =>
  `<b>${hero.name}</b>${kitOf(run, hero)
    .map(([kind, parts]) => `<div class="kit-row"><small>${kind}</small>${parts.map((p) => tag(kind, p.name, p.text)).join(' ')}</div>`)
    .join('')}`

/** Shows the kit of the hero under the pointer, or tapped, in battle. */
export function installKit(view: View, run: Run): void {
  const card = document.createElement('div')
  card.id = 'kit'
  card.hidden = true
  document.body.append(card)
  const show = (e: PointerEvent) => {
    const battle = run.phase === 'battle' ? run.battle : null
    const unit = battle && battle.phase === 'battle' ? battle.units.find((u) => u.id === view.unitAt(e.clientX, e.clientY)) : undefined
    const hero = unit && unit.soldier === run.hero.id ? run.hero : undefined
    card.hidden = !hero
    if (!hero) return
    card.innerHTML = kitCard(run, hero)
    card.style.left = `${Math.min(e.clientX + 14, innerWidth - card.offsetWidth - 8)}px`
    card.style.top = `${Math.max(8, e.clientY - card.offsetHeight - 14)}px`
  }
  view.canvas.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && show(e))
  view.canvas.addEventListener('click', show)
  view.canvas.addEventListener('pointerleave', () => (card.hidden = true))
}
