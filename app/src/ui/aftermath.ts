// Screens after a battle or stop: rewards, loot, skill choices, the stop report, and the run's end.
import { CLASSES } from '../core/classes'
import { FEATS } from '../core/feats'
import type { Quantity } from '../core/quantities'
import { CIVILIANS } from '../core/goals'
import { RELICS, type RelicId } from '../core/relics'
import { relicIcon } from './relic-icons'
import { perkIcon, skillIcon } from './skill-icons'
import { CARDS } from '../core/cards'
import { UPGRADED } from '../core/deck'
import { cardFace, deckGrid } from './card-face'
import { type Gain, type Run } from '../core/run-state'
import { type Report } from '../core/run-state'
import { type Soldier } from '../core/run-state'
import { makes } from '../core/hero'
import { soldierStats } from '../core/hero'
import { minorOffers, owesPick, skillOffers } from '../core/hero'
import { PERKS, type PerkId } from '../core/perks'
import { level } from '../core/hero'
import { xpFor } from '../core/hero'
import { SKILLS, type SkillId } from '../core/skills'
import { usage } from '../core/powers'
import { findSwap, pickCard, pickDetail, type Pick } from './cards'
import { treeMap } from './tree'
import { badge, button, describe, gearText, gearName, healthBar, signed, STOP_NAMES, threatBar } from './html'

/**
 * The hero's card: class badge, name, weapon, and an experience bar filling with what the battle earned, flaring on a
 * level gained; feats first pulled off below. Hovering a note tells it.
 */
function heroCard(run: Run, fought: NonNullable<Report['hero']>): string {
  const hero = run.hero
  const before = level({ xp: fought.xpBefore })
  const after = level({ xp: fought.xpAfter })
  const filled = (xp: number) => Math.min(100, (100 * (xp - xpFor(before))) / (xpFor(before + 1) - xpFor(before)))
  const cls = hero.cls && CLASSES[hero.cls].name
  const gained = fought.xpAfter - fought.xpBefore
  const up = after > before
  const note = up ? `<b class="down promoted">Level ${after}!</b>` : ''
  const feats = fought.feats.map((id) => `<li class="feat" title="${FEATS[id].text}">★ ${FEATS[id].name}</li>`)
  const weapon = hero.gear
  const choose = owesPick(hero) ? `<button class="decide" data-ability="pick">Choose ${skillOffers(hero).length > 0 ? 'power' : 'perk'}</button>` : ''
  return `<div class="soldier ${up ? 'levelled' : ''}">
    <div class="who"><span class="portrait">${badge(hero.cls)}</span><span><b>${hero.name}</b><br><small>Level ${before}${cls ? ` · ${cls}` : ''}</small></span></div>
    <div class="bar"><div class="fill" style="--from: ${filled(fought.xpBefore)}%; --to: ${filled(fought.xpAfter)}%"></div></div>
    ${healthBar(fought.hp, fought.maxHp, soldierStats(run, hero).armor)}
    ${weapon ? `<small class="gear ${weapon.rarity}" title="${gearText(weapon)}">${gearName(weapon)}</small>` : ''}
    ${gained > 0 ? `<small class="gained" title="${fought.earned.map((e) => `${e.label}: +${e.xp}`).join('&#10;')}">+${gained} XP</small>` : ''} ${note}
    ${feats.length > 0 ? `<ul class="notes">${feats.join('')}</ul>` : ''}
    ${choose}
  </div>`
}

/** What the hero gained or lost unchosen, alone in a pop-up: what it is, what it does, and a button to go on. */
export function acquired(run: Run, gain: Gain): string {
  const shown = (top: string, look: string, name: string, text: string) => `<small class="up-top">${top}</small><div class="prize gear ${look}"><b>${name}</b><br>${text}</div>`
  const relicBody = (top: string, look: string, id: RelicId, held: Quantity[] = []) => shown(top, look, `${relicIcon(id)} ${RELICS[id].name}`, describe(RELICS[id].text, RELICS[id], held))
  const body = gain.kind === 'relic' ? relicBody('Relic gained', 'relic', gain.id, makes(run)) : relicBody('Relic lost', 'relic lost', gain.id)
  return modal(`<div class="acquired">${body}<button class="decide" data-action='${JSON.stringify({ type: 'ack' })}'>Got it</button></div>`)
}

