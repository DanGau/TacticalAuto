// A hero's kit grouped by where each part comes from, each tagged as battle callouts tag it; shown on hovering or tapping a hero.
import { DOCTRINES } from '../core/doctrines'
import { EFFECTS } from '../core/gear'
import { RELICS } from '../core/relics'
import { relicIcon } from './relic-icons'
import { weaponIcon } from './weapon-icons'
import type { Run, Soldier } from '../core/run-state'
import type { SrcKind } from '../core/sources'
import { CARDS, cardName, cardText, STRIKES } from '../core/cards'
import { cardIcon } from './card-icons'
import { WEAPONS } from '../core/weapons'
import { css } from '../view/shapes'
import { SOURCE } from '../view/palette'
import type { View } from '../view/view'

/** A name tagged with its source's glyph and colour, `title` on hover. */
export const tag = (kind: SrcKind, name: string, title = '') => `<span class="src" style="color:${css(SOURCE[kind].color)}"${title ? ` title="${title}"` : ''}>${SOURCE[kind].glyph} ${name}</span>`

/** What a hero has in a battle, by source: each part's name and what it does. Doctrines lean card offers, so they show as relics do. */
export function kitOf(run: Run, hero: Soldier): [SrcKind, { name: string; text: string }[]][] {
  const weapon = hero.gear ? WEAPONS[hero.gear.weapon] : null
  const groups: [SrcKind, { name: string; text: string }[]][] = [
    ['weapon', weapon ? [{ name: `${weaponIcon(hero.gear!.weapon)} ${weapon.name}`, text: `Strike: ${cardName(STRIKES[hero.gear!.weapon])}` }] : []],
    ['gear', hero.gear?.effect ? [{ name: EFFECTS[hero.gear.effect].prefix, text: EFFECTS[hero.gear.effect].text }] : []],
    ['relic', [...run.relics.map((id) => ({ name: `${relicIcon(id)} ${RELICS[id].name}`, text: RELICS[id].text })), ...run.doctrines.map((id) => DOCTRINES[id])]],
    ['card', (run.phase === 'battle' && run.battle ? run.battle.pile.exhaust.filter((c) => CARDS[c.id].type === 'power') : []).map((c) => ({ name: `${cardIcon(c.id)} ${cardName(c.id, c.level)}`, text: cardText(c.id, c.level) }))],
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
