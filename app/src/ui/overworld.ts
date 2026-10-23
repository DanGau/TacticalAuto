import { FACILITIES, type FacilityId } from '../core/base'
import { ALIENS, type AlienKind } from '../core/aliens'
import { CLASSES } from '../core/classes'
import { GOALS } from '../core/goals'
import { KEYWORDS, RESISTS } from '../core/keywords'
import { SLOTS } from '../core/gear'
import { RELICS } from '../core/relics'
import { buildCost, built, KEYS, charges, equipped, level, missionAt, nextStop, RISKS, soldierStats, xpFor, squadKeywords, type Muster, type Run, type Soldier, type StopKind, type Zone } from '../core/run'
import { PATHS, SKILLS, type SkillId } from '../core/skills'
import { TERRAIN_TEXT } from '../core/terrain'
import { button, gearCard, keywordChips, gearText, keyRow, STOP_NAMES, threatBar } from './html'

/** The views between battles, in tab order. */
export const TABS = ['Map', 'Base', 'Barracks'] as const
export type Tab = (typeof TABS)[number]


/** A stop as a chip on the road: its name, and for a fight, how many aliens. */
function chip(run: Run, zone: Zone, stop: StopKind, state = ''): string {
  const fight = stop === 'battle' || stop === 'key' || stop === 'final'
  const aliens = fight ? ` · force ${missionAt(run, stop, zone.risk).force}${stop === 'battle' ? '' : ', with a boss'}` : ''
  return `<span class="chip ${stop} ${state}">${STOP_NAMES[stop]}${aliens}</span>`
}

/** The aliens of a battle, counted by kind: "3 Troopers, 2 Swarmlings". */
function census(packs: Muster[]): string {
  const counts = new Map<AlienKind, number>()
  for (const kind of packs.flatMap((pack) => pack.kinds)) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  return [...counts].map(([kind, n]) => `${n} ${ALIENS[kind].name}${n === 1 ? '' : 's'}${ALIENS[kind].resists.map((r) => ` <span class="kw ${r}" title="${RESISTS[r]}">no ${KEYWORDS[r].name}</span>`).join('')}`).join(', ')
}

/** A zone at a fork: its goal and risk, each stop with the aliens it holds, and what it costs and pays. Clicking it commits the squad to it. */
function zoneCard(zone: Zone, index: number): string {
  const risk = RISKS[zone.risk]
  const goal = GOALS[zone.goal]
  const stops = zone.stops.map((stop, i) => `<div>${STOP_NAMES[stop]}${stop === 'battle' ? `: ${census(zone.packs[i])}${zone.goal === 'assassinate' ? ', and a Commander with a Trooper' : ''}` : ''}</div>`)
  return button(
    { type: 'zone', index },
    `<small>${risk.name} · ${TERRAIN_TEXT[zone.terrain].name}</small><br><b>${goal.name}</b>
    <small>${goal.text}</small>
    <div class="aliens">${stops.join('')}</div>
    <small>Pays ${goal.reward}${risk.rareGear && (zone.goal === 'exterminate' || zone.goal === 'assassinate') ? ', rare or better' : ''}</small><small>+${zone.stops.length} threat</small>`,
    `zone ${zone.risk}`,
  )
}

/** The words on the button that travels to the next stop. */
function travelLabel(run: Run, zone: Zone, stop: NonNullable<ReturnType<typeof nextStop>>): string {
  if (stop === 'supply' || stop === 'cache') return `Collect the ${STOP_NAMES[stop].toLowerCase()}`
  const mission = missionAt(run, stop, zone.risk)
  const stakes = stop === 'lastStand' || stop === 'final' ? ' · lose and the run ends' : ''
  return `<b>${STOP_NAMES[stop]}</b><br>Alien force ${mission.force}${stop === 'key' || stop === 'final' ? ', with a boss' : ''}${stakes}`
}

