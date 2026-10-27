import { ALIENS, DANGERS, type AlienKind } from '../core/aliens'
import { CLASSES } from '../core/classes'
import { GOALS } from '../core/goals'
import { SLOTS } from '../core/gear'
import { DOCTRINES } from '../core/doctrines'
import { BRIBE, EVENTS, RELIC_PRICE } from '../core/events'
import { RELICS, type Relic } from '../core/relics'
import { FORKS, GEAR_PRICE, KEYS, ZONE_STOPS, charges, equipped, level, missionAt, nextStop, RISKS, soldierStats, xpFor, squadKeywords, type Muster, type Run, type Soldier, type Stop, type Zone } from '../core/run'
import { FEATS } from '../core/feats'
import { PATHS, SKILLS } from '../core/skills'
import { TERRAIN_TEXT } from '../core/terrain'
import { TWISTS, type Twist } from '../core/twists'
import { decisions } from './aftermath'
import { alienName, button, describe, gearCard, keywordChips, resistChip, gearText, keyRow, STOP_NAMES, threatBar } from './html'

/** The views between battles, in tab order. */
export const TABS = ['Map', 'Base', 'Barracks'] as const
export type Tab = (typeof TABS)[number]


/** The aliens of a zone, counted by kind with a recon uplink, "3 Troopers, 2 Swarmlings"; else by danger, "3 small, 2 medium". */
function census(run: Run, packs: Muster[]): string {
  const kinds = packs.flatMap((pack) => pack.kinds)
  if (run.relics.some((id) => (RELICS[id] as Relic).recon)) {
    const counts = new Map<AlienKind, number>()
    for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
    return [...counts].map(([kind, n]) => `${n} ${alienName(kind, `${ALIENS[kind].name}${n === 1 ? '' : 's'}`)}`).join(', ')
  }
  return DANGERS.flatMap((danger) => {
    const n = kinds.filter((kind) => ALIENS[kind].danger === danger).length
    return n > 0 ? [`${n} ${danger}`] : []
  }).join(', ')
}

const STOP_ICONS: Record<Stop['kind'], string> = { battle: '⚔️', supply: '📦', cache: '🎁', shop: '🛒', unknown: '❓', key: '🛰️', final: '👁️' }

/** A twist told in a sentence, or nothing. */
const twistLine = (twist: Twist | null) => (twist ? ` ${TWISTS[twist].icon} ${TWISTS[twist].name}: ${TWISTS[twist].text}.` : '')

/**
 * A stop as an icon; a battle's is coloured by its risk and marked by its twist, and hovering tells its goal, place, pay and twist.
 * `state` is done, here, or empty for ahead.
 */
function stopIcon(stop: Stop, state = ''): string {
  if (stop.kind !== 'battle') return `<span class="node ${stop.kind} ${state}" title="${STOP_NAMES[stop.kind]}">${STOP_ICONS[stop.kind]}</span>`
  const risk = RISKS[stop.risk]
  const goal = GOALS[stop.goal]
  return `<span class="node ${stop.risk} ${state}" title="${risk.name} ${goal.name}, ${TERRAIN_TEXT[stop.terrain].name}: pays ${goal.reward}.${twistLine(stop.twist)}">${STOP_ICONS.battle}${stop.twist ? `<sup>${TWISTS[stop.twist].icon}</sup>` : ''}</span>`
}

/** A zone at a fork as a branch of the map: its stops as icons, and every alien in it by count. Clicking it commits the squad to it. */
function branch(run: Run, zone: Zone, index: number): string {
  const battles = zone.stops.filter((s) => s.kind === 'battle')
  const commanders = battles.filter((s) => s.goal === 'assassinate').length
  const aliens = census(run, battles.flatMap((s) => s.packs)) + (commanders > 0 ? `, ${commanders} Commander${commanders === 1 ? '' : 's'}` : '')
  return button({ type: 'zone', index }, `<div class="nodes">${zone.stops.map((s) => stopIcon(s)).join('')}</div><small>${aliens}</small>`, 'branch')
}

