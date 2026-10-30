import type { Stats } from '../core/battle'
import { CLASSES, type ClassId } from '../core/classes'
import { FEATS } from '../core/feats'
import { CIVILIANS } from '../core/goals'
import { RELICS, type RelicId } from '../core/relics'
import { health, KEYS, level, SELL, skillOffers, soldierStats, xpFor, squadKeywords, type Report, type Run, type Soldier } from '../core/run'
import { PATHS, SKILLS } from '../core/skills'
import { TRAITS } from '../core/traits'
import { button, describe, gearCard, gearText, healthBar, signed, STAT_NAMES, STOP_NAMES, threatBar } from './html'

/** Each class's badge; a soldier not yet promoted wears a helmet. */
const BADGES: Record<ClassId, string> = { assault: '🔫', heavy: '🚀', sniper: '🎯', support: '⛑️', engineer: '🔧', pyro: '🔥', cryo: '❄️' }

/**
 * A soldier's card: class badge, name, and an experience bar filling with what the battle earned, flaring on a level
 * gained; gear the soldier chose to wear drops onto it; feats first pulled off below. Hovering a note tells it.
 */
function soldierCard(run: Run, soldier: Report['soldiers'][number], opened: Set<number>): string {
  const before = level({ xp: soldier.xpBefore })
  const after = level({ xp: soldier.xpAfter })
  const filled = (xp: number) => Math.min(100, (100 * (xp - xpFor(before))) / (xpFor(before + 1) - xpFor(before)))
  const cls = soldier.cls && CLASSES[soldier.cls].name
  const gained = soldier.xpAfter - soldier.xpBefore
  const up = after > before
  const badge = soldier.taken ? '<b class="up">Taken · recovery next</b>' : up ? `<b class="down promoted">Level ${after}!</b>` : ''
  // Each find is a crate on its finder's card until opened; then what was worn shows on the card.
  const finds = run.decisions.flatMap((d, i) => (d.soldier === soldier.name ? [{ d, i }] : []))
  const crates = finds.filter(({ i }) => !opened.has(i)).map(({ i }) => `<button class="crate" data-crate="${i}" title="Open">🎁</button>`)
  const worn = finds.filter(({ d, i }) => d.kept && opened.has(i)).map(({ d }) => `<div class="gear won ${d.gear.rarity}" title="${gearText(d.gear)}&#10;${d.line}"><small>${d.gear.slot}</small> <b>${d.gear.name}</b></div>`)
  const feats = soldier.feats.map((id) => `<li class="feat" title="${FEATS[id].text}">★ ${FEATS[id].name}</li>`)
  const live = run.soldiers.find((s) => s.name === soldier.name)
  const choose = live && skillOffers(live).length > 0 ? `<button class="decide" data-ability="${live.id}">Choose ability</button>` : ''
  return `<div class="soldier ${soldier.taken ? 'died' : ''} ${up ? 'levelled' : ''}">
    <div class="who"><span class="portrait">${soldier.cls ? BADGES[soldier.cls] : '🪖'}</span><span><b>${soldier.name}</b><br><small>Level ${before}${cls ? ` · ${cls}` : ''}</small></span></div>
    <div class="bar"><div class="fill" style="--from: ${filled(soldier.xpBefore)}%; --to: ${filled(soldier.xpAfter)}%"></div></div>
    ${healthBar(soldier.hp, soldier.maxHp)}
    ${gained > 0 ? `<small class="gained" title="${soldier.earned.map((e) => `${e.label}: +${e.xp}`).join('&#10;')}">+${gained} xp</small>` : ''} ${badge}
    ${crates.length > 0 ? `<div class="crates">${crates.join('')}</div>` : ''}${worn.join('')}
    ${feats.length > 0 ? `<ul class="notes">${feats.join('')}</ul>` : ''}
    ${choose}
  </div>`
}

/** A hero joining the squad, alone on its screen: who they are, where from, and what they bring. */
export function joined(run: Run, name: string): string {
  const hero = run.soldiers.find((s) => s.name === name)!
  const path = PATHS[hero.cls!].find((p) => p.core === hero.skills[0])
  const trait = hero.trait ? TRAITS[hero.trait] : null
  const named = hero.skills.map((id) => `<span class="chip" title="${SKILLS[id].text}">${SKILLS[id].name}</span>`)
  return `<div class="debrief joined">
    <span class="portrait">${BADGES[hero.cls!]}</span>
    <h1 class="down">${hero.name} joins</h1>
    <p>${CLASSES[hero.cls!].name}${path ? ` · ${path.name}` : ''} · level ${level(hero)} · 🌍 ${hero.home?.name ?? ''}</p>
    <p class="feats">${named.join('')}</p>
    ${trait ? `<p><b>${trait.name}</b> <span class="down">${trait.pro}</span> <span class="up">${trait.con}</span></p>` : ''}
    <button class="decide" data-met="report">Continue</button>
  </div>`
}

