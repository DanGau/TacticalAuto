import { ALIENS, DANGERS, type AlienKind } from '../core/aliens'
import { CLASSES } from '../core/classes'
import { GOALS } from '../core/goals'
import { DOCTRINES } from '../core/doctrines'
import { MEDKIT, EVENTS, RELIC_PRICE } from '../core/events'
import { RELICS, type Relic } from '../core/relics'
import { relicIcon } from './relic-icons'
import { boonText, carries, UTILITIES, UTILITY_PRICE, UTILITY_SLOTS } from '../core/utilities'
import { current, legOf, KEYS, ways, nextStop } from '../core/run'
import { type Run } from '../core/run-state'
import { type Soldier } from '../core/run-state'
import { type Stop } from '../core/run-state'
import { missionAt } from '../core/missions'
import { huntForce } from '../core/missions'
import { RISKS } from '../core/missions'
import { DRILL_PRICE, GEAR_PRICE } from '../core/rewards'
import { squadMakes } from '../core/squad'
import { soldierStats } from '../core/squad'
import { health, wounded } from '../core/squad'
import { level } from '../core/squad'
import { xpFor } from '../core/squad'
import { LEG_STOPS } from '../core/progress'
import { FEATS } from '../core/feats'
import { TWISTS } from '../core/twists'
import { objective, THREATS } from '../core/objectives'
import { CHALLENGES } from '../core/challenges'
import type { LonLat } from '../core/world'
import { globe, type Pin } from './globe'
import { pickCard, shopSwap, pickDetail, utilityPick, type Pick } from './cards'
import { heroSheet } from './sheet'
import { alienName, badge, button, describe, describeGear, gearCard, gearName, healthBar, quantityChips, examChip, gearText, STOP_NAMES, threatBar } from './html'

/** The views between battles, in tab order. */
const TABS = ['Map', 'Team', 'Heroes'] as const
export type Tab = (typeof TABS)[number]


