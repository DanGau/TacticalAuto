// The hero's turn: Energy, drawing, playing a card and what it does, ending the turn; and each alien's intent.
import { BASE_STATS, CHRONO_EVERY, isSoldier, PSI_RANGE, SPIT_DAMAGE, BURST_DAMAGE, MIGHT_MAX, type Battle, type Tile, type Unit } from './battle'
import { aimed, amount, CARDS, costOf, exhausts, type Card } from './cards'
import type { GameEvent } from './combat-event'
import { distance } from './grid'
import { has, onTile, shootable } from './fighters'
import { shoot } from './attack'
import { knockback } from './knockback'
import { bestPath, paths, walk } from './pathing'
import { canShoot, lineOfSight, odds } from './sight'
import { chillUnit, kindle, markUnit } from './stacks'
import { moved, wound } from './wound'
import { sight } from './sides'
import { cloakOn, feed } from './abilities'
import { randomInt } from './rng'

/** Energy the hero gains each turn, and the cards it draws. */
export const ENERGY = 3
export const DRAW = 5
/** The most cards a hand holds. */
export const HAND_MAX = 10
/** The most Aim the hero holds. */
export const AIM_MAX = 8

/** What an alien will do on its turn, as the board stands: attack `target` for `damage`, use a power, move, or nothing while stunned. */
export interface Intent {
  id: number
  kind: 'attack' | 'ability' | 'move' | 'stunned'
  target?: number
  damage?: number
}

export const heroOf = (battle: Battle) => battle.units.find(isSoldier)

/** Shuffles `deck` into the battle's draw pile. */
export function deal(battle: Battle, deck: Card[]): void {
  battle.pile = { draw: shuffled(battle, deck.map((c) => ({ ...c }))), hand: [], discard: [], exhaust: [] }
}