/** A pop-up over the debrief, `html` inside it. */
export const modal = (html: string) => `<div class="modal"><div class="sheet">${html}</div></div>`

/** A crate opened, in a pop-up: it shakes and bursts in its gear's rarity, and the swap rises out of it. */
export function loot(run: Run, index: number, armed: string | null): string {
  const gear = run.finds[index]
  return modal(`<div class="loot ${gear.rarity}${armed ? ' still' : ''}">
    <div class="burst"></div>
    <span class="box">🎁</span>
    <div class="said">${findSwap(run, index, armed)}</div>
  </div>`)
}

function title(report: Report): string {
  const name = STOP_NAMES[report.stop]
  if (report.stop === 'supply' || report.stop === 'cache' || report.stop === 'safehouse') return `<h1>${name}</h1>`
  return `<h1 class="${report.won ? 'down' : 'up'}">${name} ${report.won ? 'won' : 'lost'}</h1>`
}

/** The class's tree as far as the hero can see, its offers as cards: one tapped is armed, and tapped again is learned. */
export function skillChoice(run: Run, soldier: Soldier, armed: string | null = null): string {
  const held = makes(run)
  const pick = (id: SkillId, index: number): Pick => {
    const skill = SKILLS[id]
    return { key: id, action: { type: 'skill', index }, look: 'skillnode offered', body: `<b>${skillIcon(id)} ${skill.name}</b><small class="use">${usage(skill)}</small><span>${describe(skill.text, skill, held)}</span>`, detail: `<p><b>${skill.name}</b></p>`, go: `Tap again to learn ${skill.name}` }
  }
  const picks = skillOffers(soldier).map(pick)
  return `<h2><b class="supplies">${soldier.name}</b>, ${CLASSES[soldier.cls!].name} level ${level(soldier)}. Choose one of the powers offered; those turned down are lost for the run.</h2>
    ${treeMap(soldier, (id) => pickCard(picks.find((p) => p.key === id)!, armed), held)}
    ${pickDetail(picks, armed, 'Tap a power, then tap it again to learn it.')}`
}

/** The hero's perk pick: three small cards, one tap to take; those passed over may come again. */
export function perkChoice(soldier: Soldier): string {
  const card = (id: PerkId, index: number) => button({ type: 'perk', index }, `<span class="art">${perkIcon(id)}</span><b>${PERKS[id].name}</b><small>${PERKS[id].text}</small>`, 'perk')
  const held = soldier.perks.length > 0 ? `<small class="held">Has: ${soldier.perks.map((id) => `${perkIcon(id)} ${PERKS[id].name}`).join(', ')}</small>` : ''
  return `<div class="perkpick"><h2><b class="supplies">${soldier.name}</b>, level ${level(soldier)}: pick a perk. The others may come again.</h2><div class="perks">${minorOffers(soldier).map(card).join('')}</div>${held}</div>`
}

/** The hero's next pick: its power first, then its perk. */
export const pickChoice = (run: Run, soldier: Soldier, armed: string | null) => (skillOffers(soldier).length > 0 ? skillChoice(run, soldier, armed) : perkChoice(soldier))

/** The cards offered after a battle: one tapped is picked, then added to the deck; or Skip keeps the deck as it is. */
function cardChoice(run: Run, armed: string | null): string {
  const pick = armed?.match(/^k(\d)$/) ? Number(armed.slice(1)) : null
  const cards = run.cardOffers.map((id, i) => cardFace(run, { id, level: 1 }, { attrs: `data-arm="k${i}" role="radio" aria-checked="${pick === i}"`, state: pick === i ? 'on' : '' }))
  return `<div class="gearswap cardpick"><h1>Add a card</h1><h2>Add 1 to your deck of ${run.deck.length}, or skip to keep it lean.</h2>
    <div class="hand" role="radiogroup">${cards.join('')}</div>
    <div class="actions"><button class="decide confirm"${pick === null ? ' disabled' : ` data-action='${JSON.stringify({ type: 'card', index: pick })}'`}>${pick === null ? 'Pick one' : `Add ${CARDS[run.cardOffers[pick]].name}`}</button><button class="decide skip" data-action='${JSON.stringify({ type: 'card', index: null })}'>Skip</button></div></div>`
}

