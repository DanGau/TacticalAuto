import { AID, type AidId } from '../core/base'
import { CLASSES } from '../core/classes'
import { KEYS, RANK_NAMES, RANK_XP, rank, type Report, type Run } from '../core/run'
import { button, gearCard, keyRow, signed, STOP_NAMES, threatBar } from './html'

function aidCard(id: AidId, index: number): string {
  const { name, rarity, text } = AID[id]
  return button({ type: 'pick', index }, `<small>${rarity}</small><br><b>${name}</b><br>${text}`, `card ${rarity}`)
}

/** A soldier's card: rank, an experience bar filling toward the next rank, and a promotion, or that the soldier fell. */
function soldierCard(soldier: Report['soldiers'][number]): string {
  const before = rank({ xp: soldier.xpBefore })
  const after = rank({ xp: soldier.xpAfter })
  const span = RANK_XP[before + 1] - RANK_XP[before]
  // At the top rank there is no next threshold and the bar stays full.
  const filled = (xp: number) => (Number.isNaN(span) ? 100 : Math.min(100, (100 * (xp - RANK_XP[before])) / span))
  const cls = soldier.cls && CLASSES[soldier.cls].name
  const badge = soldier.downed ? '<b class="up">Downed · cloned anew</b>' : after > before ? `<b class="down promoted">Promoted to ${RANK_NAMES[after]}</b>` : `+${soldier.xpAfter - soldier.xpBefore} experience`
  return `<div class="soldier ${soldier.downed ? 'died' : ''}">
    <small>${RANK_NAMES[before]}${cls ? ` · ${cls}` : ''}</small><br><b>${soldier.name}</b>
    <div class="bar"><div class="fill" style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${badge}
  </div>`
}

function title(report: Report): string {
  const name = STOP_NAMES[report.stop]
  if (report.stop === 'supply' || report.stop === 'cache') return `<h1>${name}</h1>`
  return `<h1 class="${report.won ? 'down' : 'up'}">${name} ${report.won ? 'won' : 'lost'}</h1>`
}

/**
 * The one screen after a stop, revealed top to bottom: the threat, what was gained, the squad if it fought,
 * then the aid to take after a won battle, or a button to go on.
 */
export function stopReport(run: Run, report: Report): string {
  const { before, after } = report.threat
  const threat = after === before ? '' : `<span class="note">${signed(after - before)}</span>`
  const squad = report.soldiers.length > 0 ? `<div class="stage second"><h2>Squad</h2><div class="squad">${report.soldiers.map(soldierCard).join('')}</div></div>` : ''
  const last = run.phase === 'reward' ? `<h2>The survivors offer aid. Take one.</h2><div class="choices">${run.offers.map(aidCard).join('')}</div>` : '<button data-seen="report">Continue</button>'
  return `
    ${title(report)}
    <div class="stage">
      <p>Threat ${threatBar(after, Math.max(0, after - before))}${threat}</p>
      ${report.key ? `<p class="keys">Access key won ${keyRow(run.keys)} ${run.keys === KEYS ? 'The alien source is found.' : ''}</p>` : ''}
      ${report.hired ? `<p class="down"><b>A new clone joins the squad: ${report.hired}.</b></p>` : ''}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : ''}
      ${report.gear.length > 0 ? `<h2>Recovered. Equip it in the Barracks.</h2><div class="drops">${report.gear.map((gear) => `<div class="gear ${gear.rarity} drop">${gearCard(gear)}</div>`).join('')}</div>` : ''}
    </div>
    ${squad}
    <div class="stage ${squad ? 'third' : 'second'}">${last}</div>`
}

export function runEnd(run: Run): string {
  if (run.phase === 'won') return `<h1 class="down">The source is destroyed. Earth is saved.</h1><button id="again">New run</button>`
  return `<h1 class="up">Earth has fallen</h1><h2>Lost: ${STOP_NAMES[run.mission!.kind]}, with ${run.keys} of ${KEYS} keys</h2><button id="again">New run</button>`
}
