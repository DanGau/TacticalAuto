import { ALIENS, DANGERS, type AlienKind } from '../core/aliens'
import { GOALS } from '../core/goals'
import { DOCTRINES } from '../core/doctrines'
import { MEDKIT, EVENTS, RELIC_PRICE } from '../core/events'
import { RELICS, type Relic } from '../core/relics'
import { relicIcon } from './relic-icons'
import { boonName, UTILITIES, UTILITY_PRICE } from '../core/utilities'
import { boonIcon } from './boon-icons'
import { current, legOf, KEYS, ways, nextStop } from '../core/run'
import { type Run } from '../core/run-state'
import { type Stop } from '../core/run-state'
import { missionAt } from '../core/missions'
import { huntForce } from '../core/missions'
import { RISKS } from '../core/missions'
import { GEAR_PRICE, slotsOf } from '../core/rewards'
import { makes } from '../core/hero'
import { soldierStats } from '../core/hero'
import { health, wounded } from '../core/hero'
import { level } from '../core/hero'
import { xpFor } from '../core/hero'
import { LEG_STOPS } from '../core/progress'
import { FEATS } from '../core/feats'
import { TWISTS } from '../core/twists'
import { ARENA_KINDS } from '../core/arena-kinds'
import { REGIONS } from '../core/regions'
import { objective, THREATS } from '../core/objectives'
import { CHALLENGES } from '../core/challenges'
import type { LonLat } from '../core/world'
import { globe, type Pin } from './globe'
import { boonDoes, pickCard, shopSwap, pickDetail, utilityPick, type Pick } from './cards'
import { heroSheet } from './sheet'
import { alienName, badge, button, describe, describeGear, gearCard, gearName, healthBar, quantityChips, examChip, STOP_NAMES, threatBar } from './html'

/** The views between battles, in tab order. */
const TABS = ['Map', 'Kit', 'Hero'] as const
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
const SAFEHOUSE = 'heal to full instead of fighting'

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
  const answered = challenge && run.utilities.some((h) => challenge.answers.includes(h.id)) ? ' answered' : ''
  const ground = stop.ground && ARENA_KINDS[stop.ground]
  return `<span class="node ${stop.risk} ${state}${answered}" title="${ground ? `${ground.name} · ` : ''}${challenge?.name} · ${goal.name} · ${risk.name} · ${aliens.replace(/<[^>]*>/g, '')}">${challenge?.icon ?? STOP_ICONS.battle}${stop.twist ? `<sup>${TWISTS[stop.twist].icon}</sup>` : ''}${ground && stop.ground !== 'open' ? `<sub>${ground.icon}</sub>` : ''}</span>`
}

/** A stop not yet seen. */
const FOG = '<span class="node fog">?</span>'


/** How many stops ahead of the hero the map shows. */
const SIGHT = 2

/**
 * The run's flight map: where the hero stands, then the stops it can still reach, up to SIGHT ahead, pinned along its
 * way across the continent, and the stops it took this leg. Stops it passed by, and stops beyond sight, stay hidden.
 */