/** The map: at a fork, the three zones to choose from; in a zone, the road through it and a button to travel on. */
function mapView(run: Run): string {
  const zone = run.zone
  if (!zone) {
    return `<h2>A fork in the road. Choose a zone; what lies beyond it is unknown.</h2>
      <div class="choices">${run.zones.map((z, i) => zoneCard(z, i)).join('')}</div>`
  }
  const stop = nextStop(run)!
  const road = zone.stops.map((s, i) => chip(run, zone, s, i < run.stop ? 'done' : i === run.stop ? 'here' : '')).join('<span class="arrow">→</span>')
  const where = zone.stops[0] === 'final' ? 'All three keys are won. The alien source is found.' : zone.stops[0] === 'key' ? 'The road ends at a satellite. Its access key is guarded.' : `${GOALS[zone.goal].name}, ${RISKS[zone.risk].name.toLowerCase()} ${TERRAIN_TEXT[zone.terrain].name.toLowerCase()}: ${GOALS[zone.goal].text}`
  return `<h2>${where}</h2>
    <div class="road">${road}</div>
    ${stop === 'lastStand' ? '<p class="up"><b>The threat is full. The aliens attack before the squad can travel on.</b></p>' : ''}
    <button class="travel ${stop}" data-action='${JSON.stringify({ type: 'advance' })}'>${travelLabel(run, zone, stop)}</button>`
}

/** A facility's next level, buyable when the run has the supplies. */
function facilityButton(run: Run, id: FacilityId): string {
  const { name, text, max } = FACILITIES[id]
  const cost = buildCost(run, id)
  const price = cost === null ? 'fully built' : `${cost} supplies`
  return button({ type: 'build', facility: id }, `<b>${name}</b> ${built(run, id)}/${max}<br>${text}<br><small>${price}</small>`, '', cost !== null && cost <= run.supplies)
}

