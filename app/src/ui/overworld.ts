import { ALIENS, DANGERS, type AlienKind } from '../core/aliens'
import { CLASSES } from '../core/classes'
import { GOALS } from '../core/goals'
import { SLOTS } from '../core/gear'
import { DOCTRINES } from '../core/doctrines'
import { BRIBE, EVENTS, RELIC_PRICE } from '../core/events'
import { RELICS, type Relic } from '../core/relics'
import { CONSUMABLES, KIT_SLOTS } from '../core/consumables'
import { current, legOf, GEAR_PRICE, KEYS, LEG_STOPS, ways, charges, equipped, health, level, missionAt, huntForce, nextStop, RISKS, soldierStats, xpFor, squadKeywords, type Muster, type Run, type Soldier, type Stop } from '../core/run'
import { FEATS } from '../core/feats'
import { SKILLS } from '../core/skills'
import { TWISTS } from '../core/twists'
import type { LonLat } from '../core/world'
import { globe, type Pin } from './globe'
import { alienName, badge, button, describe, gearCard, healthBar, keywordChips, resistChip, gearText, STOP_NAMES, threatBar } from './html'

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

const STOP_ICONS: Record<Stop['kind'], string> = { battle: '⚔️', supply: '📦', cache: '🎁', shop: '🛒', medic: '✚', unknown: '❓', key: '⭐', final: '👁️' }

/**
 * A stop as an icon; a battle's is coloured by its risk and marked by its twist, and hovering tells its goal, place, pay and twist.
 * `state` is done, here, or empty for ahead.
 */
function stopIcon(run: Run, stop: Stop, state = ''): string {
  if (stop.kind !== 'battle') return `<span class="node ${stop.kind} ${state}" title="${STOP_NAMES[stop.kind]}">${STOP_ICONS[stop.kind]}</span>`
  const risk = RISKS[stop.risk]
  const goal = GOALS[stop.goal]
  const aliens = census(run, stop.packs) + (stop.goal === 'assassinate' ? ', a Commander' : '')
  return `<span class="node ${stop.risk} ${state}" title="${goal.name} · ${risk.name} · ${aliens.replace(/<[^>]*>/g, '')}">${STOP_ICONS.battle}${stop.twist ? `<sup>${TWISTS[stop.twist].icon}</sup>` : ''}</span>`
}

/** A stop not yet seen. */
const FOG = '<span class="node fog">?</span>'


/** How many stops ahead of the squad the map shows. */
const SIGHT = 2

/**
 * The run as a globe: where the squad stands, then the stops it can still reach, up to SIGHT ahead, pinned along its
 * way across the continent. Stops it passed by, and stops beyond sight, stay hidden.
 */