export function flight(run: Run, picked: number | null): { pins: Pin[]; focus: LonLat; path: string[] } {
  const here = current(run)
  const open = here ? [] : ways(run)
  const at = run.keys * (LEG_STOPS + 1) + run.stop
  // The stops the hero can still reach, column by column. A leg ends at its extraction; the next leg's ways show
  // once it is won.
  const reach = run.legs.map((leg) => leg.columns.map(() => new Set<number>()))
  const { columns } = legOf(run)
  for (const i of here ? [legOf(run).path[run.stop]] : open) reach[run.keys][run.stop].add(i)
  for (let c = run.stop; c < columns.length - 1; c++) for (const i of reach[run.keys][c]) for (const k of columns[c][i].next) reach[run.keys][c + 1].add(k)
  const pins: Pin[] = []
  /** The stops the hero took on this leg, in order. */
  const path: string[] = []
  let focus = run.route[run.keys].from
  run.legs.forEach((leg, l) => {
    const walked = (c: number) => l < run.keys || (l === run.keys && (c < run.stop || (c === run.stop && here !== null)))
    // Where the hero stands: the stop under way, or else the last it took; a tunnel's columns hold none.
    const standing = (c: number) => l === run.keys && c === (here ? run.stop : leg.path.slice(0, run.stop).findLastIndex((i) => i >= 0))
    // On the leg under way the stops taken stay shown, the way the hero came across the continent.
    const shown = (c: number, i: number) => (walked(c) ? l === run.keys && leg.path[c] === i : reach[l][c].has(i) && l * (LEG_STOPS + 1) + c <= at + SIGHT)
    leg.columns.forEach((column, c) =>
      column.forEach((node, i) => {
        if (!shown(c, i)) return
        const taken = walked(c)
        const stand = taken && standing(c)
        // Out of a tunnel, the way on leads past the columns between.
        const next = stand && !here ? open.map((k) => `${l}-${run.stop}-${k}`) : c === leg.columns.length - 1 ? [] : node.next.map((k) => `${l}-${c + 1}-${k}`)
        const state = taken ? (l === run.keys && c === run.stop ? 'here' : 'done') : ''
        const icon = !node.stop ? (c === leg.columns.length - 1 ? stopIcon(run, { kind: l === KEYS ? 'final' : 'key' } as Stop) : FOG) : stopIcon(run, node.stop, state)
        // A stop the hero stands at but has not yet set in to is tapped to set in.
        const setIn = stand && here !== null
        const choice = setIn || (open.includes(i) && l === run.keys && c === run.stop)
        const html = setIn ? `<button class="option picked" data-in>${icon}</button>` : choice ? `<button class="option${i === picked ? ' picked' : ''}" data-pick="${i}">${icon}</button>` : icon
        const pin = { id: `${l}-${c}-${i}`, at: node.at ?? run.route[l].to.at, layer: l * (LEG_STOPS + 1) + c, order: i, html, next, stand, choice, past: taken && !stand, lit: stand ? picked !== null : choice && i === picked }
        if (taken) path.push(pin.id)
        if (stand) focus = pin.at
        pins.push(pin)
      }),
    )
  })
  // At a leg's start the hero stands in the city it set out from, its trails reaching to each choice.
  if (!pins.some((p) => p.stand)) pins.push({ id: 'from', at: focus, layer: run.keys * (LEG_STOPS + 1) - 1, order: 0, html: '', next: open.map((i) => `${run.keys}-0-${i}`), stand: true, choice: false, past: false, lit: picked !== null })
  // The way on from the picked stop lights up, stop by stop.
  for (const pin of pins) if (pin.lit && !pin.stand) for (const id of pin.next) pins.forEach((p) => p.id === id && (p.lit = true))
  return { pins, focus, path }
}

/** The window the flight map is seen through: the whole screen, its stops clear of the header and hero strip above and the stop's card below. */
export const flightSize = (w: number, h: number) => ({ w, h, top: 100, bottom: 70 })

/** The run as a globe, the flight map pinned on it. */
function runMap(run: Run, picked: number | null): string {
  const { pins, focus, path } = flight(run, picked)
  // The panel is zoomed by --ui, so the window in its own pixels is that much larger.
  const ui = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1
  return `${heroStrip(run)}<div class="map flight">${globe(flightSize(innerWidth / ui, innerHeight / ui), run, pins, focus, path, picked !== null)}</div>`
}

/** The hero at a glance over the map: its badge over a health bar and count, red at half or less. */
function heroStrip(run: Run): string {
  const hero = run.hero
  const hp = health(run, hero)
  const max = soldierStats(run, hero).hp
  return `<div class="strip"><div class="mate${hp <= max / 2 ? ' low' : ''}" title="${hero.name} · ${hp}/${max}"><span class="portrait">${badge(hero.cls)}</span><div class="bar"><div style="width: ${(100 * hp) / max}%"></div></div><small>${hp}/${max}</small></div></div>`
}

/** The alien force at the hero's stop. */
function travelLabel(run: Run, stop: Stop, next: 'battle' | 'key' | 'final'): string {
  const hunt = huntForce(run, missionAt(run, next, stop.risk, next === 'battle' ? stop.goal : 'cross'))
  return `${stop.aliens.length} aliens${hunt > 0 ? ` + ${hunt} hunting` : ''}${stop.challenge === 'bigOne' ? ' + boss' : ''}`
}