/** A pop-up over the debrief, `html` inside it. */
export const modal = (html: string) => `<div class="modal"><div class="sheet">${html}</div></div>`

/**
 * A crate opened, in a pop-up: it shakes, bursts in its gear's rarity, and the gear rises out of it; then its finder
 * says what they do with it.
 */
export function loot(run: Run, index: number): string {
  const { soldier: name, gear, kept, line } = run.decisions[index]
  const finder = run.soldiers.find((s) => s.name === name)
  return modal(`<div class="loot ${gear.rarity}">
    <div class="burst"></div>
    <span class="box">🎁</span>
    <div class="prize gear ${gear.rarity}"><small>${gear.rarity} ${gear.slot}</small><br><b>${gear.name}</b><br><small>${gearText(gear)}</small></div>
    <p class="said"><span class="portrait">${finder?.cls ? BADGES[finder.cls] : '🪖'}</span><span><b>${name}</b>: “${line}” <span class="${kept ? 'down' : 'supplies'}">${kept ? 'Equipped' : `Sold +${SELL[gear.rarity]}`}</span></span></p>
    <button class="decide" data-shut="${index}">Nice</button>
  </div>`)
}

/** Finds sold off, each a line paying out its supplies. */
function sales(run: Run, opened: Set<number>): string {
  const sold = run.decisions.filter((d, i) => !d.kept && opened.has(i))
  return sold.length > 0 ? `<div class="sales">${sold.map(({ gear, line }) => `<p class="sold" title="${line}">🪙 Sold <span class="${gear.rarity}">${gear.name}</span> <b class="supplies chaching" style="--paid: ${SELL[gear.rarity]}"></b></p>`).join('')}</div>` : ''
}

function title(report: Report): string {
  const name = STOP_NAMES[report.stop]
  if (report.stop === 'supply' || report.stop === 'cache') return `<h1>${name}</h1>`
  return `<h1 class="${report.won ? 'down' : 'up'}">${name} ${report.won ? 'won' : 'lost'}</h1>`
}

/**
 * The first find: what its finder wears beside it, each a card to pick, with the supplies its pick sells the other for;
 * the found card shows how the finder's stats would change. A button confirms the pick.
 */
function findChoice(run: Run, pick: 'keep' | 'sell' | null): string {
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
  const gain = { keep: old ? SELL[old.rarity] : 0, sell: SELL[gear.rarity] }
  const paid = (n: number) => `<b class="supplies">+${n} ${n === 1 ? 'supply' : 'supplies'}</b>`
  const card = (choice: 'keep' | 'sell', head: string, body: string) =>
    `<button class="gearpick ${pick === choice ? 'on' : ''}" data-gear="${choice}">${head}${body}<div class="gain">${paid(gain[choice])}</div></button>`
  const keeps = card('sell', `<small>Keep what ${soldier.name} wears</small>`, `<div class="gear ${old?.rarity ?? ''}">${old ? gearCard(old) : `<small>Empty ${gear.slot} slot</small>`}</div><small>Sells the find</small>`)
  const takes = card('keep', `<small>Equip the find</small>`, `<div class="gear ${gear.rarity}">${gearCard(gear, squadKeywords(run))}</div>${rows.length > 0 ? `<table class="stats">${rows.join('')}</table>` : ''}<small>${old ? `Sells ${old.name}` : 'Nothing to sell'}</small>`)
  const confirm = pick === null ? 'Pick one' : pick === 'keep' ? `Equip ${gear.name} · ${paid(gain.keep)}` : `Keep ${old?.name ?? 'the slot empty'} · ${paid(gain.sell)}`
  return `<h2><b>${soldier.name}</b> found ${gear.rarity} gear as good as theirs and can't decide. <i>"You pick, boss."</i>${more}</h2>
    <div class="choices">${keeps}${takes}</div>
    ${button({ type: pick ?? 'keep' }, `<b>${confirm}</b>`, 'decide', pick !== null)}`
}

