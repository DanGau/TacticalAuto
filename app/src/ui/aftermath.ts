import type { Stats } from '../core/battle'
import { CLASSES, type ClassId } from '../core/classes'
import { FEATS } from '../core/feats'
import { CIVILIANS } from '../core/goals'
import { RELICS, type RelicId } from '../core/relics'
import { KEYS, level, SELL, skillOffers, soldierStats, xpFor, squadKeywords, type Report, type Run, type Soldier } from '../core/run'
import { PATHS, SKILLS } from '../core/skills'
import { button, describe, gearCard, gearText, keyRow, signed, STAT_NAMES, STOP_NAMES, threatBar } from './html'

/** Each class's badge; a soldier not yet promoted wears a helmet. */
const BADGES: Record<ClassId, string> = { assault: '🔫', heavy: '🚀', sniper: '🎯', support: '⛑️', engineer: '🔧' }

/**
 * A soldier's card: class badge, name, and an experience bar filling with what the battle earned, flaring on a level
 * gained; gear the soldier chose to wear drops onto it; feats first pulled off below. Hovering a note tells it.
 */
function soldierCard(run: Run, soldier: Report['soldiers'][number]): string {
  const before = level({ xp: soldier.xpBefore })
  const after = level({ xp: soldier.xpAfter })
  const filled = (xp: number) => Math.min(100, (100 * (xp - xpFor(before))) / (xpFor(before + 1) - xpFor(before)))
  const cls = soldier.cls && CLASSES[soldier.cls].name
  const gained = soldier.xpAfter - soldier.xpBefore
  const up = after > before && !soldier.downed
  const badge = soldier.downed ? '<b class="up">Downed · cloned anew</b>' : up ? `<b class="down promoted">Level ${after}!</b>` : ''
  const worn = run.decisions.filter((d) => d.soldier === soldier.name && d.kept).map((d) => `<div class="gear won ${d.gear.rarity}" title="${gearText(d.gear)}&#10;${d.line}"><small>${d.gear.slot}</small> <b>${d.gear.name}</b></div>`)
  const feats = soldier.feats.map((id) => `<li class="feat" title="${FEATS[id].text}">★ ${FEATS[id].name}</li>`)
  return `<div class="soldier ${soldier.downed ? 'died' : ''} ${up ? 'levelled' : ''}">
    <div class="who"><span class="portrait">${soldier.cls ? BADGES[soldier.cls] : '🪖'}</span><span><b>${soldier.name}</b><br><small>Level ${before}${cls ? ` · ${cls}` : ''}</small></span></div>
    <div class="bar"><div class="fill" style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${gained > 0 ? `<small class="gained" title="${soldier.earned.map((e) => `${e.label}: +${e.xp}`).join('&#10;')}">+${gained} xp</small>` : ''} ${badge}
    ${worn.join('')}
    ${feats.length > 0 ? `<ul class="notes">${feats.join('')}</ul>` : ''}
  </div>`
}

/** Finds sold off, each a line paying out its supplies. */
function sales(run: Run): string {
  const sold = run.decisions.filter((d) => !d.kept)
  return sold.length > 0 ? `<div class="sales">${sold.map(({ gear, line }) => `<p class="sold" title="${line}">🪙 Sold <span class="${gear.rarity}">${gear.name}</span> <b class="supplies chaching" style="--paid: ${SELL[gear.rarity]}"></b></p>`).join('')}</div>` : ''
}

function title(report: Report): string {
  const name = STOP_NAMES[report.stop]
  if (report.stop === 'supply' || report.stop === 'cache') return `<h1>${name}</h1>`
  return `<h1 class="${report.won ? 'down' : 'up'}">${name} ${report.won ? 'won' : 'lost'}</h1>`
}

/**
 * The first find: what its finder wears beside it, each a card to pick, with the supplies its pick sells the other for;
 * the found card shows how the finder's stats would change. A button confirms the pick.
 */
function findChoice(run: Run, pick: 'keep' | 'sell' | null): string {
  const { soldier: id, gear } = run.finds[0]
  const soldier = run.soldiers.find((s) => s.id === id)!
  const old = soldier.gear[gear.slot]
  const now = soldierStats(run, soldier)
  const then = soldierStats(run, { ...soldier, gear: { ...soldier.gear, [gear.slot]: gear } })
  const rows = (Object.keys(now) as (keyof Stats)[]).filter((key) => now[key] !== then[key]).map((key) => {
    const show = (n: number) => (key === 'aim' || key === 'crit' || key === 'close' ? `${Math.round(100 * n)}%` : `${n}`)
    const delta = then[key] - now[key]
    return `<tr><td>${STAT_NAMES[key]}</td><td>${show(now[key])}</td><td>→</td><td class="${delta > 0 ? 'down' : 'up'}">${show(then[key])}</td></tr>`
  })
  const more = run.finds.length > 1 ? ` · ${run.finds.length - 1} more found` : ''
  const gain = { keep: old ? SELL[old.rarity] : 0, sell: SELL[gear.rarity] }
  const paid = (n: number) => `<b class="supplies">+${n} ${n === 1 ? 'supply' : 'supplies'}</b>`
  const card = (choice: 'keep' | 'sell', head: string, body: string) =>
    `<button class="gearpick ${pick === choice ? 'on' : ''}" data-gear="${choice}">${head}${body}<div class="gain">${paid(gain[choice])}</div></button>`
  const keeps = card('sell', `<small>Keep what ${soldier.name} wears</small>`, `<div class="gear ${old?.rarity ?? ''}">${old ? gearCard(old) : `<small>Empty ${gear.slot} slot</small>`}</div><small>Sells the find</small>`)
  const takes = card('keep', `<small>Equip the find</small>`, `<div class="gear ${gear.rarity}">${gearCard(gear, squadKeywords(run))}</div>${rows.length > 0 ? `<table class="stats">${rows.join('')}</table>` : ''}<small>${old ? `Sells ${old.name}` : 'Nothing to sell'}</small>`)
  const confirm = pick === null ? 'Pick one' : pick === 'keep' ? `Equip ${gear.name} · ${paid(gain.keep)}` : `Keep ${old?.name ?? 'the slot empty'} · ${paid(gain.sell)}`
  return `<h2><b>${soldier.name}</b> found ${gear.rarity} gear as good as theirs and can't decide. <i>"You pick, boss."</i>${more}</h2>
    <div class="choices">${keeps}${takes}</div>
    ${button({ type: pick ?? 'keep' }, `<b>${confirm}</b>`, 'decide', pick !== null)}`
}

