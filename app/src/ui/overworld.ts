import { ALIENS, DANGERS, type AlienKind } from '../core/aliens'
import { CLASSES } from '../core/classes'
import { GOALS } from '../core/goals'
import { SLOTS } from '../core/gear'
import { DOCTRINES } from '../core/doctrines'
import { BRIBE, CREDIT_THREAT, EVENTS, RELIC_PRICE } from '../core/events'
import { RELICS, type Relic } from '../core/relics'
import { current, legOf, GEAR_PRICE, KEYS, LEG_STOPS, ways, charges, equipped, level, missionAt, nextStop, RISKS, soldierStats, xpFor, squadKeywords, type Muster, type Run, type Soldier, type Stop } from '../core/run'
import { FEATS } from '../core/feats'
import { PATHS, SKILLS } from '../core/skills'
import { TERRAIN_TEXT } from '../core/terrain'
import { TWISTS, type Twist } from '../core/twists'
import { CONTINENTS, type LonLat } from '../core/world'
import { globe, type Pin } from './globe'
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

const STOP_ICONS: Record<Stop['kind'], string> = { battle: '⚔️', supply: '📦', cache: '🎁', shop: '🛒', unknown: '❓', key: '⭐', final: '👁️' }

/** A twist told in a sentence, or nothing. */
const twistLine = (twist: Twist | null) => (twist ? ` ${TWISTS[twist].icon} ${TWISTS[twist].name}: ${TWISTS[twist].text}.` : '')

/**
 * A stop as an icon; a battle's is coloured by its risk and marked by its twist, and hovering tells its goal, place, pay and twist.
 * `state` is done, here, or empty for ahead.
 */
function stopIcon(run: Run, stop: Stop, state = ''): string {
  if (stop.kind !== 'battle') return `<span class="node ${stop.kind} ${state}" title="${STOP_NAMES[stop.kind]}">${STOP_ICONS[stop.kind]}</span>`
  const risk = RISKS[stop.risk]
  const goal = GOALS[stop.goal]
  const aliens = census(run, stop.packs) + (stop.goal === 'assassinate' ? ', a Commander' : '')
  return `<span class="node ${stop.risk} ${state}" title="${risk.name} ${goal.name}, ${TERRAIN_TEXT[stop.terrain].name}: pays ${goal.reward}. ${aliens.replace(/<[^>]*>/g, '')}.${twistLine(stop.twist)}">${STOP_ICONS.battle}${stop.twist ? `<sup>${TWISTS[stop.twist].icon}</sup>` : ''}</span>`
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
  // The stops the squad can still reach, leg by leg and column by column.
  const reach = run.legs.map((leg) => leg.columns.map(() => new Set<number>()))
  for (const i of here ? [legOf(run).path[run.stop]] : open) reach[run.keys][run.stop].add(i)
  for (let l = run.keys; l < run.legs.length; l++) {
    const { columns } = run.legs[l]
    for (let c = l === run.keys ? run.stop : 0; c < columns.length; c++) {
      for (const i of reach[l][c]) {
        if (c < columns.length - 1) for (const k of columns[c][i].next) reach[l][c + 1].add(k)
        else run.legs[l + 1]?.columns[0].forEach((_, k) => reach[l + 1][0].add(k))
      }
    }
  }
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
        const next = c === leg.columns.length - 1 ? (run.legs[l + 1]?.columns[0].map((_, k) => `${l + 1}-0-${k}`) ?? []) : node.next.map((k) => `${l}-${c + 1}-${k}`)
        const state = taken ? (l === run.keys && c === run.stop ? 'here' : 'done') : ''
        const icon = !node.stop ? (c === leg.columns.length - 1 ? stopIcon(run, { kind: l === KEYS ? 'final' : 'key' } as Stop) : FOG) : stopIcon(run, node.stop, state)
        const html = open.includes(i) && l === run.keys && c === run.stop ? `<button class="option${i === picked ? ' picked' : ''}" data-pick="${i}">${icon}</button>` : icon
        const squad = taken && standing(c)
        const choice = open.includes(i) && l === run.keys && c === run.stop
        const pin = { id: `${l}-${c}-${i}`, at: node.at ?? run.route[l].to.at, html, next, squad, choice, lit: squad ? picked !== null : choice && i === picked }
        if (taken) path.push(pin.at)
        if (squad) focus = pin.at
        pins.push(pin)
      }),
    )
  })
  // At a leg's start the squad stands in the city it set out from, its trails reaching to each choice.
  if (!pins.some((p) => p.squad)) pins.push({ id: 'from', at: focus, html: '', next: open.map((i) => `${run.keys}-0-${i}`), squad: true, choice: false, lit: picked !== null })
  const stage = run.route[run.keys]
  const banner = stage.hero ? `Leg ${run.keys + 1} of ${KEYS}: across ${CONTINENTS[stage.continent!].name} to ${stage.hero.name}, waiting in ${stage.to.name}, ${stage.to.country}.` : 'The last leg: to the alien hub under the Antarctic ice.'
  // The way on from the picked stop lights up, stop by stop.
  for (const pin of pins) if (pin.lit && !pin.squad) for (const id of pin.next) pins.forEach((p) => p.id === id && (p.lit = true))
  return `<p class="progress">${banner}</p><div class="map">${globe(run, pins, focus, path, picked !== null)}</div>`
}

