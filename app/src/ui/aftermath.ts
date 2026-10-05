import { AID, type AidId } from '../core/base'
import { CLASSES } from '../core/classes'
import { RANK_NAMES, RANK_XP, rank, REGIONS, ROUNDS, THREAT_MAX, type Report, type Run } from '../core/run'
import { button, missionTitle, signed } from './html'
import { board } from './overworld'

function aidCard(id: AidId, index: number): string {
  const { name, rarity, text } = AID[id]
  return button({ type: 'pick', index }, `<small>${rarity}</small><br><b>${name}</b><br>${text}`, `card ${rarity}`)
}

/** Meters for the regions whose threat differs between two moments; falling pips are `cleared`, rising ones `landed`. */
function threatMoves(from: number[], to: number[]): string {
  const rows = REGIONS.flatMap((name, i) => {
    if (from[i] === to[i]) return []
    const kept = Math.min(from[i], to[i])
    const meter = `${'■'.repeat(kept)}<span class="cleared">${'■'.repeat(from[i] - kept)}</span><span class="landed">${'■'.repeat(to[i] - kept)}</span>${'□'.repeat(THREAT_MAX - Math.max(from[i], to[i]))}`
    return [`<tr><td>${name}</td><td class="threat">${meter}</td><td class="note">${signed(to[i] - from[i])} threat</td></tr>`]
  })
  return `<table>${rows.join('')}</table>`
}

/** A soldier's card: rank, an experience bar filling toward the next rank, and a promotion, new class, or death. */
function soldierCard(soldier: Report['soldiers'][number]): string {
  const before = rank({ xp: soldier.xpBefore })
  const after = rank({ xp: soldier.xpAfter })
  const span = RANK_XP[before + 1] - RANK_XP[before]
  // At the top rank there is no next threshold and the bar stays full.
  const filled = (xp: number) => (Number.isNaN(span) ? 100 : Math.min(100, (100 * (xp - RANK_XP[before])) / span))
  const cls = soldier.cls && CLASSES[soldier.cls].name
  // A soldier leaves the rookie rank with a class just drawn.
  const promotion = before === 0 && cls ? `Promoted: ${cls}` : `Promoted to ${RANK_NAMES[after]}`
  const badge = soldier.died ? '<b class="up">Killed in action</b>' : after > before ? `<b class="down promoted">${promotion}</b>` : `+${soldier.xpAfter - soldier.xpBefore} experience`
  return `<div class="soldier ${soldier.died ? 'died' : ''}">
    <small>${RANK_NAMES[before]}${before > 0 && cls ? ` · ${cls}` : ''}</small><br><b>${soldier.name}</b>
    <div class="bar"><div class="fill" style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${badge}
  </div>`
}

/** The one screen after a battle, revealed top to bottom: the region, the supplies, the squad, then the aid to take. */
export function missionEnd(run: Run, report: Report): string {
  const last = report.won
    ? `<h2>${REGIONS[run.mission!.region]} offers aid. Take one.</h2><div class="choices">${run.offers.map(aidCard).join('')}</div>`
    : '<button data-seen="mission">Continue</button>'
  return `
    <h1 class="${report.won ? 'down' : 'up'}">Mission ${report.won ? 'won' : 'lost'} · ${missionTitle(run.mission!)}</h1>
    <div class="stage">
      ${threatMoves(report.threat.before, report.threat.afterMission)}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : ''}
    </div>
    <div class="stage second"><h2>Squad</h2><div class="squad">${report.soldiers.map(soldierCard).join('')}</div></div>
    <div class="stage third">${last}</div>`
}

/** Threat each region gained from the strikes left unanswered, capped at what aid taken since has left. */
export function alienAdvance(run: Run, report: Report): number[] {
  return run.threat.map((now, i) => Math.min(Math.max(report.threat.afterAliens[i] - report.threat.afterMission[i], 0), now))
}

/** The screen between a mission and the overworld: what the aliens did elsewhere meanwhile, on the world board. */
export function world(run: Run, report: Report): string {
  const lastStand = run.missions[0]?.kind === 'lastStand' ? `<p class="up stage second"><b>${REGIONS[run.missions[0].region]} is overrun. A last stand is next.</b></p>` : ''
  return `
    <h1 class="up">Meanwhile, the aliens advanced</h1>
    ${board(run, alienAdvance(run, report))}
    ${lastStand}
    <button class="stage second" data-seen="world">Continue</button>`
}

export function runEnd(run: Run): string {
  if (run.phase === 'won') return `<h1 class="down">Earth is saved</h1><button id="again">New run</button>`
  return `<h1 class="up">Earth has fallen</h1><h2>Lost: ${missionTitle(run.mission!)}, round ${Math.min(run.round, ROUNDS)}</h2><button id="again">New run</button>`
}