function runMap(run: Run, picked: number | null): string {
  const here = current(run)
  const open = here ? [] : ways(run)
  const at = run.keys * (LEG_STOPS + 1) + run.stop
  // The stops the squad can still reach, column by column. A leg ends at its extraction; the next leg's ways show
  // once it is won.
  const reach = run.legs.map((leg) => leg.columns.map(() => new Set<number>()))
  const { columns } = legOf(run)
  for (const i of here ? [legOf(run).path[run.stop]] : open) reach[run.keys][run.stop].add(i)
  for (let c = run.stop; c < columns.length - 1; c++) for (const i of reach[run.keys][c]) for (const k of columns[c][i].next) reach[run.keys][c + 1].add(k)
  const pins: Pin[] = []
  /** The stops the squad took on this leg, in order. */
  const path: LonLat[] = []
  let focus = run.route[run.keys].from
  run.legs.forEach((leg, l) => {
    const walked = (c: number) => l < run.keys || (l === run.keys && (c < run.stop || (c === run.stop && here !== null)))
    // Where the squad stands: the stop under way, or else the last it took.
    const standing = (c: number) => l === run.keys && (here ? c === run.stop : c === run.stop - 1)
    // On the leg under way the stops taken stay shown, the way the squad came across the continent.
    const shown = (c: number, i: number) => (walked(c) ? l === run.keys && leg.path[c] === i : reach[l][c].has(i) && l * (LEG_STOPS + 1) + c <= at + SIGHT)
    leg.columns.forEach((column, c) =>
      column.forEach((node, i) => {
        if (!shown(c, i)) return
        const taken = walked(c)
        const next = c === leg.columns.length - 1 ? [] : node.next.map((k) => `${l}-${c + 1}-${k}`)
        const state = taken ? (l === run.keys && c === run.stop ? 'here' : 'done') : ''
        const icon = !node.stop ? (c === leg.columns.length - 1 ? stopIcon(run, { kind: l === KEYS ? 'final' : 'key' } as Stop) : FOG) : stopIcon(run, node.stop, state)
        const squad = taken && standing(c)
        // A stop the squad stands at but has not yet set in to is tapped to set in.
        const setIn = squad && here !== null
        const choice = setIn || (open.includes(i) && l === run.keys && c === run.stop)
        const html = setIn ? `<button class="option picked" data-in>${icon}</button>` : choice ? `<button class="option${i === picked ? ' picked' : ''}" data-pick="${i}">${icon}</button>` : icon
        const pin = { id: `${l}-${c}-${i}`, at: node.at ?? run.route[l].to.at, html, next, squad, choice, past: taken && !squad, lit: squad ? picked !== null : choice && i === picked }
        if (taken) path.push(pin.at)
        if (squad) focus = pin.at
        pins.push(pin)
      }),
    )
  })
  // At a leg's start the squad stands in the city it set out from, its trails reaching to each choice.
  if (!pins.some((p) => p.squad)) pins.push({ id: 'from', at: focus, html: '', next: open.map((i) => `${run.keys}-0-${i}`), squad: true, choice: false, past: false, lit: picked !== null })
  // The way on from the picked stop lights up, stop by stop.
  for (const pin of pins) if (pin.lit && !pin.squad) for (const id of pin.next) pins.forEach((p) => p.id === id && (p.lit = true))
  // The map fills the screen under the header and headings.
  // The stops keep clear of the header above and the stop's card below.
  return `${squadStrip(run)}<div class="map flight">${globe({ w: innerWidth, h: innerHeight, top: 70, bottom: 70 }, run, pins, focus, path, picked !== null)}</div>`
}

/** The squad at a glance over the map: each soldier's badge over a health bar, red at half or less. */
function squadStrip(run: Run): string {
  const cells = run.soldiers.map((soldier) => {
    const hp = health(run, soldier)
    const max = soldierStats(run, soldier).hp
    return `<div class="mate${hp <= max / 2 ? ' low' : ''}" title="${soldier.name} · ${hp}/${max}"><span class="portrait">${badge(soldier.cls)}</span><div class="bar"><div style="width: ${(100 * hp) / max}%"></div></div></div>`
  })
  return `<div class="strip">${cells.join('')}</div>`
}

/** The alien force at the squad's stop. */
function travelLabel(run: Run, stop: Stop, next: 'battle' | 'key' | 'final'): string {
  const mission = missionAt(run, next, stop.risk, next === 'battle' ? stop.goal : 'exterminate')
  const hunt = huntForce(run, mission)
  return `force ${mission.force}${hunt > 0 ? ` + ${hunt} hunting` : ''}${next === 'key' || next === 'final' ? ' + boss' : ''}`
}

/** What the squad faces at a stop, as the map's heading. */
function where(run: Run, stop: Stop): string {
  const stage = run.route[run.keys]
  if (stop.kind === 'final') return 'The alien hub'
  if (stop.kind === 'key') return `Extract ${stage.hero!.name}`
  // A stop's icon tells what it is; only a fight says more.
  if (stop.kind !== 'battle') return ''
  return `${GOALS[stop.goal].name} · ${RISKS[stop.risk].name}${stop.twist ? ` · ${TWISTS[stop.twist].icon} ${TWISTS[stop.twist].name}` : ''}`
}

const PURCHASED = '<small class="purchased">Purchased</small>'

