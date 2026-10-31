// Entrances: the squad's ways into a fight, where each comes in, and what each sets off.
import { BARRIER_ARMOR, CHILL_TURNS, ENTRANCES, GRID, IMPACT_REACH, isSoldier, type Battle, type Effect, type Entrance, type RelicEffect, type Tile, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { SMOKE_TURNS } from './consumables'
import { blocked, breach, distance, edgeDepths, freeTilesNear, NEIGHBORS, onGrid, openNear, reachableFrom, walkingDistances, walks } from './grid'
import { engageNearest, has, joinSize, nearest } from './fighters'
import { sitesOf, SUITS, type FeatureKind, type Site } from './features'
import { PROP_BULK } from './terrain'
import { randomInt } from './rng'
import { dropUnit, soldierUnit, TURRET } from './spawn'
import { TUNING } from './tuning'
import { wound } from './wound'

/** A way the squad makes its entrance. */
export type EntranceKind = 'door' | 'wall' | 'monologue' | 'skylight' | 'rappel' | 'smoke' | 'truck' | 'strike' | 'tap' | 'look' | 'blast' | 'han' | 'mine'

/** An artillery strike's threat, and the damage it does each alien within `reach` of the nearest, never killing one. */
export const STRIKE = { threat: 2, damage: 5, reach: 3 }

/** Rounds a monologue holds every alien's attention, and the more Limelight adds. */
export const MONOLOGUE_ROUNDS = 2
export const LIMELIGHT_ROUNDS = 2

/** Tiles within which the smoke reaches the aliens. */
export const SMOKE_REACH = 10

/** How near where the squad comes in its charges reach aliens, and the damage Breaching Charges add to the impact. */
export const CHARGE_REACH = 8
export const CHARGE_BLAST = 3

/** How near an alien a shoulder tap must come in, the damage it does whom it cannot flatten, and alien turns those within LOOK_REACH of the nearest look the wrong way. */
export const TAP_REACH = 4
export const TAP_DAMAGE = 6
export const LOOK_TURNS = 2
export const LOOK_REACH = 5

/** The nearest an entrance comes to an assassination's commander, and to another entrance. */
export const COMMANDER_GAP = 12
export const ENTRY_SPACING = 6

/** How far within the map's edge every entrance lies, and the longest walk from one to the arena's centre, where the ground allows. */
export const ENTRY_MARGIN = 4
const ENTRY_WALK = 40

/**
 * What each entrance is called and does, for the player; how far from the nearest alien it comes in; how it ranks a
 * tile to come in on; and, for a tap, which tiles allow it. A feature entrance comes in only by what stands there (see
 * features.ts); the others come in anywhere, so a map with nothing standing still offers three. Some are only style, and their text says so.
 */
export const ENTRANCE_KINDS: Record<EntranceKind, { name: string; icon: string; text: string; reach: [number, number]; site: (battle: Battle, tile: Tile) => number; fits?: (battle: Battle, tile: Tile) => boolean }> = {
  door: { name: 'Kick the door', icon: '🚪', text: 'The classic: the door flies into the nearest alien, hurting it, and it loses its first action', reach: [5, 9], site: () => 0 },
  wall: { name: 'Through the wall', icon: '🧱', text: 'Charge straight through a wall: the aliens nearest are caught surprised and hold their fire on its first turn', reach: [5, 9], site: () => 0 },
  monologue: { name: 'Land and monologue', icon: '🎤', text: `Drop in and taunt them: for ${MONOLOGUE_ROUNDS} rounds every alien goes for the speaker, sparing civilians and the VIP`, reach: [6, 9], site: () => 0 },
  skylight: { name: 'Skylight crash', icon: '🪟', text: `Crash down among them: falling glass hurts each alien within ${IMPACT_REACH} tiles of the squad`, reach: [3, 9], site: () => 0 },
  rappel: { name: 'Rappel in', icon: '🪢', text: 'Rope down from the high point over the fight', reach: [5, 10], site: () => 0 },
  smoke: { name: 'Out of the smoke', icon: '💨', text: `Stride out of a smoke screen: every alien within ${SMOKE_REACH} tiles is suppressed, its attacks doing 1 less damage, for ${SMOKE_TURNS} turns`, reach: [5, 8], site: () => 0 },
  truck: { name: 'Ram raid', icon: '🚚', text: 'Crash a truck into the nearest alien, hurting it badly; the wreck stands, blocking shots', reach: [5, 9], site: () => 0 },
  strike: { name: 'Danger close', icon: '💥', text: `Walk in behind an artillery strike: the nearest aliens each lose ${STRIKE.damage} health, never the last`, reach: [7, 10], site: () => 0 },
  tap: { name: 'Shoulder tap', icon: '👉', text: `Appear right behind an alien, deep among them: the nearest turns round and is flattened (a boss or commander loses ${TAP_DAMAGE} health)`, reach: [2, 3], site: (b, t) => inView(b).filter((u) => distance(u, t) <= TAP_REACH + 1).length, fits: (b, t) => tappable(b, t) },
  look: { name: 'Look over there!', icon: '👀', text: `Land far out and point: the nearest aliens look the wrong way for ${LOOK_TURNS} alien turns while the squad crosses the ground`, reach: [10, 13], site: () => 0 },
  blast: { name: 'Big explosion', icon: '🔥', text: 'Something behind the squad blows up, nobody looks back, and the fight is on. Style only', reach: [5, 8], site: () => 0 },
  han: { name: 'Shoot first', icon: '🔫', text: 'The nearest alien starts a speech and a hero shoots it mid-word, hurting it', reach: [5, 8], site: () => 0 },
  mine: { name: 'He was mine', icon: '🎯', text: 'A hero drops a straggler another had dibs on, and hears about it. Style only', reach: [5, 8], site: () => 0 },
}

const KINDS = Object.keys(ENTRANCE_KINDS) as EntranceKind[]
const FEATURED = ['door', 'wall', 'skylight', 'rappel', 'truck'] as const satisfies FeatureKind[]
const featured = (kind: EntranceKind): kind is FeatureKind => (FEATURED as readonly string[]).includes(kind)
/** The most entrances on offer made from a feature, so the rest stay free of what the map holds. */
const MOST_FEATURED = 2

/** The aliens an entrance is placed by: those the squad can see coming, not burrowers underground. */
const inView = (battle: Battle) => battle.units.filter((u) => u.side === 'alien' && u.kind !== 'burrower')

/** Whether a tile lies by an alien and clear of any commander, whatever else the goal's ground allows. */
const tappable = (battle: Battle, t: Tile) => inView(battle).some((u) => distance(u, t) <= TAP_REACH) && battle.units.every((u) => !u.target || distance(u, t) >= COMMANDER_GAP)

/**
 * Lays out the entrances on offer: ENTRANCES of different kinds the ground supports, those made from what stands here first, one more with Encore, Land and Monologue always with
 * Limelight; a raid has one. Each comes in at its kind's distance from the nearest alien, by the fight, as the goal
 * asks: an assassination's never near the commander, a hold's by the uplink, a VIP rescue's by the VIP, a rescue's
 * among the civilians, clear of the aliens.
 */
export function planEntrances(battle: Battle, heart: Tile | null): void {
  const held = (effect: RelicEffect) => battle.reserve.some((r) => r.effects.includes(effect))
  const count = battle.goal === 'raid' ? 1 : ENTRANCES + (held('encore') ? 1 : 0)
  // A raid's one entrance is not chosen, so it neither costs threat nor lands the squad among the aliens.
  const suited = SUITS[battle.place] as EntranceKind[]
  const kinds = KINDS.filter((k) => (battle.goal !== 'raid' || (k !== 'strike' && k !== 'tap')) && (!featured(k) || suited.includes(k)))
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = randomInt(battle, i + 1)
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  kinds.sort((a, b) => Number(featured(b)) - Number(featured(a)))
  if (held('limelight') && battle.goal !== 'raid') kinds.unshift(...kinds.splice(kinds.indexOf('monologue'), 1))
  const centre = openNear(battle, battle.arena)
  const toCentre = walkingDistances(battle, centre)
  const fromCentre = reachableFrom(battle, centre)
  const aliens = inView(battle)
  const commander = battle.units.find((u) => u.target)
  const vip = battle.units.find((u) => u.civilian === 'vip')
  const depth = edgeDepths(battle)
  const near: number[] = []
  const walkable: Tile[] = []
  const open: Tile[] = []
  for (let t = 0; t < GRID * GRID; t++) {
    const tile = { x: t % GRID, y: Math.floor(t / GRID) }
    if (blocked(battle, tile.x, tile.y) || depth[t] <= ENTRY_MARGIN || toCentre[t] === Infinity || !fromCentre[t] || distance(tile, centre) > battle.arena.reach + 8) continue
    near[t] = Math.min(...aliens.map((a) => distance(a, tile)))
    walkable.push(tile)
    // Across a river, a tile near as the crow flies can be a long way round.
    if (toCentre[t] > ENTRY_WALK) continue
    if (commander && distance(tile, commander) < COMMANDER_GAP) continue
    if (heart && distance(tile, heart) > 10) continue
    if (battle.uplink && distance(tile, battle.uplink) > 9) continue
    if (vip && distance(tile, vip) > 11) continue
    open.push(tile)
  }
  // Should the goal's ground leave no room, any the squad can walk in by will do.
  if (open.length === 0) open.push(...walkable)
  const contact = (t: Tile) => near[t.y * GRID + t.x]
  const inPlay = new Set(open.map((t) => t.y * GRID + t.x))
  const fromAliens = (t: Tile) => (aliens.length > 0 ? Math.min(...aliens.map((a) => distance(a, t))) : 0)
  let made = 0
  for (const kind of kinds) {
    if (battle.entrances.length === count) break
    if (featured(kind) && made === MOST_FEATURED) continue
    const approach = battle.approaches[battle.entrances.length] ?? centre
    const { reach, site, fits } = ENTRANCE_KINDS[kind]
    const sites: Site[] = featured(kind) ? sitesOf(battle, kind, fromAliens).filter((c) => inPlay.has(c.at.y * GRID + c.at.x)) : []
    const supported = featured(kind) ? sites.map((c) => c.at) : fits ? open.filter((t) => fits(battle, t)) : open
    if (supported.length === 0) continue
    const spaced = supported.filter((t) => battle.entrances.every((e) => distance(e.at, t) >= ENTRY_SPACING))
    let options: Tile[] = []
    for (let widen = 0; options.length === 0 && widen < 8; widen++) options = spaced.filter((t) => contact(t) >= Math.max(Math.min(3, reach[0]), reach[0] - widen) && contact(t) <= reach[1] + 2 * widen)
    if (options.length === 0) options = spaced.length > 0 ? spaced : supported
    // The tile its kind ranks best, nearest the way in the encounter means it to take.
    const score = (t: Tile) => 2 * site(battle, t) - distance(t, approach)
    const at = options.reduce((a, b) => (score(b) > score(a) ? b : a))
    const feature = sites.find((c) => c.at === at)?.feature
    if (feature) made++
    battle.entrances.push(feature ? { kind, at, feature } : { kind, at })
  }
}

/**
 * The squad makes the entrance: it comes in on the free tiles nearest it, the aliens nearest engage, and the battle
 * begins. What the entrance sets off lands as the first beat; see opening.
 */
export function enter(battle: Battle, entrance: Entrance): void {
  battle.entered = entrance
  deploy(battle, entrance.at)
  const squad = battle.units.filter(isSoldier)
  const closest = nearest(battle.units.filter((u) => u.side === 'alien'), entrance.at)
  const dazed = closest ? closeBy(battle, closest, LOOK_REACH) : []
  const held = (effect: Effect) => squad.some((u) => has(u, effect))
  if (entrance.kind === 'wall') {
    breach(battle, entrance.at)
    for (const alien of dazed) alien.surprised = 1
  }
  if (entrance.kind === 'look') for (const alien of dazed) alien.surprised = LOOK_TURNS
  if (entrance.kind === 'monologue') {
    const speaker = squad.reduce((a, b) => (b.hp > a.hp ? b : a))
    battle.spotlight = { id: speaker.id, until: MONOLOGUE_ROUNDS + (held('limelight') ? LIMELIGHT_ROUNDS : 0) }
  }
  if (entrance.kind === 'truck') {
    const toward = nearest(inView(battle), entrance.at)
    const step = toward ? { x: entrance.at.x + 2 * Math.sign(toward.x - entrance.at.x), y: entrance.at.y + 2 * Math.sign(toward.y - entrance.at.y) } : entrance.at
    const [tile] = freeTilesNear(battle, step, 1)
    if (tile) raise(battle, squad[0], tile, 'truck')
  }
  for (const alien of battle.units.filter((u) => u.side === 'alien' && distance(u, entrance.at) <= CHARGE_REACH)) {
    if (held('entryShred')) alien.armor = 0
    if (held('entryFrost') && !alien.resists.includes('frost')) alien.chilled = CHILL_TURNS
  }
  if (held('entryTurret')) dropUnit(battle, squad[0], TURRET, entrance.at)
  if (held('entryWall')) for (const soldier of squad) barricade(battle, soldier)
}

/** Puts the whole squad down on the free tiles nearest `at` and begins the battle, the aliens nearest engaging. */
export function deploy(battle: Battle, at: Tile): void {
  const tiles = freeTilesNear(battle, at, battle.reserve.length)
  battle.reserve.forEach((soldier, i) => battle.units.push(soldierUnit(battle, soldier, tiles[i])))
  battle.reserve = []
  battle.phase = 'battle'
  battle.opening = true
  const squad = battle.units.filter(isSoldier)
  engageNearest(battle, [at], joinSize(squad.length))
  // A barrier projector armors every squadmate of its carrier.
  for (const carrier of squad.filter((u) => u.effects.includes('barrier'))) {
    for (const mate of squad) if (mate !== carrier) mate.armor += BARRIER_ARMOR
  }
}

/** The aliens within `reach` of `alien`, it among them. */
export const closeBy = (battle: Battle, alien: Tile, reach: number) => battle.units.filter((u) => u.side === 'alien' && distance(u, alien) <= reach)

/** Stands `prop` on `tile`, unless it would cut ground off from `soldier`. */
function raise(battle: Battle, soldier: Unit, tile: Tile, prop: 'stack' | 'truck'): void {
  const t = tile.y * GRID + tile.x
  const open = walkingDistances(battle, soldier).filter(Number.isFinite).length
  battle.props[t] = prop
  battle.bulk[t] = PROP_BULK[prop]
  walks.delete(battle)
  if (walkingDistances(battle, soldier).filter(Number.isFinite).length >= open - 1) return
  battle.props[t] = 'none'
  battle.bulk[t] = 0
  walks.delete(battle)
}

/** Raises a barricade on the free tile beside the soldier nearest the nearest alien. */
function barricade(battle: Battle, soldier: Unit): void {
  const toward = nearest(battle.units.filter((u) => u.side === 'alien'), soldier) ?? { x: GRID >> 1, y: GRID >> 1 }
  const tile = NEIGHBORS.map(([dx, dy]) => ({ x: soldier.x + dx, y: soldier.y + dy }))
    .filter((t) => onGrid(t.x, t.y) && !blocked(battle, t.x, t.y))
    .sort((a, b) => distance(a, toward) - distance(b, toward))[0]
  if (tile) raise(battle, soldier, tile, 'stack')
}

/** What the entrance sets off, as the battle's first beat, and what the squad's charges add. */
export function opening(battle: Battle): GameEvent[] {
  battle.opening = false
  const events: GameEvent[] = []
  const soldiers = battle.units.filter(isSoldier)
  const aliens = () => battle.units.filter((u) => u.side === 'alien' && u.hp > 0 && u.kind !== 'burrower')
  const hurt = (alien: Unit, amount: number) => {
    events.push({ type: 'hurt', id: alien.id, amount, cause: 'impact' })
    wound(battle, alien, amount, events)
  }
  const kind = battle.entered?.kind
  const at = battle.entered?.at
  const first = at && nearest(aliens(), at)
  if (kind === 'door' && first) {
    hurt(first, TUNING.impactDamage)
    first.panicked = true
  }
  if (kind === 'tap' && first) hurt(first, first.boss || first.target ? TAP_DAMAGE : first.hp)
  if (kind === 'han' && first) hurt(first, TUNING.impactDamage)
  if (kind === 'truck' && first) hurt(first, 2 * TUNING.impactDamage)
  if (kind === 'skylight') for (const alien of aliens().filter((u) => soldiers.some((s) => distance(s, u) <= IMPACT_REACH))) hurt(alien, TUNING.impactDamage)
  if (kind === 'strike' && first) {
    for (const alien of closeBy(battle, first, STRIKE.reach).filter((u) => u.kind !== 'burrower')) {
      const amount = Math.min(STRIKE.damage, alien.hp - 1)
      if (amount <= 0) continue
      events.push({ type: 'hurt', id: alien.id, amount, cause: 'impact' })
      wound(battle, alien, amount, events)
    }
  }
  if (kind === 'smoke' && at) {
    const smoked = aliens().filter((u) => distance(u, at) <= SMOKE_REACH)
    for (const alien of smoked) alien.suppressed = SMOKE_TURNS
    events.push({ type: 'used', consumable: 'smoke', on: smoked.map((u) => u.id) })
  }
  if (kind === 'monologue' && battle.spotlight) events.push({ type: 'effect', id: battle.spotlight.id, effect: 'taunt', amount: 0 })
  const held = (effect: Effect) => soldiers.some((s) => has(s, effect))
  if (at && (held('entryBlast') || held('entryShred') || held('entryFrost'))) {
    for (const alien of aliens().filter((u) => distance(u, at) <= CHARGE_REACH)) hurt(alien, TUNING.impactDamage + (held('entryBlast') ? CHARGE_BLAST : 0))
  }
  return events
}