/** What a stop tests, and which boons held answer it. */
function readChallenge(run: Run, stop: Stop): string {
  if (!stop.challenge) return ''
  const challenge = CHALLENGES[stop.challenge]
  const held = run.utilities.filter((h) => challenge.answers.includes(h.id))
  return `<span title="${challenge.name}: ${challenge.test}">${challenge.icon} ${THREATS[stop.challenge]}</span>${held.length > 0 ? ` <small class="down">Held: ${held.map((h) => UTILITIES[h.id].name).join(', ')}</small>` : ''}`
}

/** What the hero faces at a stop, as the map's heading. */
function where(run: Run, stop: Stop): string {
  // A stop's icon tells what it is; only a fight or a safehouse says more.
  if (stop.kind === 'safehouse') return `<b>🏠 Safehouse</b>: ${SAFEHOUSE}`
  if (stop.kind !== 'battle' && stop.kind !== 'key' && stop.kind !== 'final') return ''
  const order = `<b title="${GOALS[stop.goal].text}">${objective(stop.kind, stop.goal, stop.challenge)}</b>`
  const extras = stop.kind === 'battle' ? ` · ${RISKS[stop.risk].name}${stop.twist ? ` · <span title="${TWISTS[stop.twist].text}">${TWISTS[stop.twist].icon} ${TWISTS[stop.twist].name}</span>` : ''}` : ''
  const ground = stop.ground && ARENA_KINDS[stop.ground]
  const land = ground ? `<br><span class="ground" title="${ground.text}">${ground.icon} ${ground.name}${stop.region ? ` · ${REGIONS[stop.region].name}` : ''}</span>: ${describe(ground.text, { reads: ground.reads })}` : ''
  return `${order}${extras}${land}<br>${readChallenge(run, stop)}`
}

const PURCHASED = '<small class="purchased">Purchased</small>'

/** Everything a shop sells, as cards of one size: weapons, relics, then boons and the medkit. */
function shopShelves(run: Run): { name: string; picks: Pick[] }[] {
  const shop = run.shop!
  const held = makes(run)
  const poor = (price: number) => (price > run.supplies ? 'Not enough supplies' : null)
  const card = (top: string, name: string, foot: string, sold: boolean) => `<small>${top}</small><b>${name}</b>${sold ? PURCHASED : `<small class="price">${foot}</small>`}`
  const gear = shop.wares.map(({ gear, sold }, index): Pick => {
    const price = GEAR_PRICE[gear.rarity as keyof typeof GEAR_PRICE]
    return { key: `g${index}`, attrs: `data-ware="${index}"`, look: `gear ${gear.rarity}`, body: card(gear.rarity, gearName(gear), `${price} supplies`, sold), detail: `<p><b>${gear.name}</b>. ${describeGear(gear, held)}</p>`, go: `Tap again to buy for ${price} supplies`, block: poor(price), spent: sold }
  })
  const relics = shop.relics.map(({ id, sold }, index): Pick => ({ key: `r${index}`, action: { type: 'buy', index }, look: 'relic', body: card('relic', `${relicIcon(id)} ${RELICS[id].name}`, `${RELIC_PRICE} supplies`, sold), detail: `<p><b>${RELICS[id].name}.</b> ${describe(RELICS[id].text, RELICS[id], held)}</p>`, go: `Tap again to buy for ${RELIC_PRICE} supplies`, block: poor(RELIC_PRICE), spent: sold }))
  const utilities = shop.utilities.map(({ id, sold }, index): Pick =>
    utilityPick(run, `u${index}`, { type: 'utility', index }, id, 'boon', `Tap again to buy for ${UTILITY_PRICE} supplies${run.utilities.some((h) => h.id === id) ? ', raising its level' : run.utilities.length >= slotsOf(run) ? ', swapping 1 out' : ''}`, {
      body: card(UTILITIES[id].category, `${boonIcon(id)} ${UTILITIES[id].name}`, `${UTILITY_PRICE} supplies`, sold),
      block: poor(UTILITY_PRICE),
      spent: sold,
    }),
  )
  const medkit: Pick = { key: 'm', action: { type: 'medkit' }, look: 'medkit', body: card('medkit', '✚ Medkit', `${MEDKIT.price} supplies`, shop.medkit), detail: `<p><b>Medkit.</b> Heal ${MEDKIT.heal}. Single use. A safehouse heals to full.</p>`, go: `Tap again to pay ${MEDKIT.price} supplies`, block: wounded(run) ? poor(MEDKIT.price) : 'Full health', spent: shop.medkit }
  return [{ name: 'Weapons', picks: gear }, { name: 'Relics', picks: relics }, { name: 'Boons and the medkit', picks: [...utilities, medkit] }]
}