/** A shop: gear, each with a button per soldier to buy it for, relics, consumables, a bribe, and the way out. What is bought keeps its place, greyed out. */
function shopView(run: Run): string {
  const shop = run.shop!
  const held = squadKeywords(run)
  const wares = shop.wares.map(({ gear, sold }, index) => {
    const price = GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
    const buyers = run.soldiers.map((s) => {
      const old = s.gear[gear.slot]
      return button({ type: 'gear', index, soldier: s.id }, `${badge(s.cls)} ${s.name}`, 'buyer', !sold && price <= run.supplies, old ? `Replaces ${old.name}` : `Empty ${gear.slot} slot`)
    })
    return `<div class="card gear ${gear.rarity}${sold ? ' bought' : ''}">${gearCard(gear, held)}<br>${sold ? PURCHASED : `<small>${price} supplies, for:</small>`}<div class="buyers">${buyers.join('')}</div></div>`
  })
  const relics = shop.relics.map(({ id, sold }, index) =>
    `<div class="buy">${button({ type: 'buy', index }, `${sold ? PURCHASED : `<small>relic · ${RELIC_PRICE} supplies</small>`}<br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags, held)}`, `card relic${sold ? ' bought' : ''}`, !sold && RELIC_PRICE <= run.supplies)}</div>`,
  )
  const full = run.kit.length >= KIT_SLOTS
  const consumables = shop.consumables.map(({ id, sold }, index) => {
    const item = CONSUMABLES[id]
    const line = sold ? PURCHASED : `<small>${full ? 'kit full' : `consumable · ${item.price} supplies`}${item.threat ? ` · <span class="up">+${item.threat} threat on use</span>` : ''}</small>`
    return button({ type: 'consumable', index }, `${line}<br><b>${item.icon} ${item.name}</b><br>${describe(item.text, item.tags, held)}`, `card consumable${sold ? ' bought' : ''}`, !sold && !full && item.price <= run.supplies)
  })
  const bribe = button({ type: 'bribe' }, `${shop.bribed ? PURCHASED : `<small>${BRIBE.price} supplies, once</small>`}<br><b>Bribe the patrols</b><br>-${BRIBE.threat} threat`, shop.bribed ? 'bought' : '', !shop.bribed && BRIBE.price <= run.supplies && run.threat > 0)
  const kit = run.kit.map((k) => `<span title="${CONSUMABLES[k].text}">${CONSUMABLES[k].icon} ${CONSUMABLES[k].name}</span>`).join(', ') || 'empty'
  return `<h2>A shop. Each piece is one of a kind.</h2>
    <div class="choices">${wares.join('')}</div>
    <div class="choices">${relics.join('')}${bribe}</div>
    <div class="choices">${consumables.join('')}<p class="kit">Kit ${run.kit.length}/${KIT_SLOTS}: ${kit}</p></div>
    <button class="travel" data-action='${JSON.stringify({ type: 'leave' })}'>Leave the shop</button>`
}

/** An event: its scene, and the ways to meet it. */
function eventView(run: Run): string {
  const event = EVENTS[run.event!]
  const options = event.options.map((option, index) => button({ type: 'choose', index }, `<i>${option.quip}</i><span>${option.text}</span>`, 'card', !option.can || option.can(run)))
  return `<h2><b>${event.name}</b></h2><p>${event.text}</p><div class="choices">${options.join('')}</div>`
}

/** The map: a shop or event being met; else the run's map, with the ways on to choose from or a button to travel on. */
/** The map, with the stop the player has picked to look at but not yet set out for, if any. */
function mapView(run: Run, picked: number | null): string {
  if (run.phase === 'shop') return shopView(run)
  if (run.phase === 'event') return eventView(run)
  const node = current(run)
  const ahead = picked !== null && ways(run).includes(picked) ? legOf(run).columns[run.stop][picked].stop : null
  // Flight: the map fills the screen; what a stop holds shows over it once picked or reached.
  if (!node && !ahead) return runMap(run, null)
  const brief = (text: string) => (text ? `<div class="stopcard">${text}</div>` : '')
  if (!node) return `${brief(where(run, ahead!))}${runMap(run, picked)}`
  const next = nextStop(run)!
  const here = node.stop!
  return `${brief(next === 'recovery' ? '<b class="up">Recover your soldiers</b>' : next === 'ambush' ? '<b class="up">Ambushed: survive</b>' : next === 'battle' || next === 'key' || next === 'final' ? `${where(run, here)} · ${travelLabel(run, here, next)}` : '')}
    ${runMap(run, null)}`
}

