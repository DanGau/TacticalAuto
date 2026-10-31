// Screens after a battle or stop: rewards, loot, skill choices, the stop report, and the run's end.
import { CLASSES } from '../core/classes'
import { FEATS, type Tally } from '../core/feats'
import { CIVILIANS } from '../core/goals'
import { RELICS, type RelicId } from '../core/relics'
import { CONSUMABLES } from '../core/consumables'
import { KEYS } from '../core/run'
import { type Run } from '../core/run-state'
import { type Report } from '../core/run-state'
import { type Soldier } from '../core/run-state'
import { squadKeywords } from '../core/squad'
import { soldierStats } from '../core/squad'
import { health } from '../core/squad'
import { skillOffers } from '../core/squad'
import { level } from '../core/squad'
import { xpFor } from '../core/squad'
import { SKILLS } from '../core/skills'
import { TRAITS } from '../core/traits'
import { gearPicks, pickCard, pickDetail, sellPick } from './cards'
import { badge, button, describe, ROLES, gearCard, gearText, healthBar, signed, STOP_NAMES, threatBar } from './html'

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
  const weapon = live?.gear.weapon
  const choose = live && skillOffers(live).length > 0 ? `<button class="decide" data-ability="${live.id}">Choose ability</button>` : ''
  return `<div class="soldier ${soldier.taken ? 'died' : ''} ${up ? 'levelled' : ''}">
    <div class="who"><span class="portrait">${badge(soldier.cls)}</span><span><b>${soldier.name}</b><br><small>Level ${before}${cls ? ` · ${cls}` : ''}</small></span></div>
    <div class="bar"><div class="fill" style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${healthBar(soldier.hp, soldier.maxHp, live ? soldierStats(run, live).armor : 0)}
    ${weapon ? `<small class="gear ${weapon.rarity}" title="${gearText(weapon)}">${weapon.name}</small>` : ''}
    ${gained > 0 ? `<small class="gained" title="${soldier.earned.map((e) => `${e.label}: +${e.xp}`).join('&#10;')}">+${gained} xp</small>` : ''} ${note}
    ${feats.length > 0 ? `<ul class="notes">${feats.join('')}</ul>` : ''}
    ${choose}
  </div>`
}

/** A hero joining the squad, alone on its screen: who they are, where from, and what they bring. */
export function joined(run: Run, name: string): string {
  const hero = run.soldiers.find((s) => s.name === name)!
  const trait = hero.trait ? TRAITS[hero.trait] : null
  const named = hero.skills.map((id) => `<span class="chip" title="${SKILLS[id].text}">${SKILLS[id].name}</span>`)
  return `<div class="debrief joined">
    <span class="portrait">${badge(hero.cls)}</span>
    <h1 class="down">${hero.name} joins</h1>
    <p>${CLASSES[hero.cls!].name} · level ${level(hero)} · 🌍 ${hero.home?.name ?? ''}</p>
    <p class="feats">${named.join('')}</p>
    ${trait ? `<p><b>${trait.name}</b> <span class="down">${trait.pro}</span> <span class="up">${trait.con}</span></p>` : ''}
    <button class="decide" data-met="report">Continue</button>
  </div>`
}

/** A pop-up over the debrief, `html` inside it. */
export const modal = (html: string) => `<div class="modal"><div class="sheet">${html}</div></div>`

/** Who takes the find at `index`, or sell it: fixed cards, tapped once to compare and again to confirm. */
function takers(run: Run, index: number, armed: string | null): string {
  const gear = run.finds[index]
  const picks = [...gearPicks(run, gear, (soldier) => ({ type: 'equip', find: index, soldier: soldier.id }), 'give it to'), sellPick(gear, index)]
  return `<div class="picks">${picks.map((p) => pickCard(p, armed)).join('')}</div>${pickDetail(picks, armed, 'Tap a soldier to compare; tap again to confirm.')}`
}

/** A crate opened, in a pop-up: it shakes, bursts in its gear's rarity, and the gear rises out of it; then the player picks who takes it. */
export function loot(run: Run, index: number, armed: string | null): string {
  const gear = run.finds[index]
  return modal(`<div class="loot ${gear.rarity}${armed ? ' still' : ''}">
    <div class="burst"></div>
    <span class="box">🎁</span>
    <div class="prize gear ${gear.rarity}">${gearCard(gear, squadKeywords(run))}</div>
    <div class="said">${takers(run, index, armed)}</div>
  </div>`)
}

function title(report: Report): string {
  const name = STOP_NAMES[report.stop]
  if (report.stop === 'supply' || report.stop === 'cache') return `<h1>${name}</h1>`
  return `<h1 class="${report.won ? 'down' : 'up'}">${name} ${report.won ? 'won' : 'lost'}</h1>`
}

