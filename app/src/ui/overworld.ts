import { FACILITIES, type FacilityId } from '../core/base'
import { ALIENS, type AlienKind } from '../core/aliens'
import { CLASSES } from '../core/classes'
import { GOALS } from '../core/goals'
import { SLOTS } from '../core/gear'
import { DOCTRINES } from '../core/doctrines'
import { BRIBE, EVENTS, RELIC_PRICE } from '../core/events'
import { RELICS } from '../core/relics'
import { buildCost, built, KEYS, charges, equipped, level, missionAt, nextStop, RISKS, soldierStats, xpFor, squadKeywords, type Mission, type Muster, type Run, type Soldier, type Stop, type Zone } from '../core/run'
import { PATHS, SKILLS, type SkillId } from '../core/skills'
import { TERRAIN_TEXT } from '../core/terrain'
import { alienName, button, describe, gearCard, keywordChips, resistChip, tip, gearText, keyRow, STOP_NAMES, threatBar } from './html'

/** The views between battles, in tab order. */
export const TABS = ['Map', 'Base', 'Barracks'] as const
export type Tab = (typeof TABS)[number]


/** A stop as a chip on the road: its name, and for a fight, its risk and how many aliens. */
function chip(run: Run, stop: Stop, state = ''): string {
  const fight = stop.kind === 'battle' || stop.kind === 'key' || stop.kind === 'final'
  const risk = stop.kind === 'battle' ? `${RISKS[stop.risk].name} ` : ''
  const aliens = fight ? ` · force ${missionAt(run, stop.kind as Mission['kind'], stop.risk, stop.goal).force}${stop.kind === 'battle' ? '' : ', with a boss'}` : ''
  return `<span class="chip ${stop.kind} ${stop.risk} ${state}">${risk}${STOP_NAMES[stop.kind]}${aliens}</span>`
}

/** The aliens of a battle, counted by kind: "3 Troopers, 2 Swarmlings". */
function census(packs: Muster[]): string {
  const counts = new Map<AlienKind, number>()
  for (const kind of packs.flatMap((pack) => pack.kinds)) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  return [...counts].map(([kind, n]) => `${n} ${alienName(kind, `${ALIENS[kind].name}${n === 1 ? '' : 's'}`)}`).join(', ')
}

/** A stop at a fork. A battle shows its risk, goal and place, the aliens it holds, and what it pays. */
function stopRow(stop: Stop): string {
  if (stop.kind !== 'battle') return `<div class="stop ${stop.kind}"><b>${STOP_NAMES[stop.kind]}</b></div>`
  const risk = RISKS[stop.risk]
  const goal = GOALS[stop.goal]
  const rare = risk.rareGear && (stop.goal === 'exterminate' || stop.goal === 'assassinate') ? ', rare or better' : ''
  return `<div class="stop ${stop.risk}"><small>${tip(risk.name, risk.text)} · ${TERRAIN_TEXT[stop.terrain].name}</small><span><b>${tip(goal.name, goal.text)}</b>: ${census(stop.packs)}${stop.goal === 'assassinate' ? ', and a Commander' : ''}</span><small>Pays ${goal.reward}${rare}</small></div>`
}

/** A zone at a fork: each of its stops, and what it costs. Clicking it commits the squad to it. */
function zoneCard(zone: Zone, index: number): string {
  return button({ type: 'zone', index }, `<div class="aliens">${zone.stops.map(stopRow).join('')}</div><small>+${zone.stops.length} threat</small>`, 'zone')
}

/** The words on the button that travels to the next stop. */
function travelLabel(run: Run, stop: Stop, next: NonNullable<ReturnType<typeof nextStop>>): string {
  if (next === 'supply' || next === 'cache') return `Collect the ${STOP_NAMES[next].toLowerCase()}`
  if (next === 'shop') return 'Enter the shop'
  if (next === 'unknown') return 'Find out what lies ahead'
  const mission = missionAt(run, next, stop.risk, next === 'battle' ? stop.goal : 'exterminate')
  const stakes = next === 'lastStand' || next === 'final' ? ' · lose and the run ends' : ''
  return `<b>${STOP_NAMES[next]}</b><br>Alien force ${mission.force}${next === 'key' || next === 'final' ? ', with a boss' : ''}${stakes}`
}

/** What the squad faces at a stop, as the map's heading. */
function where(stop: Stop): string {
  if (stop.kind === 'final') return 'All three keys are won. The alien source is found.'
  if (stop.kind === 'key') return 'The road ends at a satellite. Its access key is guarded.'
  if (stop.kind === 'unknown') return 'The road leads somewhere unknown: a fight, a shop, or something stranger.'
  if (stop.kind === 'shop') return 'The road leads to a shop, where supplies buy facilities, a relic, or a quieter road.'
  if (stop.kind !== 'battle') return `The road leads to a ${STOP_NAMES[stop.kind].toLowerCase()}.`
  return `${GOALS[stop.goal].name}, ${RISKS[stop.risk].name.toLowerCase()} ${TERRAIN_TEXT[stop.terrain].name.toLowerCase()}: ${GOALS[stop.goal].text}`
}