/** The aliens of a zone, counted by kind with a recon uplink, "3 Troopers, 2 Swarmlings"; else by danger, "3 small, 2 medium". */
function census(run: Run, kinds: AlienKind[]): string {
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

/** What a safehouse does, told on its icon and card. */
const SAFEHOUSE = 'every hero heals fully, in place of a fight'

const STOP_ICONS: Record<Stop['kind'], string> = { battle: '⚔️', supply: '📦', cache: '🎁', shop: '🛒', safehouse: '🏠', unknown: '❓', key: '⭐', final: '👁️' }

/**
 * A stop as an icon; a battle's is coloured by its risk and marked by its twist, and hovering tells its goal, place, pay and twist.
 * `state` is done, here, or empty for ahead.
 */
function stopIcon(run: Run, stop: Stop, state = ''): string {
  if (stop.kind !== 'battle') return `<span class="node ${stop.kind} ${state}" title="${STOP_NAMES[stop.kind]}${stop.kind === 'safehouse' ? `: ${SAFEHOUSE}` : ''}">${STOP_ICONS[stop.kind]}</span>`
  const risk = RISKS[stop.risk]
  const goal = GOALS[stop.goal]
  const aliens = census(run, stop.aliens) + (stop.goal === 'assassinate' ? ', a Commander' : '')
  const challenge = stop.challenge && CHALLENGES[stop.challenge]
  const answered = challenge && run.utilities.some((id) => carries(id, challenge.answers)) ? ' answered' : ''
  return `<span class="node ${stop.risk} ${state}${answered}" title="${challenge?.name} · ${goal.name} · ${risk.name} · ${aliens.replace(/<[^>]*>/g, '')}">${challenge?.icon ?? STOP_ICONS.battle}${stop.twist ? `<sup>${TWISTS[stop.twist].icon}</sup>` : ''}</span>`
}

/** A stop not yet seen. */
const FOG = '<span class="node fog">?</span>'


/** How many stops ahead of the squad the map shows. */
const SIGHT = 2

/**
 * The run's flight map: where the squad stands, then the stops it can still reach, up to SIGHT ahead, pinned along its
 * way across the continent, and the stops it took this leg. Stops it passed by, and stops beyond sight, stay hidden.
 */
export function flight(run: Run, picked: number | null): { pins: Pin[]; focus: LonLat; path: string[] } {
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
  const path: string[] = []
  let focus = run.route[run.keys].from
  run.legs.forEach((leg, l) => {
    const walked = (c: number) => l < run.keys || (l === run.keys && (c < run.stop || (c === run.stop && here !== null)))
    // Where the squad stands: the stop under way, or else the last it took; a tunnel's columns hold none.
    const standing = (c: number) => l === run.keys && c === (here ? run.stop : leg.path.slice(0, run.stop).findLastIndex((i) => i >= 0))
    // On the leg under way the stops taken stay shown, the way the squad came across the continent.
    const shown = (c: number, i: number) => (walked(c) ? l === run.keys && leg.path[c] === i : reach[l][c].has(i) && l * (LEG_STOPS + 1) + c <= at + SIGHT)
    leg.columns.forEach((column, c) =>
      column.forEach((node, i) => {
        if (!shown(c, i)) return
        const taken = walked(c)
        const squad = taken && standing(c)
        // Out of a tunnel, the way on leads past the columns between.
        const next = squad && !here ? open.map((k) => `${l}-${run.stop}-${k}`) : c === leg.columns.length - 1 ? [] : node.next.map((k) => `${l}-${c + 1}-${k}`)
        const state = taken ? (l === run.keys && c === run.stop ? 'here' : 'done') : ''
        const icon = !node.stop ? (c === leg.columns.length - 1 ? stopIcon(run, { kind: l === KEYS ? 'final' : 'key' } as Stop) : FOG) : stopIcon(run, node.stop, state)
        // A stop the squad stands at but has not yet set in to is tapped to set in.
        const setIn = squad && here !== null
        const choice = setIn || (open.includes(i) && l === run.keys && c === run.stop)
        const html = setIn ? `<button class="option picked" data-in>${icon}</button>` : choice ? `<button class="option${i === picked ? ' picked' : ''}" data-pick="${i}">${icon}</button>` : icon
        const pin = { id: `${l}-${c}-${i}`, at: node.at ?? run.route[l].to.at, layer: l * (LEG_STOPS + 1) + c, order: i, html, next, squad, choice, past: taken && !squad, lit: squad ? picked !== null : choice && i === picked }
        if (taken) path.push(pin.id)
        if (squad) focus = pin.at
        pins.push(pin)
      }),
    )
  })
  // At a leg's start the squad stands in the city it set out from, its trails reaching to each choice.
  if (!pins.some((p) => p.squad)) pins.push({ id: 'from', at: focus, layer: run.keys * (LEG_STOPS + 1) - 1, order: 0, html: '', next: open.map((i) => `${run.keys}-0-${i}`), squad: true, choice: false, past: false, lit: picked !== null })
  // The way on from the picked stop lights up, stop by stop.
  for (const pin of pins) if (pin.lit && !pin.squad) for (const id of pin.next) pins.forEach((p) => p.id === id && (p.lit = true))
  return { pins, focus, path }
}

/** The window the flight map is seen through: the whole screen, its stops clear of the header and squad strip above and the stop's card below. */
export const flightSize = (w: number, h: number) => ({ w, h, top: 100, bottom: 70 })

/** The run as a globe, the flight map pinned on it. */
function runMap(run: Run, picked: number | null): string {
  const { pins, focus, path } = flight(run, picked)
  // The panel is zoomed by --ui, so the window in its own pixels is that much larger.
  const ui = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1
  return `${squadStrip(run)}<div class="map flight">${globe(flightSize(innerWidth / ui, innerHeight / ui), run, pins, focus, path, picked !== null)}</div>`
}

/** The squad at a glance over the map: each soldier's badge over a health bar and count, red at half or less. */
function squadStrip(run: Run): string {
  const cells = run.soldiers.map((soldier) => {
    const hp = health(run, soldier)
    const max = soldierStats(run, soldier).hp
    return `<div class="mate${hp <= max / 2 ? ' low' : ''}" title="${soldier.name} · ${hp}/${max}"><span class="portrait">${badge(soldier.cls)}</span><div class="bar"><div style="width: ${(100 * hp) / max}%"></div></div><small>${hp}/${max}</small></div>`
  })
  return `<div class="strip">${cells.join('')}</div>`
}

/** The alien force at the squad's stop. */
function travelLabel(run: Run, stop: Stop, next: 'battle' | 'key' | 'final'): string {
  const hunt = huntForce(run, missionAt(run, next, stop.risk, next === 'battle' ? stop.goal : 'exterminate'))
  return `${stop.aliens.length} aliens${hunt > 0 ? ` + ${hunt} hunting` : ''}${stop.challenge === 'bigOne' ? ' + boss' : ''}`
}

/** What a stop tests, and which utility held answers it, or that none does. */
function readChallenge(run: Run, stop: Stop): string {
  if (!stop.challenge) return ''
  const challenge = CHALLENGES[stop.challenge]
  const held = run.utilities.filter((id) => carries(id, challenge.answers))
  return `<span title="${challenge.name}: ${challenge.test}">${challenge.icon} ${THREATS[stop.challenge]}</span> <small class="${held.length > 0 ? 'down' : 'up'}">${held.length > 0 ? `Held: ${held.map((id) => UTILITIES[id].name).join(', ')}` : 'No answer held'}</small>`
}

/** What the squad faces at a stop, as the map's heading. */
function where(run: Run, stop: Stop): string {
  const stage = run.route[run.keys]
  // A stop's icon tells what it is; only a fight or a safehouse says more.
  if (stop.kind === 'safehouse') return `<b>🏠 Safehouse</b>: ${SAFEHOUSE}`
  if (stop.kind !== 'battle' && stop.kind !== 'key' && stop.kind !== 'final') return ''
  const order = `<b title="${GOALS[stop.goal].text}">${objective(stop.kind, stop.goal, stop.challenge, stop.terrain, stage.hero?.name)}</b>`
  const extras = stop.kind === 'battle' ? ` · ${RISKS[stop.risk].name}${stop.twist ? ` · <span title="${TWISTS[stop.twist].text}">${TWISTS[stop.twist].icon} ${TWISTS[stop.twist].name}</span>` : ''}` : ''
  return `${order}${extras}<br>${readChallenge(run, stop)}`
}

const PURCHASED = '<small class="purchased">Purchased</small>'

/** Everything a shop sells, as cards of one size: weapons, relics, then boons and the medkit. */
function shopShelves(run: Run): { name: string; picks: Pick[] }[] {
  const shop = run.shop!
  const held = squadMakes(run)
  const poor = (price: number) => (price > run.supplies ? 'Not enough supplies' : null)
  const card = (top: string, name: string, foot: string, sold: boolean) => `<small>${top}</small><b>${name}</b>${sold ? PURCHASED : `<small class="price">${foot}</small>`}`
  const gear = shop.wares.map(({ gear, sold }, index): Pick => {
    const price = GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
    return { key: `g${index}`, attrs: `data-ware="${index}"`, look: `gear ${gear.rarity}`, body: card(gear.rarity, gearName(gear), `${price} supplies`, sold), detail: `<p><b>${gear.name}</b>. ${describeGear(gear, held)}</p>`, go: `Tap again to choose who takes it, for ${price} supplies`, block: poor(price), spent: sold }
  })
  const relics = shop.relics.map(({ id, sold }, index): Pick => ({ key: `r${index}`, action: { type: 'buy', index }, look: 'relic', body: card('relic', `${relicIcon(id)} ${RELICS[id].name}`, `${RELIC_PRICE} supplies`, sold), detail: `<p><b>${RELICS[id].name}.</b> ${describe(RELICS[id].text, RELICS[id], held)}</p>`, go: `Tap again to buy for ${RELIC_PRICE} supplies`, block: poor(RELIC_PRICE), spent: sold }))
  const utilities = shop.utilities.map(({ id, sold }, index): Pick =>
    utilityPick(`u${index}`, { type: 'utility', index }, id, 'boon', `Tap again to buy for ${UTILITY_PRICE} supplies${run.utilities.length >= UTILITY_SLOTS ? ', dropping one' : ''}`, {
      body: card('boon', `${UTILITIES[id].icon} ${UTILITIES[id].name}`, `${UTILITY_PRICE} supplies`, sold),
      block: run.utilities.includes(id) ? 'Held' : poor(UTILITY_PRICE),
      spent: sold,
    }),
  )
  const medkit: Pick = { key: 'm', action: { type: 'medkit' }, look: 'medkit', body: card('medkit', '✚ Medkit', `${MEDKIT.price} supplies`, shop.medkit), detail: `<p><b>Medkit.</b> Every hero heals ${MEDKIT.heal}, once. A safehouse heals fully.</p>`, go: `Tap again to pay ${MEDKIT.price} supplies`, block: wounded(run) ? poor(MEDKIT.price) : 'No hero is hurt', spent: shop.medkit }
  const drill = (shop.drill ? run.soldiers : []).map((pupil): Pick => {
    const drilled = shop.drill!.sold === pupil.id
    return { key: `d${pupil.id}`, action: { type: 'drill', soldier: pupil.id }, look: 'medkit', body: card('favour', `🎖️ Drill ${pupil.name}`, `${DRILL_PRICE} supplies`, drilled), detail: `<p><b>Drill ${pupil.name} as the Carry.</b> Their hits add twice the burn, chill and marks, all run. One hero, once a run.</p>`, go: `Tap again to pay ${DRILL_PRICE} supplies`, block: shop.drill!.sold !== null && !drilled ? 'The Carry is chosen' : poor(DRILL_PRICE), spent: drilled }
  })
  return [{ name: 'Weapons', picks: gear }, { name: 'Relics', picks: relics }, { name: 'Boons and favours', picks: [...utilities, medkit, ...drill] }]
}

/** A shop: its cards, what the armed one does, and the way out. What is bought keeps its place, greyed out. With `ware` chosen, who takes it, in a pop-up. */
function shopView(run: Run, armed: string | null, ware: number | null): string {
  const shelves = shopShelves(run)
  const picks = shelves.flatMap((shelf) => shelf.picks)
  const held = run.utilities.map((k) => `${UTILITIES[k].icon} ${UTILITIES[k].name}`).join(', ') || 'none'
  const screen = `<h2>A shop. Each piece is one of a kind.</h2>
    ${shelves.filter((shelf) => shelf.picks.length > 0).map((shelf) => `<div class="shelf"><small>${shelf.name}</small><div class="picks">${shelf.picks.map((p) => pickCard(p, ware === null ? armed : null)).join('')}</div></div>`).join('')}
    <div class="shopfoot"><button class="travel" data-action='${JSON.stringify({ type: 'leave' })}'>Leave the shop</button><p class="kit">Boons ${run.utilities.length}/${UTILITY_SLOTS}: ${held}</p></div>
    ${pickDetail(picks, ware === null ? armed : null, 'Tap a card for its details; tap it again to buy.')}`
  if (ware === null || run.shop!.wares[ware].sold) return screen
  const { gear } = run.shop!.wares[ware]
  return `${screen}<div class="modal"><div class="sheet">${shopSwap(run, ware, GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE], armed)}</div></div>`
}

/** An event: its scene, and the ways to meet it. */
function eventView(run: Run): string {
  const event = EVENTS[run.event!]
  const options = event.options.map((option, index) => button({ type: 'choose', index }, `<i>${option.quip}</i><span>${option.text}</span>`, 'card', !option.can || option.can(run)))
  return `<h2><b>${event.name}</b></h2><p>${event.text}</p><div class="choices">${options.join('')}</div>`
}

/**
 * The map: a shop or event being met; else the run's map, with the ways on to choose from or a button to travel on,
 * and the stop the player has picked to look at but not yet set out for, if any.
 */
function mapView(run: Run, picked: number | null, armed: string | null, ware: number | null): string {
  if (run.phase === 'shop') return shopView(run, armed, ware)
  if (run.phase === 'event') return eventView(run)
  const node = current(run)
  const ahead = picked !== null && ways(run).includes(picked) ? legOf(run).columns[run.stop][picked].stop : null
  // Flight: the map fills the screen; what a stop holds shows over it once picked or reached.
  if (!node && !ahead) return runMap(run, null)
  const brief = (text: string) => (text ? `<div class="stopcard">${text}</div>` : '')
  if (!node) return `${brief(where(run, ahead!))}${runMap(run, picked)}`
  const next = nextStop(run)!
  const here = node.stop!
  return `${brief(next === 'recovery' || next === 'ambush' ? `<b class="up">${objective(next, next === 'ambush' ? 'ambush' : 'recover', null, here.terrain)}</b>` : next === 'battle' || next === 'key' || next === 'final' ? `${where(run, here)} · ${travelLabel(run, here, next)}` : '')}
    ${runMap(run, null)}`
}

function baseView(run: Run): string {
  const relics = run.relics.map((id) => `<div class="gear relic"><small>relic</small><br><b>${relicIcon(id)} ${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id])}</div>`)
  const doctrines = run.doctrines.map((id) => `<div class="gear doctrine"><small>oath</small><br><b>${DOCTRINES[id].name}</b><br>${DOCTRINES[id].text}</div>`)
  const utilities = run.utilities.map((id) => `<div class="gear"><small>boon</small><br><b>${UTILITIES[id].icon} ${UTILITIES[id].name}</b><br>${boonText(id)}</div>`)
  const held = squadMakes(run)
  return `${relics.length + doctrines.length + held.length + utilities.length === 0 ? '<h2>Relics, oaths and boons the party gains show here.</h2>' : ''}
    ${utilities.length > 0 ? `<h2>Boons ${utilities.length}/${UTILITY_SLOTS}</h2><div class="stash">${utilities.join('')}</div>` : ''}
    ${held.length > 0 ? `<h2>The squad makes</h2>${quantityChips(held, held)}` : ''}
    ${doctrines.length > 0 ? `<h2>Oaths</h2><div class="stash">${doctrines.join('')}</div>` : ''}
    ${relics.length > 0 ? `<h2>Relics</h2><div class="stash">${relics.join('')}</div>` : ''}`
}

/** A soldier's card, kept short: level, class, name, experience, and its weapon. Clicking it opens the soldier's details. */
function soldierCard(run: Run, soldier: Soldier, open: number | null): string {
  const r = level(soldier)
  const cls = soldier.cls && CLASSES[soldier.cls]
  const filled = (100 * (soldier.xp - xpFor(r))) / (xpFor(r + 1) - xpFor(r))
  const { gear } = soldier
  return `<button class="soldier who ${open === soldier.id ? 'chosen' : ''}" data-open="${soldier.id}">
    <small>Level ${r}${cls ? ` · ${cls.name}` : ''}</small><br><b>${soldier.name}</b>
    <div class="bar"><div style="width: ${filled}%"></div></div>
    ${healthBar(health(run, soldier), soldierStats(run, soldier).hp, soldierStats(run, soldier).armor)}
    <div class="slot gear ${gear?.rarity ?? ''}" title="${gear ? gearText(gear) : ''}">${gear ? `<b>${gear.name}</b> <small>${gearName(gear)}</small>` : '<small>Empty hands</small>'}</div>
  </button>`
}

/** Everything about one hero: its sheet, its progress and its feats. */
function details(run: Run, soldier: Soldier): string {
  const r = level(soldier)
  const feats = soldier.feats.map((id) => `<span class="chip feat" title="${FEATS[id].text}">★ ${FEATS[id].name}</span>`)
  const gear = soldier.gear?.effect ? `<div class="gear ${soldier.gear.rarity}">${gearCard(soldier.gear)}</div>` : ''
  return `<h2>${soldier.name} · ${xpFor(r + 1) - soldier.xp} XP to level ${r + 1}</h2>
    <div class="details">${heroSheet(run, soldier)}${gear}${feats.length > 0 ? `<p>${feats.join(' ')}</p>` : ''}</div>`
}

/** The squad as short cards, and below them the details of the soldier opened. */
function barracksView(run: Run, open: number | null): string {
  const soldier = run.soldiers.find((s) => s.id === open)
  return `<div class="squad">${run.soldiers.map((s) => soldierCard(run, s, open)).join('')}</div>${soldier ? details(run, soldier) : '<h2>Tap a hero for the full sheet.</h2>'}`
}

/**
 * The screen between stops: a header with the keys, threat, supplies and tabs, over the chosen tab's view.
 * `open` is the soldier opened in the Barracks; `armed` the card tapped once, `ware` the shop gear being bought.
 */
export function overworld(run: Run, tab: Tab, open: number | null, picked: number | null, armed: string | null = null, ware: number | null = null): string {
  const views = { Map: (r: Run) => mapView(r, picked, armed, ware), Team: baseView, Heroes: (r: Run) => barracksView(r, open) }
  const tabs = TABS.map((name) => `<button class="tab ${name === tab ? 'active' : ''}" data-tab="${name}">${name}</button>`)
  return `
    <div class="header">
      <div class="tabs">${tabs.join('')}</div>
      <span>Threat ${threatBar(run.threat)}</span>
      <span>${run.keys === KEYS ? 'Source' : 'Guardian'} ${examChip(run.bosses[run.keys])}</span>
      <b class="supplies">${run.supplies} ${run.supplies === 1 ? 'supply' : 'supplies'}</b>
    </div>
    ${views[tab](run)}`
}