/** The words on the button that travels to the next stop. */
function travelLabel(run: Run, stop: Stop, next: NonNullable<ReturnType<typeof nextStop>>): string {
  if (next === 'supply' || next === 'cache') return `Collect the ${STOP_NAMES[next].toLowerCase()}`
  if (next === 'shop') return 'Enter the shop'
  if (next === 'unknown') return 'Find out what lies ahead'
  const mission = missionAt(run, next, stop.risk, next === 'battle' ? stop.goal : 'exterminate')
  const stakes = next === 'escape' || next === 'final' ? ' · lose and the run ends' : ''
  return `<b>${STOP_NAMES[next]}</b><br>Alien force ${mission.force}${next === 'key' || next === 'final' ? ', with a boss' : ''}${stakes}`
}

/** What the squad faces at a stop, as the map's heading. */
function where(run: Run, stop: Stop): string {
  const stage = run.route[run.keys]
  if (stop.kind === 'final') return 'The squad is whole. Under the ice lies the alien hub: raid it, and end this.'
  if (stop.kind === 'key') return `${stage.hero!.name} holds out in ${stage.to.name}, surrounded. Get them out: lose them, and the run is over.`
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
    `<div class="buy">${button({ type: 'buy', index }, `<small>relic · ${RELIC_PRICE} supplies</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags, held)}`, 'card relic', RELIC_PRICE <= run.supplies)}${button({ type: 'owe', index }, `<small class="up">or on credit: +${CREDIT_THREAT} threat</small>`, 'credit')}</div>`,
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

/** The map: a shop or event being met; else the run's map, with the ways on to choose from or a button to travel on. */
/** The map, with the stop the player has picked to look at but not yet set out for, if any. */
function mapView(run: Run, picked: number | null): string {
  if (run.phase === 'shop') return shopView(run)
  if (run.phase === 'event') return eventView(run)
  const node = current(run)
  const ahead = picked !== null && ways(run).includes(picked) ? legOf(run).columns[run.stop][picked].stop : null
  if (!node && !ahead) return `${run.report ? '' : decisions(run)}<h2>Choose where to go next. Tap a stop to see what waits there and where it leads.</h2>${runMap(run, null)}`
  if (!node)
    return `${run.report ? '' : decisions(run)}<h2>${where(run, ahead!)}</h2>
    ${runMap(run, picked)}
    <p class="progress">Tap it again to set out, or tap another stop to compare.</p>`
  const next = nextStop(run)!
  const here = node.stop!
  return `${run.report ? '' : decisions(run)}<h2>${where(run, here)}</h2>
    ${runMap(run, null)}
    ${next === 'escape' ? '<p class="up"><b>The threat is full. The squad is ambushed on the road and must escape.</b></p>' : ''}
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
export function overworld(run: Run, tab: Tab, open: number | null, picked: number | null): string {
  const views = { Map: (r: Run) => mapView(r, picked), Base: baseView, Barracks: (r: Run) => barracksView(r, open) }
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