function baseView(run: Run): string {
  const relics = run.relics.map((id) => `<div class="gear relic"><small>relic</small><br><b>${RELICS[id].name}</b><br>${RELICS[id].text}${keywordChips(RELICS[id].tags)}</div>`)
  const held = squadKeywords(run)
  return `<h2>Facilities improve every soldier. Each level costs more.</h2>
    <div class="facilities">${(Object.keys(FACILITIES) as FacilityId[]).map((id) => facilityButton(run, id)).join('')}</div>
    ${held.length > 0 ? `<h2>The squad's keywords. Relics, gear and skills that share one work together.</h2>${held.map((k) => `<p>${keywordChips([k], held)} ${KEYWORDS[k].text}.</p>`).join('')}` : ''}
    ${relics.length > 0 ? `<h2>Relics</h2><div class="stash">${relics.join('')}</div>` : ''}`
}

/** A soldier's card, kept short: level, class, name, experience, and three gear slots. Clicking it opens the soldier's details. */
function soldierCard(soldier: Soldier, open: number | null): string {
  const r = level(soldier)
  const cls = soldier.cls && CLASSES[soldier.cls]
  const filled = (100 * (soldier.xp - xpFor(r))) / (xpFor(r + 1) - xpFor(r))
  const slots = SLOTS.map((slot) => {
    const gear = soldier.gear[slot]
    return `<div class="slot gear ${gear?.rarity ?? ''}" title="${gear ? gearText(gear) : ''}">${gear ? `<b>${gear.name}</b>` : `<small>Empty ${slot} slot</small>`}</div>`
  })
  return `<button class="soldier who ${open === soldier.id ? 'chosen' : ''}" data-open="${soldier.id}">
    <small>Level ${r}${cls ? ` · ${cls.name}` : ''}</small><br><b>${soldier.name}</b>
    <div class="bar"><div style="width: ${filled}%"></div></div>
    ${slots.join('')}
  </button>`
}

/** The class's two paths, each skill marked learned, lost, or still ahead. */
function pathTree(soldier: Soldier): string {
  const paths = PATHS[soldier.cls!]
  const taken = paths.find((p) => p.core === soldier.skills[0])
  const mark = (id: SkillId, lost: boolean) => {
    const state = soldier.skills.includes(id) ? 'learned' : lost ? 'lost' : ''
    return `<span class="chip ${state}" title="${SKILLS[id].text}">${SKILLS[id].name}</span>`
  }
  return paths.map((path) => {
    const shut = !!taken && taken !== path
    const tiers = path.tiers.map((pair, i) => {
      const decided = soldier.skills.length > i + 1
      return pair.map((id) => mark(id, shut || decided)).join(' or ')
    })
    return `<p><b class="${shut ? 'lost' : ''}">${path.name}</b> ${[mark(path.core, shut), ...tiers].join('<span class="arrow">→</span>')}</p>`
  }).join('')
}

/** Everything about one soldier: progress, stats, how the class fights, its skills and paths, and what the gear does. */
function details(run: Run, soldier: Soldier): string {
  const r = level(soldier)
  const cls = soldier.cls && CLASSES[soldier.cls]
  const stats = soldierStats(run, soldier)
  const skills = soldier.skills.map((id) => `<p><b>${SKILLS[id].name}.</b> ${SKILLS[id].text}. ${keywordChips(SKILLS[id].tags)}</p>`)
  const uses = charges(run, soldier)
  const gear = equipped(soldier).map((g) => `<div class="gear ${g.rarity}">${gearCard(g)}</div>`)
  const toNext = xpFor(r + 1) - soldier.xp
  return `<h2>${soldier.name} · ${toNext} more ${toNext === 1 ? 'battle' : 'battles'} to level ${r + 1}</h2>
    <div class="details">
      <table class="stats">
        <tr><td>Health</td><td>${stats.hp}</td><td>Armor</td><td>${stats.armor}</td></tr>
        <tr><td>Aim</td><td>${Math.round(100 * stats.aim)}%</td><td>Crit</td><td>${Math.round(100 * stats.crit)}%</td></tr>
        <tr><td>Damage</td><td>${stats.damage}</td><td>Range</td><td>${stats.range}</td></tr>
        <tr><td>Move</td><td>${stats.move}</td><td></td><td></td></tr>
      </table>
      <div>${cls ? `<p>${cls.stanceText}.</p><p><b>${cls.abilityName}${uses > 0 ? ` ×${uses}` : ''}.</b> ${cls.abilityText}.</p>` : ''}${skills.join('')}${cls ? pathTree(soldier) : ''}</div>
      ${gear.join('')}
    </div>`
}

/** The squad as short cards, and below them the details of the soldier opened. */
function barracksView(run: Run, open: number | null): string {
  const soldier = run.soldiers.find((s) => s.id === open)
  return `<div class="squad">${run.soldiers.map((s) => soldierCard(s, open)).join('')}</div>${soldier ? details(run, soldier) : '<h2>Click a soldier for details. Gear is equipped when found.</h2>'}`
}

/**
 * The screen between stops: a header with the keys, threat, supplies and tabs, over the chosen tab's view.
 * `open` is the soldier opened in the Barracks.
 */
export function overworld(run: Run, tab: Tab, open: number | null): string {
  const views = { Map: mapView, Base: baseView, Barracks: (r: Run) => barracksView(r, open) }
  const tabs = TABS.map((name) => `<button class="tab ${name === tab ? 'active' : ''}" data-tab="${name}">${name}</button>`)
  return `
    <div class="header">
      <div class="tabs">${tabs.join('')}</div>
      <span>Keys ${keyRow(run.keys)}</span>
      <span>Threat ${threatBar(run.threat)}</span>
      <span title="${RESISTS[run.bosses[run.keys]]}">${run.keys === KEYS ? 'Source' : 'Guardian'} <span class="kw ${run.bosses[run.keys]}">no ${KEYWORDS[run.bosses[run.keys]].name}</span></span>
      <b class="supplies">${run.supplies} ${run.supplies === 1 ? 'supply' : 'supplies'}</b>
    </div>
    ${views[tab](run)}`
}
