// Screens after a battle or stop: rewards, loot, skill choices, the stop report, and the run's end.
import { CLASSES } from '../core/classes'
import { emptyTally, FEATS } from '../core/feats'
import type { Quantity } from '../core/quantities'
import { CIVILIANS } from '../core/goals'
import { RELICS, type RelicId } from '../core/relics'
import { relicIcon } from './relic-icons'
import { DUOS } from '../core/duos'
import { boonText, UTILITIES } from '../core/utilities'
import { type Gain, type Run } from '../core/run-state'
import { type Report } from '../core/run-state'
import { type Soldier } from '../core/run-state'
import { squadMakes } from '../core/squad'
import { soldierStats } from '../core/squad'
import { health } from '../core/squad'
import { minorOffers, owesPick, skillOffers } from '../core/squad'
import { PERKS, type PerkId } from '../core/perks'
import { level } from '../core/squad'
import { xpFor } from '../core/squad'
import { SKILLS, type SkillId } from '../core/skills'
import { usage } from '../core/powers'
import { findSwap, pickCard, pickDetail, startChoice, utilityPick, type Pick } from './cards'
import { heroDossier, heroSheet } from './sheet'
import { treeMap } from './tree'
import { badge, button, describe, gearText, gearName, healthBar, signed, STOP_NAMES, threatBar } from './html'

/**
 * A soldier's card: class badge, name, weapon, and an experience bar filling with what the battle earned, flaring on a
 * level gained; feats first pulled off below. Hovering a note tells it.
 */
function soldierCard(run: Run, soldier: Report['soldiers'][number]): string {
  const before = level({ xp: soldier.xpBefore })
  const after = level({ xp: soldier.xpAfter })
  const filled = (xp: number) => Math.min(100, (100 * (xp - xpFor(before))) / (xpFor(before + 1) - xpFor(before)))
  const cls = soldier.cls && CLASSES[soldier.cls].name
  const gained = soldier.xpAfter - soldier.xpBefore
  const up = after > before
  const note = soldier.taken ? '<b class="up">Taken · recovery next</b>' : up ? `<b class="down promoted">Level ${after}!</b>` : ''
  const feats = soldier.feats.map((id) => `<li class="feat" title="${FEATS[id].text}">★ ${FEATS[id].name}</li>`)
  const live = run.soldiers.find((s) => s.name === soldier.name)
  const weapon = live?.gear
  const choose = live && owesPick(live) ? `<button class="decide" data-ability="${live.id}">Choose ${skillOffers(live).length > 0 ? 'power' : 'perk'}</button>` : ''
  return `<div class="soldier ${soldier.taken ? 'died' : ''} ${up ? 'levelled' : ''}">
    <div class="who"><span class="portrait">${badge(soldier.cls)}</span><span><b>${soldier.name}</b><br><small>Level ${before}${cls ? ` · ${cls}` : ''}</small></span></div>
    <div class="bar"><div class="fill" style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${healthBar(soldier.hp, soldier.maxHp, live ? soldierStats(run, live).armor : 0)}
    ${weapon ? `<small class="gear ${weapon.rarity}" title="${gearText(weapon)}">${gearName(weapon)}</small>` : ''}
    ${gained > 0 ? `<small class="gained" title="${soldier.earned.map((e) => `${e.label}: +${e.xp}`).join('&#10;')}">+${gained} xp</small>` : ''} ${note}
    ${feats.length > 0 ? `<ul class="notes">${feats.join('')}</ul>` : ''}
    ${choose}
  </div>`
}

/** A hero joining the squad, alone on its screen: who they are, where from, and what they bring. */
export function joined(run: Run, name: string): string {
  const hero = run.soldiers.find((s) => s.name === name)!
  return `<div class="joined">${heroDossier(run, hero, `<button class="decide" data-met="report">${hero.name} joins the party</button>`)}</div>`
}

