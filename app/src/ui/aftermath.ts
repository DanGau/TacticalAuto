// Screens after a battle or stop: rewards, loot, skill choices, the stop report, and the run's end.
import { CLASSES } from '../core/classes'
import { emptyTally, FEATS } from '../core/feats'
import type { Keyword } from '../core/keywords'
import { CIVILIANS } from '../core/goals'
import { RELICS, type RelicId } from '../core/relics'
import { DUOS } from '../core/duos'
import { UTILITIES } from '../core/utilities'
import { type Gain, type Run } from '../core/run-state'
import { type Report } from '../core/run-state'
import { type Soldier } from '../core/run-state'
import { squadKeywords } from '../core/squad'
import { soldierStats } from '../core/squad'
import { health } from '../core/squad'
import { skillOffers } from '../core/squad'
import { level } from '../core/squad'
import { xpFor } from '../core/squad'
import { CAPSTONE_PICKS, SKILLS, TREES, type SkillId } from '../core/skills'
import { usage } from '../core/powers'
import { findSwap, pickCard, pickDetail, utilityPick, type Pick } from './cards'
import { heroSheet, skillState, treeGrid } from './sheet'
import { badge, button, describe, gearText, gearType, healthBar, signed, STOP_NAMES, threatBar } from './html'

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
  const choose = live && skillOffers(live).length > 0 ? `<button class="decide" data-ability="${live.id}">Choose power</button>` : ''
  return `<div class="soldier ${soldier.taken ? 'died' : ''} ${up ? 'levelled' : ''}">
    <div class="who"><span class="portrait">${badge(soldier.cls)}</span><span><b>${soldier.name}</b><br><small>Level ${before}${cls ? ` · ${cls}` : ''}</small></span></div>
    <div class="bar"><div class="fill" style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${healthBar(soldier.hp, soldier.maxHp, live ? soldierStats(run, live).armor : 0)}
    ${weapon ? `<small class="gear ${weapon.rarity}" title="${gearText(weapon)}">${weapon.name} · ${gearType(weapon)}</small>` : ''}
    ${gained > 0 ? `<small class="gained" title="${soldier.earned.map((e) => `${e.label}: +${e.xp}`).join('&#10;')}">+${gained} xp</small>` : ''} ${note}
    ${feats.length > 0 ? `<ul class="notes">${feats.join('')}</ul>` : ''}
    ${choose}
  </div>`
}

/** A hero joining the squad, alone on its screen: who they are, where from, and what they bring. */
export function joined(run: Run, name: string): string {
  const hero = run.soldiers.find((s) => s.name === name)!
  return `<div class="debrief joined">
    <span class="portrait">${badge(hero.cls)}</span>
    <h1 class="down">${hero.name} joins</h1>
    <p>🌍 ${hero.home?.name ?? ''}</p>
    ${heroSheet(run, hero)}
    <button class="decide" data-met="report">Continue</button>
  </div>`
}

/** What the squad gained or lost unchosen, alone in a pop-up: what it is, what it does, and a button to go on. */
export function acquired(run: Run, gain: Gain): string {
  const shown = (top: string, look: string, name: string, text: string) => `<small class="up-top">${top}</small><div class="prize gear ${look}"><b>${name}</b><br>${text}</div>`
  const relicBody = (top: string, look: string, id: RelicId, held: Keyword[] = []) => shown(top, look, RELICS[id].name, describe(RELICS[id].text, RELICS[id].tags, held))
  const heroBody = (id: number) => {
    const hero = run.soldiers.find((s) => s.id === id)!
    return shown('Hero joined', hero.gear?.rarity ?? '', `${badge(hero.cls)} ${hero.name}`, heroSheet(run, hero))
  }
  const body = gain.kind === 'relic' ? relicBody('Relic gained', 'relic', gain.id, squadKeywords(run)) : gain.kind === 'relicLost' ? relicBody('Relic lost', 'relic lost', gain.id) : gain.kind === 'boon' ? shown('Boon gained', '', `${UTILITIES[gain.id].icon} ${UTILITIES[gain.id].name}`, UTILITIES[gain.id].text) : heroBody(gain.soldier)
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
  if (report.stop === 'supply' || report.stop === 'cache') return `<h1>${name}</h1>`
  return `<h1 class="${report.won ? 'down' : 'up'}">${name} ${report.won ? 'won' : 'lost'}</h1>`
}