/** Finds their finders decided alone: who, what, worn or sold, and what they said. */
export function decisions(run: Run): string {
  return run.decisions
    .map(({ soldier, gear, kept, line }) => `<p class="decision"><b>${soldier}</b> ${kept ? 'wears' : 'sells'} the <span class="${gear.rarity}" title="${gearText(gear)}">${gear.rarity} ${gear.name}</span>${kept ? '' : ` for ${SELL[gear.rarity]} supplies`}. <i>${line}</i></p>`)
    .join('')
}

/** A skill for a soldier to learn: one of its path's next pair, each told by what it does now and nothing after. */
function skillChoice(run: Run, soldier: Soldier): string {
  const held = squadKeywords(run)
  const path = PATHS[soldier.cls!].find((p) => p.core === soldier.skills[0])!
  const card = (id: (typeof soldier.skills)[number], index: number) => button({ type: 'skill', soldier: soldier.id, index }, `<b>${SKILLS[id].name}</b><br>${describe(SKILLS[id].text, SKILLS[id].tags, held)}`, 'card skill')
  return `<h2><b class="supplies">${soldier.name}</b>, ${path.name} ${CLASSES[soldier.cls!].name}, reached level ${soldier.skills.length + 1}. Choose one; the other is lost.</h2>
    <div class="choices">${skillOffers(soldier).map(card).join('')}</div>`
}

/** The next choice of the reward phase, alone on its screen: a relic, then each find, then each skill owed. */
export function choice(run: Run, pick: 'keep' | 'sell' | null = null): string {
  const held = squadKeywords(run)
  const relic = (id: RelicId, index: number) => button({ type: 'relic', index }, `<small>relic</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags, held)}`, 'card relic')
  if (run.relicOffers.length > 0) return `<h2>Alien artifacts lie in the wreckage. The squad can carry one, and keeps it for the run.</h2><div class="choices">${run.relicOffers.map(relic).join('')}</div>`
  if (run.finds.length > 0) return findChoice(run, pick)
  return skillChoice(run, run.soldiers.find((s) => skillOffers(s).length > 0)!)
}

/**
 * The summary after a stop, once its choices are made, revealed top to bottom: the threat, what was gained, the squad
 * if it fought, and a button to go on.
 */
export function stopReport(run: Run, report: Report): string {
  const { before, after } = report.threat
  const threat = after === before ? '' : `<span class="note">${signed(after - before)}</span>`
  const squad = report.soldiers.length > 0 ? `<div class="stage second"><div class="squad">${report.soldiers.map((s) => soldierCard(run, s)).join('')}</div>${sales(run)}</div>` : ''
  return `<div class="debrief">
    ${title(report)}
    <div class="stage">
      <p>Threat ${threatBar(after, Math.max(0, after - before))}${threat}</p>
      ${report.key ? `<p class="keys">Access key won ${keyRow(run.keys)} ${run.keys === KEYS ? 'The alien source is found.' : ''}</p>` : ''}
      ${report.hired ? `<p class="down"><b>A new clone joins the squad: ${report.hired}.</b></p>` : ''}
      ${report.rescued !== null ? `<p class="down">${report.rescued} of ${CIVILIANS} civilians rescued</p>` : ''}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : report.supplies < 0 ? `<p class="up">${report.supplies} supplies for the soldiers downed</p>` : ''}
      ${squad ? '' : decisions(run)}
    </div>
    ${squad}
    <div class="stage ${squad ? 'third' : 'second'}"><button data-seen="report">Continue</button></div>
  </div>`
}

export function runEnd(run: Run): string {
  if (run.phase === 'won') return `<h1 class="down">The source is destroyed. Earth is saved.</h1><button id="again">New run</button>`
  return `<h1 class="up">Earth has fallen</h1><h2>Lost: ${STOP_NAMES[run.mission!.kind]}, with ${run.keys} of ${KEYS} keys</h2><button id="again">New run</button>`
}