/** What the squad gained or lost unchosen, alone in a pop-up: what it is, what it does, and a button to go on. */
export function acquired(run: Run, gain: Gain): string {
  const shown = (top: string, look: string, name: string, text: string) => `<small class="up-top">${top}</small><div class="prize gear ${look}"><b>${name}</b><br>${text}</div>`
  const relicBody = (top: string, look: string, id: RelicId, held: Quantity[] = []) => shown(top, look, `${relicIcon(id)} ${RELICS[id].name}`, describe(RELICS[id].text, RELICS[id], held))
  const heroBody = (id: number) => {
    const hero = run.soldiers.find((s) => s.id === id)!
    return shown('Hero joined', hero.gear?.rarity ?? '', `${badge(hero.cls)} ${hero.name}`, heroSheet(run, hero))
  }
  const body = gain.kind === 'relic' ? relicBody('Relic gained', 'relic', gain.id, squadMakes(run)) : gain.kind === 'relicLost' ? relicBody('Relic lost', 'relic lost', gain.id) : gain.kind === 'boon' ? shown(`${UTILITIES[gain.id].rarity} boon gained`, UTILITIES[gain.id].rarity, `${UTILITIES[gain.id].icon} ${UTILITIES[gain.id].name}`, boonText(gain.id)) : heroBody(gain.soldier)
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

/** The class's tree as far as the soldier can see, its offers as cards: one tapped is armed, and tapped again is learned. */
export function skillChoice(run: Run, soldier: Soldier, armed: string | null = null): string {
  const held = squadMakes(run)
  const pick = (id: SkillId, index: number): Pick => {
    const skill = SKILLS[id]
    return { key: id, action: { type: 'skill', soldier: soldier.id, index }, look: 'skillnode offered', body: `<b>${skill.name}</b><small class="use">${usage(skill)}</small><span>${describe(skill.text, skill, held)}</span>`, detail: `<p><b>${skill.name}</b></p>`, go: `Tap again to learn ${skill.name}` }
  }
  const picks = skillOffers(soldier).map(pick)
  return `<h2><b class="supplies">${soldier.name}</b>, ${CLASSES[soldier.cls!].name} level ${level(soldier)}. Choose one of the powers offered; those turned down are lost for the run.</h2>
    ${treeMap(soldier, (id) => pickCard(picks.find((p) => p.key === id)!, armed), held)}
    ${pickDetail(picks, armed, 'Tap a power, then tap it again to learn it.')}`
}

/** A soldier's perk pick: three small cards, one tap to take; those passed over may come again. */
export function perkChoice(soldier: Soldier): string {
  const card = (id: PerkId, index: number) => button({ type: 'perk', soldier: soldier.id, index }, `<b>${PERKS[id].name}</b><small>${PERKS[id].text}</small>`, 'perk')
  const held = soldier.perks.length > 0 ? `<small class="held">Has: ${soldier.perks.map((id) => PERKS[id].name).join(', ')}</small>` : ''
  return `<div class="perkpick"><h2><b class="supplies">${soldier.name}</b>, level ${level(soldier)}: pick a perk. The others may come again.</h2><div class="perks">${minorOffers(soldier).map(card).join('')}</div>${held}</div>`
}

/** A soldier's next pick: its power first, then its perk. */
export const pickChoice = (run: Run, soldier: Soldier, armed: string | null) => (skillOffers(soldier).length > 0 ? skillChoice(run, soldier, armed) : perkChoice(soldier))

/** With a utility found and no room: fixed cards, each held one to drop for it, or the new one left behind. */
export function spareChoice(run: Run, armed: string | null): string {
  const spare = UTILITIES[run.spare!]
  const picks = [...run.utilities.map((id, i) => utilityPick(`d${i}`, { type: 'keep', drop: i }, id, 'drop', `Tap again to drop ${UTILITIES[id].name} for ${spare.name}`)), utilityPick('d', { type: 'keep', drop: -1 }, run.spare!, run.shop ? 'put back' : 'leave', run.shop ? `Tap again to put ${spare.name} back, your supplies repaid` : `Tap again to leave ${spare.name} behind`)]
  return modal(`<h2>${spare.icon} ${spare.name}: ${spare.text}. The party holds three: drop which?</h2><div class="picks">${picks.map((p) => pickCard(p, armed)).join('')}</div>${pickDetail(picks, armed, 'Tap a card for its details; tap it again to choose it.')}`)
}

/** The relics offered, and a duo if one is, as cards with their icons: one tapped is armed, then Take carries it. */
function relicChoice(run: Run, duo: (typeof DUOS)[keyof typeof DUOS] | null, armed: string | null): string {
  const held = squadMakes(run)
  const card = (key: string, icon: string, top: string, name: string, text: string, look: string) =>
    `<button class="side ${look}${armed === key ? ' keep' : ''}" role="radio" aria-checked="${armed === key}" data-arm="${key}"><span class="art">${icon}</span><small class="tier">${top}</small><b>${name}</b><span>${text}</span></button>`
  const relics = run.relicOffers.map((id, i) => card(`r${i}`, relicIcon(id), `${RELICS[id].rarity ?? 'rare'} relic`, RELICS[id].name, describe(RELICS[id].text, RELICS[id], held), `relic ${RELICS[id].rarity ?? 'rare'}`))
  const pair = duo?.pair.map((cls) => CLASSES[cls].name)
  const bond = duo ? [card('duo', '<span class="glyph">✦</span>', `duo · ${pair!.join(' + ')}`, duo.name, describe(duo.text, {}, held), 'duo')] : []
  const pick = armed === 'duo' && duo ? { type: 'duo' as const } : armed?.match(/^r\d$/) ? { type: 'relic' as const, index: Number(armed.slice(1)) } : null
  return `<div class="gearswap relics"><h1>Alien artifacts</h1><h2>Carry one for the run${pair ? `, or ${pair.join(' and ')} train as a duo` : ''}</h2>
    <div class="swap" style="--n:${relics.length + bond.length}">${[...relics, ...bond].join('')}</div>
    <button class="decide confirm"${pick ? ` data-action='${JSON.stringify(pick)}'` : ' disabled'}>${pick ? 'Take it' : 'Pick one'}</button></div>`
}

/** The next choice of the reward phase, alone on its screen: the starting boons, a relic, then each find and who takes it, then each skill and perk owed. */
export function choice(run: Run, armed: string | null = null): string {
  if (run.boonOffers.length > 0) return startChoice(run, armed)
  const duo = run.duoOffer && DUOS[run.duoOffer]
  if (run.relicOffers.length > 0 || duo) return relicChoice(run, duo || null, armed)
  if (run.finds.length > 0) {
    const more = run.finds.length > 1 ? ` · ${run.finds.length - 1} more found` : ''
    return findSwap(run, 0, armed, more)
  }
  const learner = run.soldiers.find(owesPick)
  return learner ? pickChoice(run, learner, armed) : ''
}

/**
 * The summary after a stop, once its choices are made, revealed top to bottom: the threat, what was gained, the squad
 * if it fought with a crate for each find, and a button to go on once every crate is opened and every skill chosen.
 */
export function stopReport(run: Run, report: Report, still = false): string {
  const { before, after } = report.threat
  const threat = after === before ? '' : `<span class="note">${signed(after - before)}</span>`
  // The hero just joined stands with the squad that fought.
  const hero = run.soldiers.find((s) => s.name === report.hired)
  const all = [...report.soldiers, ...(hero ? [{ id: hero.id, name: hero.name, cls: hero.cls, xpBefore: hero.xp, xpAfter: hero.xp, taken: false, earned: [], feats: [], hp: health(run, hero), maxHp: soldierStats(run, hero).hp, tally: emptyTally() }] : [])]
  const crates = run.finds.map((_, i) => `<button class="crate" data-crate="${i}" title="Open">🎁</button>`)
  const squad = report.soldiers.length > 0 ? `<div class="stage second"><div class="squad">${all.map((s) => soldierCard(run, s)).join('')}</div>${crates.length > 0 ? `<div class="crates">${crates.join('')}</div>` : ''}</div>` : ''
  const owed = squad !== '' && (run.finds.length > 0 || run.spare !== null || run.soldiers.some(owesPick))
  return `<div class="debrief${still ? ' still' : ''}">
    ${title(report)}
    <div class="stage">
      <p>Threat ${threatBar(after, Math.max(0, after - before))}${threat}</p>
      ${report.rescued !== null ? `<p class="down">${report.rescued} of ${CIVILIANS} civilians rescued</p>` : ''}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : ''}
    </div>
    ${squad}
    <div class="stage ${squad ? 'third' : 'second'}">${report.soldiers.length > 0 ? '<button data-stats="open">Battle stats</button> ' : ''}<button data-seen="report"${owed ? ' disabled' : ''}>Continue</button></div>
  </div>`
}
