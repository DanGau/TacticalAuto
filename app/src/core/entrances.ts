// Entrances: the squad's ways into a fight, where each comes in, and what each sets off.
import { BARRIER_ARMOR, CHILL_TURNS, ENTRANCES, GRID, IMPACT_REACH, isSoldier, type Battle, type Effect, type Entrance, type RelicEffect, type Tile, type Unit } from './battle'
import type { GameEvent } from './combat-event'
import { SMOKE_TURNS } from './consumables'
import { blocked, breach, coverAt, distance, edgeBetween, edgeDepths, freeTilesNear, heightAt, NEIGHBORS, onGrid, openNear, reachableFrom, walkingDistances, walks } from './grid'
import { has, nearest } from './fighters'
import { PROP_COVER } from './terrain'
import { randomInt } from './rng'
import { dropUnit, soldierUnit, TURRET } from './spawn'
import { TUNING } from './tuning'
import { wound } from './wound'

/** A way the squad makes its entrance. */
export type EntranceKind = 'door' | 'wall' | 'monologue' | 'skylight' | 'rappel' | 'smoke' | 'truck' | 'strike'

/** An artillery strike's threat, and the damage it does each alien of the pod it hits, never killing one. */
export const STRIKE = { threat: 2, damage: 5 }

/** Rounds a monologue holds every alien's attention, and the more Limelight adds. */
export const MONOLOGUE_ROUNDS = 2
export const LIMELIGHT_ROUNDS = 2

/** Tiles within which the smoke reaches the aliens. */
export const SMOKE_REACH = 10

/** How near where the squad comes in its charges reach aliens, and the damage Breaching Charges add to the impact. */
export const CHARGE_REACH = 8
export const CHARGE_BLAST = 3

/** The nearest an entrance comes to an assassination's commander, and to another entrance. */
export const COMMANDER_GAP = 12
export const ENTRY_SPACING = 6

/** How far within the map's edge every entrance lies. */
export const ENTRY_MARGIN = 4

/**
 * What each entrance is called and does, for the player; and how far from the nearest alien it comes in, and how it
 * ranks a tile to come in on.
 */
export const ENTRANCE_KINDS: Record<EntranceKind, { name: string; icon: string; text: string; reach: [number, number]; site: (battle: Battle, tile: Tile) => number }> = {
  door: { name: 'Kick the door', icon: '🚪', text: 'The classic: the door flies into the nearest alien, hurting it, and it loses its first action', reach: [5, 8], site: (b, t) => (ground(b, t) === 'floor' ? 2 : 0) + walled(b, t) },
  wall: { name: 'Through the wall', icon: '🧱', text: 'Charge straight through a wall: the nearest pod is caught surprised and holds its fire on its first turn', reach: [5, 8], site: (b, t) => 2 * walled(b, t) },
  monologue: { name: 'Land and monologue', icon: '🎤', text: `Drop in and taunt them: for ${MONOLOGUE_ROUNDS} rounds every alien goes for the speaker, sparing civilians and the VIP`, reach: [6, 9], site: (b, t) => (shelter(b, t) === 0 ? 2 : 0) },
  skylight: { name: 'Skylight crash', icon: '🪟', text: `Crash down among them: falling glass hurts each alien within ${IMPACT_REACH} tiles of the squad`, reach: [3, 6], site: (b, t) => (ground(b, t) === 'floor' ? 2 : 0) },
  rappel: { name: 'Rappel in', icon: '🪢', text: 'Rope down onto the highest ground over the fight', reach: [6, 10], site: (b, t) => 2 * heightAt(b, t) },
  smoke: { name: 'Out of the smoke', icon: '💨', text: `Stride out of a smoke screen: every alien within ${SMOKE_REACH} tiles is suppressed, aiming worse, for ${SMOKE_TURNS} turns`, reach: [5, 8], site: (b, t) => shelter(b, t) },
  truck: { name: 'Ram raid', icon: '🚚', text: 'Crash a truck into the nearest alien, hurting it badly; the wreck stands as full cover', reach: [5, 8], site: (b, t) => (ground(b, t) === 'road' || ground(b, t) === 'pavement' ? 2 : 0) },
  strike: { name: 'Danger close', icon: '💥', text: `Walk in behind an artillery strike: each alien of the nearest pod loses ${STRIKE.damage} health, never the last`, reach: [7, 10], site: () => 0 },
}

const KINDS = Object.keys(ENTRANCE_KINDS) as EntranceKind[]
const ground = (battle: Battle, t: Tile) => battle.ground[t.y * GRID + t.x]
/** Walls on a tile's sides. */
const walled = (battle: Battle, t: Tile) => NEIGHBORS.slice(0, 4).filter(([dx, dy]) => onGrid(t.x + dx, t.y + dy) && edgeBetween(battle, t, { x: t.x + dx, y: t.y + dy }) === 'wall').length
/** Cover on the tiles around one. */
const shelter = (battle: Battle, t: Tile) => NEIGHBORS.filter(([dx, dy]) => onGrid(t.x + dx, t.y + dy) && coverAt(battle, t.x + dx, t.y + dy) > 0).length

/** The aliens an entrance is placed by: those the squad can see coming, not burrowers underground. */
const inView = (battle: Battle) => battle.units.filter((u) => u.side === 'alien' && u.kind !== 'burrower')