/** A shop: facilities to build, a relic, a bribe, and the way out. */
function shopView(run: Run): string {
  const shop = run.shop!
  const relic = shop.relic
    ? button({ type: 'buy' }, `<small>relic · ${RELIC_PRICE} supplies</small><br><b>${RELICS[shop.relic].name}</b><br>${describe(RELICS[shop.relic].text, RELICS[shop.relic].tags, squadKeywords(run))}`, 'card relic', RELIC_PRICE <= run.supplies)
    : ''
  const bribe = button({ type: 'bribe' }, `<b>Bribe the patrols</b><br>-${BRIBE.threat} threat<br><small>${BRIBE.price} supplies, once</small>`, '', !shop.bribed && BRIBE.price <= run.supplies && run.threat > 0)
  return `<h2>A shop. Facilities improve every soldier for the run; each level costs more.</h2>
    <div class="facilities">${(Object.keys(FACILITIES) as FacilityId[]).map((id) => facilityButton(run, id)).join('')}</div>
    <div class="choices">${relic}${bribe}</div>
    <button class="travel" data-action='${JSON.stringify({ type: 'leave' })}'>Leave the shop</button>`
}

/** An event: its scene, and the ways to meet it. */
function eventView(run: Run): string {
  const event = EVENTS[run.event!]
  const options = event.options.map((option, index) => button({ type: 'choose', index }, option.text, 'card', !option.can || option.can(run)))
  return `<h2><b>${event.name}</b></h2><p>${event.text}</p><div class="choices">${options.join('')}</div>`
}

/** The map: a shop or event being met; at a fork, the three zones to choose from; in a zone, the road through it and a button to travel on. */
function mapView(run: Run): string {
  if (run.phase === 'shop') return shopView(run)
  if (run.phase === 'event') return eventView(run)
  const zone = run.zone
  if (!zone) {
    return `<h2>A fork in the road. Choose a zone; what lies beyond it is unknown.</h2>
      <div class="choices">${run.zones.map((z, i) => zoneCard(z, i)).join('')}</div>`
  }
  const next = nextStop(run)!
  const here = zone.stops[run.stop]
  const road = zone.stops.map((s, i) => chip(run, s, i < run.stop ? 'done' : i === run.stop ? 'here' : '')).join('<span class="arrow">→</span>')
  return `<h2>${where(here)}</h2>
    <div class="road">${road}</div>
    ${next === 'lastStand' ? '<p class="up"><b>The threat is full. The aliens attack before the squad can travel on.</b></p>' : ''}
    <button class="travel ${next}" data-action='${JSON.stringify({ type: 'advance' })}'>${travelLabel(run, here, next)}</button>`
}

/** A facility's next level, buyable when the run has the supplies. */
function facilityButton(run: Run, id: FacilityId): string {
  const { name, text, max } = FACILITIES[id]
  const cost = buildCost(run, id)
  const price = cost === null ? 'fully built' : `${cost} supplies`
  return button({ type: 'build', facility: id }, `<b>${name}</b> ${built(run, id)}/${max}<br>${text}<br><small>${price}</small>`, '', cost !== null && cost <= run.supplies)
}

function baseView(run: Run): string {
  const relics = run.relics.map((id) => `<div class="gear relic"><small>relic</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags)}</div>`)
  const doctrines = run.doctrines.map((id) => `<div class="gear doctrine"><small>doctrine</small><br><b>${DOCTRINES[id].name}</b><br>${DOCTRINES[id].text}</div>`)
  const facilities = (Object.keys(FACILITIES) as FacilityId[]).filter((id) => built(run, id) > 0).map((id) => `<div class="gear"><b>${FACILITIES[id].name}</b> ${built(run, id)}/${FACILITIES[id].max}<br>${FACILITIES[id].text}</div>`)
  const held = squadKeywords(run)
  return `<h2>Facilities are built at shops on the road.</h2>
    ${facilities.length > 0 ? `<div class="stash">${facilities.join('')}</div>` : '<p>None built yet.</p>'}
    ${held.length > 0 ? `<h2>Keywords</h2>${keywordChips(held, held)}` : ''}
    ${doctrines.length > 0 ? `<h2>Doctrines</h2><div class="stash">${doctrines.join('')}</div>` : ''}
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
  const skills = soldier.skills.map((id) => `<p class="described"><b>${SKILLS[id].name}.</b> ${describe(SKILLS[id].text, SKILLS[id].tags)}</p>`)
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
      <span>${run.keys === KEYS ? 'Source' : 'Guardian'} ${resistChip(run.bosses[run.keys])}</span>
      <b class="supplies">${run.supplies} ${run.supplies === 1 ? 'supply' : 'supplies'}</b>
    </div>
    ${views[tab](run)}`
}