function shuffled<T>(battle: Battle, items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(battle, i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Draws `n` cards, shuffling the discard pile in when the draw pile runs out. */
export function draw(battle: Battle, n: number): void {
  const pile = battle.pile
  for (let i = 0; i < n && pile.hand.length < HAND_MAX; i++) {
    if (pile.draw.length === 0) {
      pile.draw = shuffled(battle, pile.discard)
      pile.discard = []
    }
    const card = pile.draw.shift()
    if (!card) return
    pile.hand.push(card)
  }
}

/** The hero's turn begins: Block falls to 0, it gains its Energy and draws. A stunned hero gains none. */
export function beginTurn(battle: Battle): void {
  const hero = heroOf(battle)
  battle.energy = ENERGY
  if (hero) {
    hero.block = 0
    if (hero.panicked || hero.frozen) {
      battle.energy = 0
      hero.panicked = false
      hero.frozen = false
    }
  }
  // Chrono Coil: every CHRONO_EVERY rounds, 1 Energy more.
  if (hero && has(hero, 'chrono') && battle.round % CHRONO_EVERY === 0) battle.energy++
  draw(battle, DRAW + (hero && has(hero, 'satchel') ? 1 : 0))
  battle.stage = 'play'
  battle.intents = intents(battle)
}

/** Ends the hero's turn: the hand is discarded, but cards with Retain. */
export function endTurn(battle: Battle): void {
  const pile = battle.pile
  pile.discard.push(...pile.hand.filter((c) => !CARDS[c.id].retain))
  pile.hand = pile.hand.filter((c) => CARDS[c.id].retain)
  battle.stage = 'enemy'
  battle.turn = 'alien'
  battle.shooter = 0
  battle.intents = []
}

/** The reach of a card's hits: its own, else the hero's weapon's. */
const reachOf = (card: Card, hero: Unit) => CARDS[card.id].range ?? hero.stats.range

/** Tiles the card moves the hero, none while it is rooted. */
const stepsOf = (card: Card, hero: Unit) => (hero.rooted > 0 ? 0 : amount(card.id, card.level, 'move'))

/** The aliens a card may be aimed at: revealed, and in reach from where the hero stands or can step to. A move alone may aim at any alien revealed. */
export function targetsOf(battle: Battle, card: Card): Unit[] {
  const hero = heroOf(battle)
  if (!hero || !aimed(card.id)) return []
  const aliens = battle.units.filter((u) => u.side === 'alien' && u.revealed && u.hp > 0 && !u.cloaked)
  const kind = CARDS[card.id]
  if (kind.type === 'skill' && kind.move && !kind.damage && !kind.pull && !kind.stun) return aliens
  const aim = { ...hero, stats: { ...hero.stats, range: reachOf(card, hero) } }
  const steps = stepsOf(card, hero)
  const ends: Tile[] = steps > 0 ? [hero, ...paths(battle, hero, steps).flatMap((p) => p.slice(-1))] : [hero]
  return aliens.filter((a) => ends.some((end) => shootable(battle, aim, end, a)))
}

/** Why the card at `index` of the hand cannot be played at `target`, or null if it can. */
export function whyNot(battle: Battle, index: number, target: number | null): string | null {
  const card = battle.pile.hand[index]
  if (!card) return 'No such card.'
  if (costOf(card) > battle.energy) return 'Not enough Energy.'
  if (!aimed(card.id)) return null
  const targets = targetsOf(battle, card)
  if (targets.length === 0) return `No target in range ${reachOf(card, heroOf(battle)!)}.`
  if (target === null) return 'Choose a target.'
  return targets.some((t) => t.id === target) ? null : 'Out of range.'
}

/** Plays the card queued: pays for it, then does what it says, in its text's order. */
export function resolve(battle: Battle): GameEvent[] {
  const queued = battle.queued!
  battle.queued = null
  const hero = heroOf(battle)
  const pile = battle.pile
  const [card] = pile.hand.splice(queued.index, 1)
  battle.energy -= costOf(card)
  if (exhausts(card) || CARDS[card.id].type === 'power') pile.exhaust.push(card)
  else pile.discard.push(card)
  const events: GameEvent[] = []
  if (!hero) return events
  const kind = CARDS[card.id]
  const n = (of: Parameters<typeof amount>[2]) => amount(card.id, card.level, of)
  const target = battle.units.find((u) => u.id === queued.target)
  const src = { kind: 'card' as const, id: card.id }
  if (stepsOf(card, hero) > 0) step(battle, hero, card, target, events)
  const caught = target ? [target, ...(kind.area ? battle.units.filter((u) => u.side === 'alien' && u !== target && u.revealed && distance(u, target) <= kind.area!) : [])] : []
  battle.actor = hero.id
  if (target && n('damage') > 0) {
    const { hits, damage } = volley(hero, Math.max(1, n('hits')), n('damage'))
    const first = hero.aim + (target.mark > 0 ? n('marked') : 0)
    hero.aim = 0
    for (let hit = 0; hit < hits && target.hp > 0 && hero.hp > 0; hit++) events.push(...strike(battle, hero, target, damage + (hit === 0 ? first : 0), reachOf(card, hero), hit))
    for (const other of caught.slice(1).filter((u) => u.hp > 0)) {
      const dealt = n('damage') + strength(hero) + odds(battle, hero, other)
      events.push({ type: 'hurt', id: other.id, amount: dealt, cause: 'impact' })
      wound(battle, other, dealt, events)
    }
  }
  for (const foe of caught.filter((u) => u.hp > 0)) {
    if (n('burn') > 0) kindle(battle, foe, n('burn'), events)
    if (n('chill') > 0) chillUnit(battle, foe, n('chill'), events)
    if (n('mark') > 0 && foe.numb === 0 && !foe.resists.includes('mark')) markUnit(foe, n('mark'))
    if (kind.stun && !foe.boss) {
      foe.panicked = true
      events.push({ type: 'effect', src, id: foe.id, effect: 'stun', amount: 0 })
    }
  }
  if (target && target.hp > 0 && n('knock') > 0) knockback(battle, hero, target, events, 1, n('knock'))
  if (target && target.hp > 0 && n('pull') > 0) knockback(battle, hero, target, events, -1, n('pull'), 0, 'tether')
  battle.actor = null
  if (n('retreat') > 0 && hero.rooted === 0) retreat(battle, hero, n('retreat'), events)
  hero.block = (hero.block ?? 0) + n('block')
  hero.armor += n('armor')
  if (n('heal') > 0) {
    const healed = Math.min(n('heal'), hero.stats.hp - hero.hp)
    hero.hp += healed
    events.push({ type: 'heal', src, id: hero.id, target: hero.id, amount: healed })
  }
  if (kind.cloak) events.push(cloakOn(hero))
  battle.energy += n('energy')
  draw(battle, n('draw'))
  hero.might = Math.min(MIGHT_MAX, hero.might + n('might'))
  hero.aim = Math.min(AIM_MAX, hero.aim + n('aim'))
  if (kind.lends && !hero.effects.includes(kind.lends)) hero.effects.push(kind.lends)
  events.push(...feed(battle, hero, events))
  battle.intents = intents(battle)
  return events
}

/** Damage a hero's hits do more for its stats beyond the base: from its class, gear and level. */
const strength = (hero: Unit) => hero.stats.damage - BASE_STATS.damage

/** A card's hits as the hero lands them: Twinned gear and Hair Trigger each add a hit to one of 2 or more; Split Rounds doubles the hits at half damage. */
function volley(hero: Unit, hits: number, damage: number): { hits: number; damage: number } {
  const more = hits >= 2 ? (['twinned', 'hairTrigger'] as const).filter((e) => has(hero, e)).length : 0
  return has(hero, 'split') ? { hits: 2 * (hits + more), damage: Math.max(1, Math.floor(damage / 2)) } : { hits: hits + more, damage }
}

/** One hit of a card on `target`, `nth` of its hits, which every gear, relic and Power effect on the hero shapes. */
function strike(battle: Battle, hero: Unit, target: Unit, damage: number, range: number, nth: number): GameEvent[] {
  hero.dealing = damage + strength(hero)
  const events = shoot(battle, hero, undefined, target, { range, nth })
  delete hero.dealing
  return events
}

/** The hero steps toward `target` to the nearest tile with a shot at it, or as near as it gets; with no target, to the tile with a shot at the most aliens. */
function step(battle: Battle, hero: Unit, card: Card, target: Unit | undefined, events: GameEvent[]): void {
  const aim = { ...hero, stats: { ...hero.stats, range: CARDS[card.id].damage ? reachOf(card, hero) : hero.stats.range } }
  const aliens = battle.units.filter((u) => u.side === 'alien' && u.revealed)
  const harm = (end: Tile) => (onTile(battle.acid, end) || onTile(battle.fire, end) ? 1 : 0)
  const path = bestPath(paths(battle, hero, stepsOf(card, hero)), hero, (end, steps) =>
    target ? [harm(end), shootable(battle, aim, end, target) ? 0 : 1, distance(end, target), steps] : [harm(end), -aliens.filter((a) => shootable(battle, aim, end, a)).length, steps],
  )
  go(battle, hero, path, events)
}

/** The path a Retreat of up to `tiles` takes: to the tile where the aliens' intents deal the hero least, then farthest from the nearest. */
export function retreatPath(battle: Battle, hero: Unit, tiles: number): Tile[] {
  const aliens = battle.units.filter((u) => u.side === 'alien' && u.engaged)
  if (aliens.length === 0) return []
  const harm = (end: Tile) => (onTile(battle.acid, end) || onTile(battle.fire, end) ? 1 : 0)
  return bestPath(paths(battle, hero, tiles), hero, (end, steps) => [harm(end), threatAt(battle, hero, end), -Math.min(...aliens.map((a) => distance(a, end))), steps])
}

function retreat(battle: Battle, hero: Unit, tiles: number, events: GameEvent[]): void {
  go(battle, hero, retreatPath(battle, hero, tiles), events)
}

/** Damage the aliens' intents would deal the hero standing on `tile`, before its Block; a power aimed at it counts as PANIC_THREAT. */
export function threatAt(battle: Battle, hero: Unit, tile: Tile): number {
  const from = { x: hero.x, y: hero.y }
  Object.assign(hero, { x: tile.x, y: tile.y })
  const threat = intents(battle).reduce((sum, i) => sum + (i.target !== hero.id ? 0 : i.kind === 'attack' ? (i.damage ?? 0) : i.kind === 'ability' ? PANIC_THREAT : 0), 0)
  Object.assign(hero, from)
  return threat
}
export const PANIC_THREAT = 3

function go(battle: Battle, hero: Unit, path: Tile[], events: GameEvent[]): void {
  if (path.length === 0) return
  walk(battle, hero, path, events)
  moved(battle, hero, events)
  events.push(...sight(battle))
}

/** What each alien in the fight will do on its turn, as the board stands now. */
export function intents(battle: Battle): Intent[] {
  return battle.units.filter((u) => u.side === 'alien' && u.engaged && u.revealed).map((u) => intentOf(battle, u))
}

function intentOf(battle: Battle, alien: Unit): Intent {
  const id = alien.id
  if (alien.surprised > 0 || alien.panicked || alien.frozen) return { id, kind: 'stunned' }
  const humans = battle.units.filter((u) => u.side === 'human' && !u.cloaked)
  const hero = heroOf(battle)
  if (alien.kind === 'psion' && alien.cooldown <= 0 && hero && !hero.cloaked && distance(alien, hero) <= PSI_RANGE && lineOfSight(battle, alien, hero)) return { id, kind: 'ability', target: hero.id }
  if (alien.kind === 'burster') {
    const near = humans.find((u) => distance(alien, u) <= 1)
    return near ? { id, kind: 'attack', target: near.id, damage: BURST_DAMAGE } : { id, kind: 'move' }
  }
  if (alien.kind === 'incubator') return { id, kind: 'ability' }
  const inReach = humans.filter((u) => canShoot(battle, alien, u, alien.stats.range))
  // An alien shoots the hero when it can, a civilian only with no shot at the hero.
  const target = inReach.find(isSoldier) ?? inReach[0]
  if (!target) return { id, kind: 'move' }
  if (alien.kind === 'spitter') return { id, kind: 'attack', target: target.id, damage: SPIT_DAMAGE }
  const damage = Math.max(1, alien.stats.damage + alien.might + odds(battle, alien, target) - (alien.chill > 0 ? 1 : 0) - (alien.suppressed > 0 ? 1 : 0))
  return { id, kind: 'attack', target: target.id, damage }
}
