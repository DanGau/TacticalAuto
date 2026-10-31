import type { Stats } from '../core/battle'
import { CLASSES } from '../core/classes'
import { FEATS, type Tally } from '../core/feats'
import { CIVILIANS } from '../core/goals'
import { RELICS, type RelicId } from '../core/relics'
import { CONSUMABLES } from '../core/consumables'
import { health, KEYS, level, SELL, skillOffers, soldierStats, xpFor, squadKeywords, type Report, type Run, type Soldier } from '../core/run'
import { PATHS, SKILLS } from '../core/skills'
import { TRAITS } from '../core/traits'
import { badge, button, describe, gearCard, gearText, healthBar, signed, STAT_NAMES, STOP_NAMES, threatBar } from './html'

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
  const path = PATHS[hero.cls!].find((p) => p.core === hero.skills[0])
  const trait = hero.trait ? TRAITS[hero.trait] : null
  const named = hero.skills.map((id) => `<span class="chip" title="${SKILLS[id].text}">${SKILLS[id].name}</span>`)
  return `<div class="debrief joined">
    <span class="portrait">${badge(hero.cls)}</span>
    <h1 class="down">${hero.name} joins</h1>
    <p>${CLASSES[hero.cls!].name}${path ? ` · ${path.name}` : ''} · level ${level(hero)} · 🌍 ${hero.home?.name ?? ''}</p>
    <p class="feats">${named.join('')}</p>
    ${trait ? `<p><b>${trait.name}</b> <span class="down">${trait.pro}</span> <span class="up">${trait.con}</span></p>` : ''}
    <button class="decide" data-met="report">Continue</button>
  </div>`
}

/** A pop-up over the debrief, `html` inside it. */
export const modal = (html: string) => `<div class="modal"><div class="sheet">${html}</div></div>`

/**
 * Who takes the find at `index`: a card per soldier showing what it wears in the slot, which the find replaces and
 * sells, and how its stats would change; or sell the find.
 */
function takers(run: Run, index: number): string {
  const gear = run.finds[index]
  const paid = (n: number) => (n > 0 ? `<b class="supplies">+${n}</b>` : '')
  const card = (soldier: Soldier) => {
    const old = soldier.gear[gear.slot]
    const now = soldierStats(run, soldier)
    const then = soldierStats(run, { ...soldier, gear: { ...soldier.gear, [gear.slot]: gear } })
    const rows = (Object.keys(now) as (keyof Stats)[]).filter((key) => now[key] !== then[key]).map((key) => {
      const show = (n: number) => (key === 'aim' || key === 'crit' || key === 'close' ? `${Math.round(100 * n)}%` : `${n}`)
      return `<tr><td>${STAT_NAMES[key]}</td><td>${show(now[key])}</td><td>→</td><td class="${then[key] > now[key] ? 'down' : 'up'}">${show(then[key])}</td></tr>`
    })
    const body = `<span class="who"><span class="portrait">${badge(soldier.cls)}</span><b>${soldier.name}</b></span>
      <small title="${old ? gearText(old) : ''}">${old ? `Replaces ${old.name}` : `Empty ${gear.slot} slot`} ${paid(old ? SELL[old.rarity] : 0)}</small>
      ${rows.length > 0 ? `<table class="stats">${rows.join('')}</table>` : ''}`
    return button({ type: 'equip', find: index, soldier: soldier.id }, body, 'gearpick')
  }
  return `<div class="choices">${run.soldiers.map(card).join('')}${button({ type: 'sell', find: index }, `<b>Sell</b> ${paid(SELL[gear.rarity])}`, 'gearpick sell')}</div>`
}

/** A crate opened, in a pop-up: it shakes, bursts in its gear's rarity, and the gear rises out of it; then the player picks who takes it. */
export function loot(run: Run, index: number): string {
  const gear = run.finds[index]
  return modal(`<div class="loot ${gear.rarity}">
    <div class="burst"></div>
    <span class="box">🎁</span>
    <div class="prize gear ${gear.rarity}">${gearCard(gear, squadKeywords(run))}</div>
    <div class="said">${takers(run, index)}</div>
  </div>`)
}

function title(report: Report): string {
  const name = STOP_NAMES[report.stop]
  if (report.stop === 'supply' || report.stop === 'cache') return `<h1>${name}</h1>`
  return `<h1 class="${report.won ? 'down' : 'up'}">${name} ${report.won ? 'won' : 'lost'}</h1>`
}

/** The first find on a screen of its own, and who takes it. */
function findChoice(run: Run): string {
  const more = run.finds.length > 1 ? ` · ${run.finds.length - 1} more found` : ''
  return `<h2>Gear found. Who takes it?${more}</h2><div class="gear ${run.finds[0].rarity}">${gearCard(run.finds[0], squadKeywords(run))}</div>${takers(run, 0)}`
}

/** A skill for a soldier to learn: one of its path's next pair, each told by what it does now and nothing after. */
export function skillChoice(run: Run, soldier: Soldier): string {
  const held = squadKeywords(run)
  const path = PATHS[soldier.cls!].find((p) => p.core === soldier.skills[0])!
  const card = (id: (typeof soldier.skills)[number], index: number) => button({ type: 'skill', soldier: soldier.id, index }, `<b>${SKILLS[id].name}</b><br>${describe(SKILLS[id].text, SKILLS[id].tags, held)}`, 'card skill')
  return `<h2><b class="supplies">${soldier.name}</b>, ${path.name} ${CLASSES[soldier.cls!].name}, reached level ${soldier.skills.length + 1}. Choose one; the other is lost.</h2>
    <div class="choices">${skillOffers(soldier).map(card).join('')}</div>`
}

/** The next choice of the reward phase, alone on its screen: a relic, then each find, then each skill owed. */
export function choice(run: Run): string {
  const held = squadKeywords(run)
  const relic = (id: RelicId, index: number) => button({ type: 'relic', index }, `<small>relic</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags, held)}`, 'card relic')
  if (run.relicOffers.length > 0) return `<h2>Alien artifacts lie in the wreckage. The squad can carry one, and keeps it for the run.</h2><div class="choices">${run.relicOffers.map(relic).join('')}</div>`
  if (run.finds.length > 0) return findChoice(run)
  return skillChoice(run, run.soldiers.find((s) => skillOffers(s).length > 0)!)
}

/** What each soldier did in the battle, a row each, the squad's best in each column but damage taken marked. */
export function battleStats(report: Report): string {
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
