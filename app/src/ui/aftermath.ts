import type { Stats } from '../core/battle'
import { CLASSES } from '../core/classes'
import { CIVILIANS } from '../core/goals'
import { RELICS, type RelicId } from '../core/relics'
import { KEYS, level, SELL, skillOffers, soldierStats, xpFor, type Report, type Run, type Soldier } from '../core/run'
import { PATHS, SKILLS } from '../core/skills'
import { button, gearCard, keyRow, signed, STAT_NAMES, STOP_NAMES, threatBar } from './html'

/** A soldier's card: level, an experience bar filling toward the next level, and a level gained, or that the soldier fell. */
function soldierCard(soldier: Report['soldiers'][number]): string {
  const before = level({ xp: soldier.xpBefore })
  const after = level({ xp: soldier.xpAfter })
  const filled = (xp: number) => Math.min(100, (100 * (xp - xpFor(before))) / (xpFor(before + 1) - xpFor(before)))
  const cls = soldier.cls && CLASSES[soldier.cls].name
  const badge = soldier.downed ? '<b class="up">Downed · cloned anew</b>' : after > before ? `<b class="down promoted">Level ${after}</b>` : `+${soldier.xpAfter - soldier.xpBefore} experience`
  return `<div class="soldier ${soldier.downed ? 'died' : ''}">
    <small>Level ${before}${cls ? ` · ${cls}` : ''}</small><br><b>${soldier.name}</b>
    <div class="bar"><div class="fill" style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${badge}
  </div>`
}

function title(report: Report): string {
  const name = STOP_NAMES[report.stop]
  if (report.stop === 'supply' || report.stop === 'cache') return `<h1>${name}</h1>`
  return `<h1 class="${report.won ? 'down' : 'up'}">${name} ${report.won ? 'won' : 'lost'}</h1>`
}

/** The first find: what its finder wears in the slot beside it, how the finder's stats would change, and the choice to equip or sell. */
function findChoice(run: Run): string {
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
  return `<h2><b>${soldier.name}</b> found ${gear.rarity === 'common' ? 'some' : `${gear.rarity}`} gear${more}</h2>
    <div class="compare">
      <div class="gear ${old?.rarity ?? ''}"><small>Equipped</small><br>${old ? gearCard(old) : `<small>Empty ${gear.slot} slot</small>`}</div>
      <span class="arrow">→</span>
      <div class="gear ${gear.rarity} drop"><small>Found</small><br>${gearCard(gear)}</div>
      ${rows.length > 0 ? `<table class="stats">${rows.join('')}</table>` : ''}
    </div>
    <div class="choices">
      ${button({ type: 'keep' }, `<b>Equip on ${soldier.name}</b>${old ? `<br><small>Sells ${old.name} for ${SELL[old.rarity]}</small>` : ''}`, 'decide')}
      ${button({ type: 'sell' }, `<b>Sell</b><br><small>+${SELL[gear.rarity]} supplies</small>`, 'decide')}
    </div>`
}

/** A skill for a soldier to learn: at the first, one of the class's two paths; after it, one of the path's next pair. */
function skillChoice(soldier: Soldier): string {
  const paths = PATHS[soldier.cls!]
  const path = paths.find((p) => p.core === soldier.skills[0])
  // A path's card also names what it leads to.
  const ahead = (index: number) => (path ? '' : `<small class="ahead">Then ${paths[index].tiers.map((pair) => pair.map((id) => SKILLS[id].name).join(' or ')).join(', then ')}</small>`)
  const card = (id: (typeof soldier.skills)[number], index: number) =>
    button({ type: 'skill', soldier: soldier.id, index }, `<small>${(path ?? paths[index]).name} path</small><br><b>${SKILLS[id].name}</b><br>${SKILLS[id].text}${ahead(index)}`, 'card skill')
  const ask = path ? `Choose one; the other is lost.` : `Choose a path; the other is shut for good.`
  return `<h2><b class="supplies">${soldier.name}, ${CLASSES[soldier.cls!].name}, reached level ${soldier.skills.length + 1}.</b> ${ask}</h2>
    <div class="choices">${skillOffers(soldier).map(card).join('')}</div>`
}

/** The next choice of the reward phase: a relic, then each find, then each skill owed. */
export function choice(run: Run): string {
  const relic = (id: RelicId, index: number) => button({ type: 'relic', index }, `<small>relic</small><br><b>${RELICS[id].name}</b><br>${RELICS[id].text}`, 'card relic')
  if (run.relicOffers.length > 0) return `<h2>Alien artifacts lie in the wreckage. The squad can carry one, and keeps it for the run.</h2><div class="choices">${run.relicOffers.map(relic).join('')}</div>`
  if (run.finds.length > 0) return findChoice(run)
  return skillChoice(run.soldiers.find((s) => skillOffers(s).length > 0)!)
}

/**
 * The one screen after a stop, revealed top to bottom: the threat, what was gained, the squad if it fought,
 * then the next choice it left, or a button to go on.
 */
export function stopReport(run: Run, report: Report): string {
  const { before, after } = report.threat
  const threat = after === before ? '' : `<span class="note">${signed(after - before)}</span>`
  const squad = report.soldiers.length > 0 ? `<div class="stage second"><h2>Squad</h2><div class="squad">${report.soldiers.map(soldierCard).join('')}</div></div>` : ''
  const last = run.phase === 'reward' ? choice(run) : '<button data-seen="report">Continue</button>'
  return `
    ${title(report)}
    <div class="stage">
      <p>Threat ${threatBar(after, Math.max(0, after - before))}${threat}</p>
      ${report.key ? `<p class="keys">Access key won ${keyRow(run.keys)} ${run.keys === KEYS ? 'The alien source is found.' : ''}</p>` : ''}
      ${report.hired ? `<p class="down"><b>A new clone joins the squad: ${report.hired}.</b></p>` : ''}
      ${report.rescued !== null ? `<p class="down">${report.rescued} of ${CIVILIANS} civilians rescued</p>` : ''}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : ''}
    </div>
    ${squad}
    <div class="stage ${squad ? 'third' : 'second'}">${last}</div>`
}

export function runEnd(run: Run): string {
  if (run.phase === 'won') return `<h1 class="down">The source is destroyed. Earth is saved.</h1><button id="again">New run</button>`
  return `<h1 class="up">Earth has fallen</h1><h2>Lost: ${STOP_NAMES[run.mission!.kind]}, with ${run.keys} of ${KEYS} keys</h2><button id="again">New run</button>`
}