/** Finds their finders decided alone: who, what, worn or sold, and what they said. */
export function decisions(run: Run): string {
  return run.decisions
    .map(({ soldier, gear, kept, line }) => `<p class="decision"><b>${soldier}</b> ${kept ? 'wears' : 'sells'} the <span class="${gear.rarity}" title="${gearText(gear)}">${gear.rarity} ${gear.name}</span>${kept ? '' : ` for ${SELL[gear.rarity]} supplies`}. <i>${line}</i></p>`)
    .join('')
}

/** A skill for a soldier to learn: one of its path's next pair, each told by what it does now and nothing after. */
export function skillChoice(run: Run, soldier: Soldier): string {
  const held = squadKeywords(run)
  const path = PATHS[soldier.cls!].find((p) => p.core === soldier.skills[0])!
  const card = (id: (typeof soldier.skills)[number], index: number) => button({ type: 'skill', soldier: soldier.id, index }, `<b>${SKILLS[id].name}</b><br>${describe(SKILLS[id].text, SKILLS[id].tags, held)}`, 'card skill')
  return `<h2><b class="supplies">${soldier.name}</b>, ${path.name} ${CLASSES[soldier.cls!].name}, reached level ${soldier.skills.length + 1}. Choose one; the other is lost.</h2>
    <div class="choices">${skillOffers(soldier).map(card).join('')}</div>`
}

/** The next choice of the reward phase, alone on its screen: a relic, then each find, then each skill owed. */
export function choice(run: Run, pick: 'keep' | 'sell' | null = null): string {
  const held = squadKeywords(run)
  const relic = (id: RelicId, index: number) => button({ type: 'relic', index }, `<small>relic</small><br><b>${RELICS[id].name}</b><br>${describe(RELICS[id].text, RELICS[id].tags, held)}`, 'card relic')
  if (run.relicOffers.length > 0) return `<h2>Alien artifacts lie in the wreckage. The squad can carry one, and keeps it for the run.</h2><div class="choices">${run.relicOffers.map(relic).join('')}</div>`
  if (run.finds.length > 0) return findChoice(run, pick)
  return skillChoice(run, run.soldiers.find((s) => skillOffers(s).length > 0)!)
}

/**
 * The summary after a stop, once its choices are made, revealed top to bottom: the threat, what was gained, the squad
 * if it fought, and a button to go on.
 */
export function stopReport(run: Run, report: Report, opened: Set<number> = new Set(), still = false): string {
  const { before, after } = report.threat
  const threat = after === before ? '' : `<span class="note">${signed(after - before)}</span>`
  // The hero just joined stands with the squad that fought.
  const hero = run.soldiers.find((s) => s.name === report.hired)
  const all = [...report.soldiers, ...(hero ? [{ id: hero.id, name: hero.name, cls: hero.cls, xpBefore: hero.xp, xpAfter: hero.xp, taken: false, earned: [], feats: [], hp: health(run, hero), maxHp: soldierStats(run, hero).hp }] : [])]
  const squad = report.soldiers.length > 0 ? `<div class="stage second"><div class="squad">${all.map((s) => soldierCard(run, s, opened)).join('')}</div>${sales(run, opened)}</div>` : ''
  return `<div class="debrief${still ? ' still' : ''}">
    ${title(report)}
    <div class="stage">
      <p>Threat ${threatBar(after, Math.max(0, after - before))}${threat}</p>
      ${report.rescued !== null ? `<p class="down">${report.rescued} of ${CIVILIANS} civilians rescued</p>` : ''}
      ${report.supplies > 0 ? `<p class="supplies">+${report.supplies} supplies</p>` : ''}
      ${squad ? '' : decisions(run)}
    </div>
    ${squad}
    <div class="stage ${squad ? 'third' : 'second'}"><button data-seen="report"${run.soldiers.some((s) => skillOffers(s).length > 0) || run.decisions.some((_, i) => !opened.has(i)) ? ' disabled' : ''}>Continue</button></div>
  </div>`
}

export function runEnd(run: Run): string {
  if (run.phase === 'won') return `<h1 class="down">The source is destroyed. Earth is saved.</h1><button id="again">New run</button>`
  return `<h1 class="up">Earth has fallen</h1><h2>Lost: ${STOP_NAMES[run.mission!.kind]}, with ${run.soldiers.length} of ${KEYS + 1} heroes</h2><button id="again">New run</button>`
}