/** A stop not yet seen. */
const FOG = '<span class="node fog">?</span>'

/** Stops in a run: each leg's forks and satellite, then the source. */
const RUN_STOPS = KEYS * (FORKS * ZONE_STOPS + 1) + 1

/**
 * The whole run as a map, left to right: each leg's forks and its satellite, then the alien source. Stops passed
 * and the zone under way show what they were; at a fork its three branches are the choice; forks beyond are fog.
 */
function runMap(run: Run): string {
  const end = run.zone && (run.zone.stops[0].kind === 'key' || run.zone.stops[0].kind === 'final')
  const at = run.keys * (FORKS + 1) + (!run.zone ? run.fork : end ? FORKS : run.fork - 1)
  const legs = Array.from({ length: KEYS + 1 }, (_, leg) => {
    const slots = Array.from({ length: leg === KEYS ? 1 : FORKS + 1 }, (_, f) => {
      const i = leg * (FORKS + 1) + f
      if (i === at && !run.zone) return `<div class="seg">${run.zones.map((z, k) => branch(run, z, k)).join('')}</div>`
      const zone = i === at ? run.zone : i < at ? run.trail[i] : null
      if (zone) return `<div class="seg"><div class="nodes">${zone.stops.map((s, k) => stopIcon(s, i < at || k < run.stop ? 'done' : k === run.stop ? 'here' : '')).join('')}</div></div>`
      if (leg === KEYS || f === FORKS) return `<div class="seg"><div class="nodes">${stopIcon({ kind: leg === KEYS ? 'final' : 'key' } as Stop, i < at ? 'done' : '')}</div></div>`
      return `<div class="seg">${`<div class="nodes">${FOG.repeat(ZONE_STOPS)}</div>`.repeat(3)}</div>`
    })
    return `<div class="leg"><small>${leg === KEYS ? 'Source' : `Leg ${leg + 1}`}</small><div class="segs">${slots.join('')}</div></div>`
  })
  const passed = run.trail.slice(0, at).reduce((n, z) => n + z.stops.length, 0) + (run.zone ? run.stop : 0)
  return `<p class="progress">Stop ${passed + 1} of ${RUN_STOPS}</p><div class="map">${legs.join('')}</div>`
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
  if (stop.kind === 'shop') return 'The road leads to a shop, where supplies buy gear, relics, or a quieter road.'
  if (stop.kind !== 'battle') return `The road leads to a ${STOP_NAMES[stop.kind].toLowerCase()}.`
  return `${GOALS[stop.goal].name}, ${RISKS[stop.risk].name.toLowerCase()} ${TERRAIN_TEXT[stop.terrain].name.toLowerCase()}: ${GOALS[stop.goal].text}.${twistLine(stop.twist)}`
}

/** A shop: gear fitted to a soldier, relics, a bribe, and the way out. */
function shopView(run: Run): string {
  const shop = run.shop!
  const held = squadKeywords(run)
  const wares = shop.wares.map(({ gear, soldier: id }, index) => {
    const soldier = run.soldiers.find((s) => s.id === id)!
    const old = soldier.gear[gear.slot]
    const price = GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
    return button({ type: 'gear', index }, `${gearCard(gear, held)}<br><small>for ${soldier.name}${old ? `, replacing ${old.name}` : ''} · ${price} supplies</small>`, `card gear ${gear.rarity}`, price <= run.supplies)
  })
  const relics = shop.relics.map((id, index) =>
    button({ type: 'buy', index }, `<small>relic · ${RELIC_PRICE} supplies</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags, held)}`, 'card relic', RELIC_PRICE <= run.supplies),
  )
  const bribe = button({ type: 'bribe' }, `<b>Bribe the patrols</b><br>-${BRIBE.threat} threat<br><small>${BRIBE.price} supplies, once</small>`, '', !shop.bribed && BRIBE.price <= run.supplies && run.threat > 0)
  return `<h2>A shop. Each piece is one of a kind.</h2>
    <div class="choices">${wares.join('')}</div>
    <div class="choices">${relics.join('')}${bribe}</div>
    <button class="travel" data-action='${JSON.stringify({ type: 'leave' })}'>Leave the shop</button>`
}