/** At a safehouse: a card of the deck tapped is picked, then upgraded; or Skip. */
function upgradeChoice(run: Run, armed: string | null): string {
  const pick = armed?.match(/^u(\d+)$/) ? Number(armed.slice(1)) : null
  const grid = deckGrid(run, (card, i) => (card.level < UPGRADED ? `data-arm="u${i}"${pick === i ? ' data-on' : ''}` : undefined))
  const preview = pick === null ? '' : `<div class="hand">${cardFace(run, run.deck[pick])}<span class="arrow">→</span>${cardFace(run, { ...run.deck[pick], level: UPGRADED })}</div>`
  return `<div class="gearswap cardpick"><h1>Upgrade a card</h1><h2>Rested to full. Upgrade 1 card for the run, or skip.</h2>${preview}${grid}
    <div class="actions"><button class="decide confirm"${pick === null ? ' disabled' : ` data-action='${JSON.stringify({ type: 'upgrade', index: pick })}'`}>${pick === null ? 'Pick one' : 'Upgrade'}</button><button class="decide skip" data-action='${JSON.stringify({ type: 'upgrade', index: null })}'>Skip</button></div></div>`
}

/** The relics offered, as cards with their icons: one tapped is armed, then Take carries it. */
function relicChoice(run: Run, armed: string | null): string {
  const held = makes(run)
  const card = (key: string, icon: string, top: string, name: string, text: string, look: string) =>
    `<button class="side ${look}${armed === key ? ' keep' : ''}" role="radio" aria-checked="${armed === key}" data-arm="${key}"><span class="art">${icon}</span><small class="tier">${top}</small><b>${name}</b><span>${text}</span></button>`
  const relics = run.relicOffers.map((id, i) => card(`r${i}`, relicIcon(id), `${RELICS[id].rarity ?? 'rare'} relic`, RELICS[id].name, describe(RELICS[id].text, RELICS[id], held), `relic ${RELICS[id].rarity ?? 'rare'}`))
  const pick = armed?.match(/^r\d$/) ? { type: 'relic' as const, index: Number(armed.slice(1)) } : null
  return `<div class="gearswap relics"><h1>Alien artifacts</h1><h2>Carry one for the run</h2>
    <div class="swap" style="--n:${relics.length}">${relics.join('')}</div>
    <button class="decide confirm"${pick ? ` data-action='${JSON.stringify(pick)}'` : ' disabled'}>${pick ? 'Take it' : 'Pick one'}</button></div>`
}

/** The next choice of the reward phase, alone on its screen: a relic, then each find, taken or sold, then cards, an upgrade, then each skill and perk owed. */
export function choice(run: Run, armed: string | null = null): string {
  if (run.relicOffers.length > 0) return relicChoice(run, armed)
  if (run.finds.length > 0) {
    const more = run.finds.length > 1 ? ` · ${run.finds.length - 1} more found` : ''
    return findSwap(run, 0, armed, more)
  }
  if (run.cardOffers.length > 0) return cardChoice(run, armed)
  if (run.upgrading) return upgradeChoice(run, armed)
  return owesPick(run.hero) ? pickChoice(run, run.hero, armed) : ''
}

/**
 * The summary after a stop, once its choices are made, revealed top to bottom: the threat, what was gained, the hero
 * if it fought with a crate for each find, and a button to go on once every crate is opened and every skill chosen.
 */
export function stopReport(run: Run, report: Report, still = false): string {
  const { before, after } = report.threat
  const threat = after === before ? '' : `<span class="note">${signed(after - before)}</span>`
  const crates = run.finds.map((_, i) => `<button class="crate" data-crate="${i}" title="Open">🎁</button>`)
  const fought = report.hero ? `<div class="stage second"><div class="fought">${heroCard(run, report.hero)}</div>${crates.length > 0 ? `<div class="crates">${crates.join('')}</div>` : ''}</div>` : ''
  const owed = fought !== '' && (run.finds.length > 0 || owesPick(run.hero))
  return `<div class="debrief${still ? ' still' : ''}">
    ${title(report)}
    <div class="stage">
      <p>Threat ${threatBar(after, Math.max(0, after - before))}${threat}</p>
      ${report.rescued !== null ? `<p class="down">${report.rescued} of ${CIVILIANS} civilians rescued</p>` : ''}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : ''}
    </div>
    ${fought}
    <div class="stage ${fought ? 'third' : 'second'}">${report.hero ? '<button data-stats="open">Battle stats</button> ' : ''}<button data-seen="report"${owed ? ' disabled' : ''}>Continue</button></div>
  </div>`
}