/** A shop: its cards, what the armed one does, and the way out. What is bought keeps its place, greyed out. With `ware` chosen, the swap, in a pop-up. */
function shopView(run: Run, armed: string | null, ware: number | null): string {
  const shelves = shopShelves(run)
  const picks = shelves.flatMap((shelf) => shelf.picks)
  const held = run.utilities.map((h) => `${boonIcon(h.id)} ${boonName(h.id, h.level)}`).join(', ') || 'none'
  const screen = `<h2>A shop. Each piece is one of a kind.</h2>
    ${shelves.filter((shelf) => shelf.picks.length > 0).map((shelf) => `<div class="shelf"><small>${shelf.name}</small><div class="picks">${shelf.picks.map((p) => pickCard(p, ware === null ? armed : null)).join('')}</div></div>`).join('')}
    <div class="shopfoot"><button class="travel" data-action='${JSON.stringify({ type: 'leave' })}'>Leave the shop</button><p class="kit">Boons ${run.utilities.length}/${slotsOf(run)}: ${held}</p></div>
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
  return `${brief(next === 'ambush' ? `<b class="up">${objective(next, 'ambush')}</b>` : next === 'battle' || next === 'key' || next === 'final' ? `${where(run, here)} · ${travelLabel(run, here, next)}` : '')}
    ${runMap(run, null)}`
}

function baseView(run: Run): string {
  const relics = run.relics.map((id) => `<div class="gear relic"><small>relic</small><br><b>${relicIcon(id)} ${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id])}</div>`)
  const doctrines = run.doctrines.map((id) => `<div class="gear doctrine"><small>oath</small><br><b>${DOCTRINES[id].name}</b><br>${DOCTRINES[id].text}</div>`)
  const utilities = run.utilities.map((h) => `<div class="gear"><small>${UTILITIES[h.id].category}</small><br><b>${boonIcon(h.id)} ${boonName(h.id, h.level)}</b><br>${boonDoes(run, h.id, h.level)}</div>`)
  const held = makes(run)
  return `${relics.length + doctrines.length + held.length + utilities.length === 0 ? '<h2>Relics, oaths and boons the hero gains show here.</h2>' : ''}
    ${utilities.length > 0 ? `<h2>Boons ${utilities.length}/${slotsOf(run)}</h2><div class="stash">${utilities.join('')}</div>` : ''}
    ${held.length > 0 ? `<h2>Your build makes</h2>${quantityChips(held, held)}` : ''}
    ${doctrines.length > 0 ? `<h2>Oaths</h2><div class="stash">${doctrines.join('')}</div>` : ''}
    ${relics.length > 0 ? `<h2>Relics</h2><div class="stash">${relics.join('')}</div>` : ''}`
}

/** Everything about the hero: its health, its sheet, its progress and its feats. */
function heroView(run: Run): string {
  const hero = run.hero
  const r = level(hero)
  const feats = hero.feats.map((id) => `<span class="chip feat" title="${FEATS[id].text}">★ ${FEATS[id].name}</span>`)
  const gear = hero.gear?.effect ? `<div class="gear ${hero.gear.rarity}">${gearCard(hero.gear)}</div>` : ''
  return `<h2>${hero.name} · ${xpFor(r + 1) - hero.xp} XP to level ${r + 1}</h2>
    ${healthBar(health(run, hero), soldierStats(run, hero).hp, soldierStats(run, hero).armor)}
    <div class="details">${heroSheet(run, hero)}${gear}${feats.length > 0 ? `<p>${feats.join(' ')}</p>` : ''}</div>`
}

/**
 * The screen between stops: a header with the keys, threat, supplies and tabs, over the chosen tab's view.
 * `armed` is the card tapped once, `ware` the shop gear being bought.
 */
export function overworld(run: Run, tab: Tab, picked: number | null, armed: string | null = null, ware: number | null = null): string {
  const views = { Map: (r: Run) => mapView(r, picked, armed, ware), Kit: baseView, Hero: heroView }
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