/** An event: its scene, and the ways to meet it. */
function eventView(run: Run): string {
  const event = EVENTS[run.event!]
  const options = event.options.map((option, index) => button({ type: 'choose', index }, `<i>${option.quip}</i><span>${option.text}</span>`, 'card', !option.can || option.can(run)))
  return `<h2><b>${event.name}</b></h2><p>${event.text}</p><div class="choices">${options.join('')}</div>`
}

/** The map: a shop or event being met; at a fork, the three zones to choose from; in a zone, the road through it and a button to travel on. */
function mapView(run: Run): string {
  if (run.phase === 'shop') return shopView(run)
  if (run.phase === 'event') return eventView(run)
  const zone = run.zone
  if (!zone) return `<h2>A fork in the road. Choose a branch; what lies beyond it is unknown.</h2>${runMap(run)}`
  const next = nextStop(run)!
  const here = zone.stops[run.stop]
  return `${run.report ? '' : decisions(run)}<h2>${where(here)}</h2>
    ${runMap(run)}
    ${next === 'lastStand' ? '<p class="up"><b>The threat is full. The aliens attack before the squad can travel on.</b></p>' : ''}
    <button class="travel ${next}" data-action='${JSON.stringify({ type: 'advance' })}'>${travelLabel(run, here, next)}</button>`
}

function baseView(run: Run): string {
  const relics = run.relics.map((id) => `<div class="gear relic"><small>relic</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags)}</div>`)
  const doctrines = run.doctrines.map((id) => `<div class="gear doctrine"><small>doctrine</small><br><b>${DOCTRINES[id].name}</b><br>${DOCTRINES[id].text}</div>`)
  const held = squadKeywords(run)
  return `${relics.length + doctrines.length + held.length === 0 ? '<h2>Relics and doctrines the squad gains show here.</h2>' : ''}
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

/** Everything about one soldier: progress, stats, how the class fights, its path and skills, its feats, and what the gear does. */
function details(run: Run, soldier: Soldier): string {
  const r = level(soldier)
  const cls = soldier.cls && CLASSES[soldier.cls]
  const stats = soldierStats(run, soldier)
  const skills = soldier.skills.map((id) => `<p class="described"><b>${SKILLS[id].name}.</b> ${describe(SKILLS[id].text, SKILLS[id].tags)}</p>`)
  const uses = charges(run, soldier)
  const gear = equipped(soldier).map((g) => `<div class="gear ${g.rarity}">${gearCard(g)}</div>`)
  const path = soldier.cls && PATHS[soldier.cls].find((p) => p.core === soldier.skills[0])
  const feats = soldier.feats.map((id) => `<span class="chip feat" title="${FEATS[id].text}">★ ${FEATS[id].name}</span>`)
  return `<h2>${soldier.name}${path ? `, ${path.name}` : ''} · ${xpFor(r + 1) - soldier.xp} experience to level ${r + 1}</h2>
    <div class="details">
      <table class="stats">
        <tr><td>Health</td><td>${stats.hp}</td><td>Armor</td><td>${stats.armor}</td></tr>
        <tr><td>Aim</td><td>${Math.round(100 * stats.aim)}%</td><td>Crit</td><td>${Math.round(100 * stats.crit)}%</td></tr>
        <tr><td>Damage</td><td>${stats.damage}</td><td>Range</td><td>${stats.range}</td></tr>
        <tr><td>Move</td><td>${stats.move}</td><td></td><td></td></tr>
      </table>
      <div>${cls ? `<p>${cls.stanceText}.</p><p><b>${cls.abilityName}${uses > 0 ? ` ×${uses}` : ''}.</b> ${cls.abilityText}.</p>` : ''}${skills.join('')}${feats.length > 0 ? `<p>${feats.join(' ')}</p>` : ''}</div>
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