function baseView(run: Run): string {
  const relics = run.relics.map((id) => `<div class="gear relic"><small>relic</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags)}</div>`)
  const doctrines = run.doctrines.map((id) => `<div class="gear doctrine"><small>doctrine</small><br><b>${DOCTRINES[id].name}</b><br>${DOCTRINES[id].text}</div>`)
  const kit = run.kit.map((id) => `<div class="gear"><small>consumable · on the ${CONSUMABLES[id].on}</small><br><b>${CONSUMABLES[id].icon} ${CONSUMABLES[id].name}</b><br>${describe(CONSUMABLES[id].text, CONSUMABLES[id].tags)}</div>`)
  const held = squadKeywords(run)
  return `${relics.length + doctrines.length + held.length + kit.length === 0 ? '<h2>Relics, doctrines and consumables the squad gains show here.</h2>' : ''}
    ${kit.length > 0 ? `<h2>Consumables ${kit.length}/${KIT_SLOTS}</h2><div class="stash">${kit.join('')}</div>` : ''}
    ${held.length > 0 ? `<h2>Keywords</h2>${keywordChips(held, held)}` : ''}
    ${doctrines.length > 0 ? `<h2>Doctrines</h2><div class="stash">${doctrines.join('')}</div>` : ''}
    ${relics.length > 0 ? `<h2>Relics</h2><div class="stash">${relics.join('')}</div>` : ''}`
}

/** A soldier's card, kept short: level, class, name, experience, and three gear slots. Clicking it opens the soldier's details. */
function soldierCard(run: Run, soldier: Soldier, open: number | null): string {
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
    ${healthBar(health(run, soldier), soldierStats(run, soldier).hp, soldierStats(run, soldier).armor)}
    ${slots.join('')}
  </button>`
}

/** Everything about one soldier: progress, stats, how the class fights, its skills, its feats, and what the gear does. */
function details(run: Run, soldier: Soldier): string {
  const r = level(soldier)
  const cls = soldier.cls && CLASSES[soldier.cls]
  const stats = soldierStats(run, soldier)
  const skills = soldier.skills.map((id) => `<p class="described"><b>${SKILLS[id].name}.</b> ${describe(SKILLS[id].text, SKILLS[id].tags)}</p>`)
  const uses = charges(run, soldier)
  const gear = equipped(soldier).map((g) => `<div class="gear ${g.rarity}">${gearCard(g)}</div>`)
  const feats = soldier.feats.map((id) => `<span class="chip feat" title="${FEATS[id].text}">★ ${FEATS[id].name}</span>`)
  return `<h2>${soldier.name} · ${xpFor(r + 1) - soldier.xp} experience to level ${r + 1}</h2>
    <div class="details">
      <table class="stats">
        <tr><td>Health</td><td>${health(run, soldier)}/${stats.hp}</td><td>Armor</td><td>${stats.armor}</td></tr>
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
  return `<div class="squad">${run.soldiers.map((s) => soldierCard(run, s, open)).join('')}</div>${soldier ? details(run, soldier) : '<h2>Click a soldier for details.</h2>'}`
}

/**
 * The screen between stops: a header with the keys, threat, supplies and tabs, over the chosen tab's view.
 * `open` is the soldier opened in the Barracks.
 */
export function overworld(run: Run, tab: Tab, open: number | null, picked: number | null): string {
  const views = { Map: (r: Run) => mapView(r, picked), Base: baseView, Barracks: (r: Run) => barracksView(r, open) }
  const tabs = TABS.map((name) => `<button class="tab ${name === tab ? 'active' : ''}" data-tab="${name}">${name}</button>`)
  return `
    <div class="header">
      <div class="tabs">${tabs.join('')}</div>
      <span>Threat ${threatBar(run.threat)}</span>
      <span>${run.keys === KEYS ? 'Source' : 'Guardian'} ${resistChip(run.bosses[run.keys])}</span>
      <b class="supplies">${run.supplies} ${run.supplies === 1 ? 'supply' : 'supplies'}</b>
    </div>
    ${views[tab](run)}`
}