/** The class's tree, for a soldier owed a power: taken, open and locked at a glance; an open one tapped tells what it does, and tapped again is learned. */
export function skillChoice(run: Run, soldier: Soldier, armed: string | null = null): string {
  const held = squadKeywords(run)
  const offers = skillOffers(soldier)
  const pick = (id: SkillId): Pick => {
    const skill = SKILLS[id]
    const state = skillState(soldier, id)
    return { key: id, action: state === 'open' ? { type: 'skill', soldier: soldier.id, index: offers.indexOf(id) } : undefined, look: `skillnode ${state}`, body: `<b>${skill.name}</b>`, detail: `<p><b>${skill.name}</b> <small class="use">${usage(skill)}</small></p><div>${describe(skill.text, skill.tags, held)}</div>`, go: `Tap again to learn ${skill.name}`, block: state === 'taken' ? 'Learned' : state === 'locked' ? 'Locked: take a power of the tier below' + (soldier.skills.length < CAPSTONE_PICKS ? `; tier 3 needs ${CAPSTONE_PICKS} powers learned, tier 4 its tier 3` : '') : null }
  }
  const picks = TREES[soldier.cls!].flatMap((branch) => branch.tiers.flat()).map(pick)
  return `<h2><b class="supplies">${soldier.name}</b>, ${CLASSES[soldier.cls!].name} level ${level(soldier)}. Choose a power; a branch taken is a branch given up.</h2>
    ${treeGrid(soldier, (id) => pickCard(pick(id), armed))}
    ${pickDetail(picks, armed, 'Tap a power for its details; tap it again to learn it.')}`
}

/** With a utility found and no room: fixed cards, each held one to drop for it, or the new one left behind. */
export function spareChoice(run: Run, armed: string | null): string {
  const spare = UTILITIES[run.spare!]
  const picks = [...run.utilities.map((id, i) => utilityPick(`d${i}`, { type: 'keep', drop: i }, id, 'drop', `Tap again to drop ${UTILITIES[id].name} for ${spare.name}`)), utilityPick('d', { type: 'keep', drop: -1 }, run.spare!, run.shop ? 'put back' : 'leave', run.shop ? `Tap again to put ${spare.name} back, your supplies repaid` : `Tap again to leave ${spare.name} behind`)]
  return modal(`<h2>${spare.icon} ${spare.name}: ${spare.text}. The party holds three: drop which?</h2><div class="picks">${picks.map((p) => pickCard(p, armed)).join('')}</div>${pickDetail(picks, armed, 'Tap a card for its details; tap it again to choose it.')}`)
}

/** The next choice of the reward phase, alone on its screen: a relic, then each find and who takes it, then each skill owed. */
export function choice(run: Run, armed: string | null = null): string {
  const held = squadKeywords(run)
  const relic = (id: RelicId, index: number) => button({ type: 'relic', index }, `<small>relic</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags, held)}`, 'card relic')
  const duo = run.duoOffer && DUOS[run.duoOffer]
  const bond = duo ? button({ type: 'duo' }, `<small>duo · ${duo.pair.map((cls) => CLASSES[cls].name).join(' + ')}</small><br><b>✦ ${duo.name}</b><br>${describe(duo.text, [], held)}`, 'card duo') : ''
  if (run.relicOffers.length > 0 || duo) return `<h2>Alien artifacts lie in the wreckage. The party can carry one, and keeps it for the run${duo ? `, or ${duo.pair.map((cls) => CLASSES[cls].name).join(' and ')} can train as a duo in its place` : ''}.</h2><div class="choices">${run.relicOffers.map(relic).join('')}${bond}</div>`
  if (run.finds.length > 0) {
    const more = run.finds.length > 1 ? ` · ${run.finds.length - 1} more found` : ''
    return `<h2>Gear found. Who takes it?${more}</h2>${findSwap(run, 0, armed)}`
  }
  const learner = run.soldiers.find((s) => skillOffers(s).length > 0)
  return learner ? skillChoice(run, learner, armed) : ''
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
  const owed = squad !== '' && (run.finds.length > 0 || run.spare !== null || run.soldiers.some((s) => skillOffers(s).length > 0))
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