/**
 * Lays out the entrances on offer: ENTRANCES of different kinds, one more with Encore, Land and Monologue always with
 * Limelight; a raid has one. Each comes in at its kind's distance from the nearest alien, by the fight, as the goal
 * asks: an assassination's never near the commander, a hold's by the uplink, a VIP rescue's by the VIP, a rescue's
 * among the civilians, clear of the aliens.
 */
export function planEntrances(battle: Battle, heart: Tile | null): void {
  const held = (effect: RelicEffect) => battle.reserve.some((r) => r.effects.includes(effect))
  const count = battle.goal === 'raid' ? 1 : ENTRANCES + (held('encore') ? 1 : 0)
  // A raid's one entrance costs nothing.
  const kinds = KINDS.filter((k) => battle.goal !== 'raid' || k !== 'strike')
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = randomInt(battle, i + 1)
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
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
    if (commander && distance(tile, commander) < COMMANDER_GAP) continue
    if (heart && distance(tile, heart) > 10) continue
    if (battle.uplink && distance(tile, battle.uplink) > 9) continue
    if (vip && distance(tile, vip) > 11) continue
    open.push(tile)
  }
  // Should the goal's ground leave no room, any the squad can walk in by will do.
  if (open.length === 0) open.push(...walkable)
  const contact = (t: Tile) => near[t.y * GRID + t.x]
  for (const kind of kinds.slice(0, count)) {
    const { reach, site } = ENTRANCE_KINDS[kind]
    const spaced = open.filter((t) => battle.entrances.every((e) => distance(e.at, t) >= ENTRY_SPACING))
    let options: Tile[] = []
    for (let widen = 0; options.length === 0 && widen < 8; widen++) options = spaced.filter((t) => contact(t) >= Math.max(3, reach[0] - widen) && contact(t) <= reach[1] + 2 * widen)
    if (options.length === 0) options = spaced.length > 0 ? spaced : open
    // Of a sample, the tile its kind ranks best.
    const sample = Array.from({ length: Math.min(60, options.length) }, () => options[randomInt(battle, options.length)])
    const at = sample.reduce((a, b) => (site(battle, b) > site(battle, a) ? b : a))
    battle.entrances.push({ kind, at })
  }
}

/**
 * The squad makes the entrance: it comes in on the free tiles nearest it, the pod nearest engages, and the battle
 * begins. What the entrance sets off lands as the first beat; see opening.
 */
export function enter(battle: Battle, entrance: Entrance): void {
  battle.entered = entrance
  deploy(battle, entrance.at)
  const squad = battle.units.filter(isSoldier)
  const near = nearestPod(battle, entrance.at)
  const held = (effect: Effect) => squad.some((u) => has(u, effect))
  if (entrance.kind === 'wall') {
    breach(battle, entrance.at)
    if (near !== null) battle.pods[near].surprised = true
  }
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
  if (held('entryWall')) for (const soldier of squad) cover(battle, soldier)
}

/** Puts the whole squad down on the free tiles nearest `at` and begins the battle, the pod nearest engaging. */
export function deploy(battle: Battle, at: Tile): void {
  const tiles = freeTilesNear(battle, at, battle.reserve.length)
  battle.reserve.forEach((soldier, i) => battle.units.push(soldierUnit(battle, soldier, tiles[i])))
  battle.reserve = []
  battle.phase = 'battle'
  battle.opening = true
  const near = nearestPod(battle, at)
  if (near !== null) battle.pods[near].engaged = true
  const squad = battle.units.filter(isSoldier)
  // A barrier projector armors every squadmate of its carrier.
  for (const carrier of squad.filter((u) => u.effects.includes('barrier'))) {
    for (const mate of squad) if (mate !== carrier) mate.armor += BARRIER_ARMOR
  }
}

/** The pod with a member nearest `at`; null with none left. */
function nearestPod(battle: Battle, at: Tile): number | null {
  return nearest(battle.units.filter((u) => u.side === 'alien'), at)?.pod ?? null
}

/** Stands `prop` on `tile` as cover, unless it would cut ground off from `soldier`. */
function raise(battle: Battle, soldier: Unit, tile: Tile, prop: 'stack' | 'truck'): void {
  const t = tile.y * GRID + tile.x
  const open = walkingDistances(battle, soldier).filter(Number.isFinite).length
  battle.props[t] = prop
  battle.cover[t] = PROP_COVER[prop]
  walks.delete(battle)
  if (walkingDistances(battle, soldier).filter(Number.isFinite).length >= open - 1) return
  battle.props[t] = 'none'
  battle.cover[t] = 0
  walks.delete(battle)
}

/** Raises full cover on the free tile beside the soldier nearest the nearest alien. */
function cover(battle: Battle, soldier: Unit): void {
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
  if (kind === 'truck' && first) hurt(first, 2 * TUNING.impactDamage)
  if (kind === 'skylight') for (const alien of aliens().filter((u) => soldiers.some((s) => distance(s, u) <= IMPACT_REACH))) hurt(alien, TUNING.impactDamage)
  if (kind === 'strike' && first) {
    for (const alien of aliens().filter((u) => u.pod === first.pod)) {
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