/** A skill for a soldier to learn: one of each role its tree has opened, each told by what it does now and nothing after. */
export function skillChoice(run: Run, soldier: Soldier): string {
  const held = squadKeywords(run)
  const card = (id: (typeof soldier.skills)[number], index: number) => button({ type: 'skill', soldier: soldier.id, index }, `<small>${ROLES[SKILLS[id].role]}</small><br><b>${SKILLS[id].name}</b><br>${describe(SKILLS[id].text, SKILLS[id].tags, held)}`, 'card skill')
  return `<h2><b class="supplies">${soldier.name}</b>, ${CLASSES[soldier.cls!].name}, reached level ${soldier.skills.length + 1}. Choose one; each choice opens more of the tree.</h2>
    <div class="choices">${skillOffers(soldier).map(card).join('')}</div>`
}

/** The next choice of the reward phase, alone on its screen: a relic, then each find and who takes it, then each skill owed. */
export function choice(run: Run, armed: string | null = null): string {
  const held = squadKeywords(run)
  const relic = (id: RelicId, index: number) => button({ type: 'relic', index }, `<small>relic</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags, held)}`, 'card relic')
  if (run.relicOffers.length > 0) return `<h2>Alien artifacts lie in the wreckage. The squad can carry one, and keeps it for the run.</h2><div class="choices">${run.relicOffers.map(relic).join('')}</div>`
  if (run.finds.length > 0) {
    const more = run.finds.length > 1 ? ` · ${run.finds.length - 1} more found` : ''
    return `<h2>Gear found. Who takes it?${more}</h2><div class="gear ${run.finds[0].rarity}">${gearCard(run.finds[0], held)}</div>${takers(run, 0, armed)}`
  }
  return skillChoice(run, run.soldiers.find((s) => skillOffers(s).length > 0)!)
}

/** What each soldier did in the battle, a row each, the squad's best in each column but damage taken marked. */
function battleStats(report: Report): string {
  const columns: [string, (t: Tally) => number, string?][] = [
    ['Damage dealt', (t) => t.dealt],
    ['Kills', (t) => t.kills],
    ['Damage taken', (t) => t.taken],
    ['Hits', (t) => t.hits],
    ['Accuracy', (t) => (t.shots > 0 ? Math.round((100 * t.hits) / t.shots) : 0), '%'],
  ]
  const best = columns.map(([name, value]) => (name === 'Damage taken' ? null : Math.max(1, ...report.soldiers.map((s) => value(s.tally)))))
  const rows = report.soldiers.map((s) => `<tr><td><span class="portrait">${badge(s.cls)}</span>${s.name}</td>${columns.map(([, value, unit], i) => `<td class="${value(s.tally) === best[i] ? 'best' : ''}">${value(s.tally)}${unit ?? ''}</td>`).join('')}</tr>`)
  return `<table class="tally"><tr><th></th>${columns.map(([name]) => `<th>${name}</th>`).join('')}</tr>${rows.join('')}</table>`
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
  const all = [...report.soldiers, ...(hero ? [{ id: hero.id, name: hero.name, cls: hero.cls, xpBefore: hero.xp, xpAfter: hero.xp, taken: false, earned: [], feats: [], hp: health(run, hero), maxHp: soldierStats(run, hero).hp, tally: { dealt: 0, kills: 0, taken: 0, shots: 0, hits: 0, feats: [] } }] : [])]
  const crates = run.finds.map((_, i) => `<button class="crate" data-crate="${i}" title="Open">🎁</button>`)
  const squad = report.soldiers.length > 0 ? `<div class="stage second">${battleStats(report)}<div class="squad">${all.map((s) => soldierCard(run, s)).join('')}</div>${crates.length > 0 ? `<div class="crates">${crates.join('')}</div>` : ''}</div>` : ''
  const owed = squad !== '' && (run.finds.length > 0 || run.soldiers.some((s) => skillOffers(s).length > 0))
  return `<div class="debrief${still ? ' still' : ''}">
    ${title(report)}
    <div class="stage">
      <p>Threat ${threatBar(after, Math.max(0, after - before))}${threat}</p>
      ${report.rescued !== null ? `<p class="down">${report.rescued} of ${CIVILIANS} civilians rescued</p>` : ''}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : ''}
      ${report.found ? `<p class="supplies">Found ${CONSUMABLES[report.found].icon} ${CONSUMABLES[report.found].name}: ${CONSUMABLES[report.found].text}</p>` : ''}
    </div>
    ${squad}
    <div class="stage ${squad ? 'third' : 'second'}"><button data-seen="report"${owed ? ' disabled' : ''}>Continue</button></div>
  </div>`
}

export function runEnd(run: Run): string {
  if (run.phase === 'won') return `<h1 class="down">The source is destroyed. Earth is saved.</h1><button id="again">New run</button>`
  return `<h1 class="up">Earth has fallen</h1><h2>Lost: ${STOP_NAMES[run.mission!.kind]}, with ${run.soldiers.length} of ${KEYS + 1} heroes</h2><button id="again">New run</button>`
}
