// Creating a battle: its state, its encounter, the aliens, civilians and goals placed by it.
import { type Battle, type Tile, type Reserve, GRID, type Unit, type Alien } from './battle'
import { randomInt } from './rng'
import { onGrid, distance, freeTilesNear, walkingDistances, spacedTile, NEIGHBORS, passable, openNear, walks } from './grid'
import { alienUnit, civilianUnit } from './spawn'
import { PROP_BULK, type TerrainKind, type Locale } from './terrain'
import type { Rule } from './doctrines'
import { flowOf, type Goal, VIP_HP, CIVILIANS, CIVILIAN_HP } from './goals'
import { generateTerrain } from './terrain-gen'
import type { Twist } from './twists'
import { deploy, planEntry } from './landing'
import { noDuos } from './duo-effects'
import { ARENA_REACH, designEncounter } from './encounter'
import { deadlineFor, sentries, type ChallengeId } from './challenges'

/** Lays each soldier the aliens hold on a recovery beside an alien, in turn. */
export function holdCaptives(battle: Battle, captives: Reserve[]): void {
  battle.captives = captives
  const guards = battle.units.filter((u) => u.side === 'alien')
  captives.forEach((captive, i) => {
    const [tile] = freeTilesNear(battle, guards[i % guards.length], 12).filter((t) => !battle.downed.some((d) => d.x === t.x && d.y === t.y))
    battle.downed.push({ soldier: captive.soldier, ...tile, carrier: null })
  })
}

/** Fills every open tile outside the largest walkable area with stacks, so any open tile can reach any other. */
export function sealPockets(battle: Battle): void {
  const area = Array<number>(GRID * GRID).fill(-1)
  const sizes: number[] = []
  for (let start = 0; start < GRID * GRID; start++) {
    if (battle.bulk[start] > 0 || area[start] >= 0) continue
    area[start] = sizes.length
    const queue = [start]
    for (const tile of queue) {
      for (const [dx, dy] of NEIGHBORS) {
        const x = (tile % GRID) + dx
        const y = Math.floor(tile / GRID) + dy
        const from = { x: tile % GRID, y: Math.floor(tile / GRID) }
        if (!onGrid(x, y) || battle.bulk[y * GRID + x] > 0 || area[y * GRID + x] >= 0 || !passable(battle, from, { x, y })) continue
        area[y * GRID + x] = sizes.length
        queue.push(y * GRID + x)
      }
    }
    sizes.push(queue.length)
  }
  const largest = sizes.indexOf(Math.max(...sizes))
  area.forEach((id, tile) => {
    if (id < 0 || id === largest) return
    battle.bulk[tile] = 2
    battle.props[tile] = 'stack'
  })
  walks.delete(battle)
}

/** Places an alien on `tile`. One that never moves stands where it walls no ground off, as seen from across the map. */
export function placeAlien(battle: Battle, alien: Alien, tile: Tile, engaged = false, seen = true): Unit {
  const unit = alienUnit(battle, alien, tile, engaged, seen)
  if (unit.stats.move === 0) {
    const far = openNear(battle, { x: GRID - 1 - tile.x, y: GRID - 1 - tile.y })
    const open = walkingDistances(battle, far).filter(Number.isFinite).length
    const clear = freeTilesNear(battle, tile, 30).find((t) => {
      Object.assign(unit, t)
      battle.units.push(unit)
      const walls = walkingDistances(battle, far).filter(Number.isFinite).length < open - 1
      battle.units.pop()
      return !walls
    })
    Object.assign(unit, clear ?? tile)
  }
  battle.units.push(unit)
  return unit
}

/** The tiles a squad of the reach of its longest weapon must walk from the way in to shoot each sentry, nearest first. */
function sentryTour(battle: Battle): number {
  const reach = Math.max(...battle.reserve.map((s) => s.stats.range))
  const left = battle.units.filter((u) => u.side === 'alien')
  let at: Tile = battle.entry!
  let tour = 0
  while (left.length > 0) {
    const next = left.reduce((a, b) => (distance(b, at) < distance(a, at) ? b : a))
    tour += Math.max(0, distance(next, at) - reach)
    left.splice(left.indexOf(next), 1)
    at = next
  }
  return tour
}

/** The fewest aliens a wave brings, and how many more it may. */
const WAVE_LEAST = 2
const WAVE_MORE = 4

/** `aliens` as clumps of varied size. */
function clumps(battle: Battle, aliens: Alien[]): Alien[][] {
  const left = [...aliens]
  const waves: Alien[][] = []
  while (left.length > 0) waves.push(left.splice(0, (battle.challenge === 'swarm' ? 2 : 1) * (WAVE_LEAST + randomInt(battle, WAVE_MORE))))
  return waves
}

/** The share of a flood's aliens posted at the start; the rest come as waves. */
const FLOOD_POSTED = 1 / 3

/** Tiles apart a rescue's civilians start, from each other and the aliens, and the farthest from the terror's heart. */
export const CIVILIAN_CLEARANCE = 4

export const TERROR_REACH = 10

/** The supply caches a raid goes for. */
export const CACHES = 3

/**
 * A battle awaiting the squad's landing, its encounter designed as one piece: see designEncounter. A flood keeps most
 * of its aliens back as waves; a rescue's civilians are scattered about the terror's heart. An ambush has no landing: the squad
 * is down in the arena's middle.
 */
export function createBattle(seed: number, kind: TerrainKind, aliens: Alien[], reserve: Reserve[], goal: Goal = 'exterminate', rules: Rule[] = [], twist: Twist | null = null, place?: Locale, challenge: ChallengeId | null = null): Battle {
  const holder = { rng: seed }
  const terrain = generateTerrain(holder, GRID, kind, twist, place)
  const battle: Battle = {
    rng: holder.rng,
    goal,
    rules,
    twist,
    round: 0,
    flow: flowOf(goal, kind, challenge),
    waves: [],
    beat: 0,
    phase: 'deploy',
    turn: 'human',
    stage: 'move',
    shooter: 0,
    attacks: 0,
    strides: {},
    winner: null,
    units: [],
    nextId: 1,
    place: kind,
    ...terrain,
    bulk: terrain.props.map((prop) => PROP_BULK[prop]),
    used: [],
    duos: noDuos(),
    challenge,
    deadline: challenge === 'scattered' ? 0 : null,
    utility: null,
    rigged: null,
    smoked: {},
    acid: [],
    fire: [],
    caltrops: [],
    husks: [],
    saved: 0,
    vip: goal === 'vip' ? 'held' : null,
    held: 0,
    actor: null,
    tally: {},
    marching: null,
    entry: null,
    arena: { x: 0, y: 0, reach: ARENA_REACH },
    approach: { x: 0, y: 0 },
    gates: [],
    rallied: 0,
    uplink: null,
    extract: null,
    escaped: [],
    lifted: {},
    caches: [],
    grabbed: 0,
    opening: false,
    reserve,
    downed: [],
    captives: [],
  }
  sealPockets(battle)
  const flood = battle.flow === 'flood'
  const posted = flood ? aliens.slice(0, Math.ceil(aliens.length * FLOOD_POSTED)) : battle.deadline !== null ? aliens.slice(0, sentries(aliens.length)) : aliens
  const { spot, posts, clusters, heart } = designEncounter(battle, posted, goal, challenge)
  if (flood || battle.deadline !== null) battle.waves = clumps(battle, goal === 'hold' && posted.length === aliens.length ? aliens : aliens.slice(posted.length))
  sealPockets(battle)
  const centre = openNear(battle, spot)
  const vip = goal === 'vip' ? centre : null
  if (goal === 'hold') battle.uplink = centre
  if (vip) battle.units.push(civilianUnit(battle, vip, VIP_HP, 'vip'))
  const ambush = goal === 'ambush'
  posted.forEach((alien, i) => {
    placeAlien(battle, alien, posts[i]).cluster = clusters[i]
  })
  if (ambush) {
    deploy(battle, centre)
    return battle
  }
  // A rescue's civilians are scattered about the terror's heart, half hiding where they are, half running from the aliens.
  if (heart) {
    for (let i = 0; i < CIVILIANS; i++) {
      let tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE)
      for (let tries = 0; distance(tile, heart) > TERROR_REACH && tries < 500; tries++) tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE - Math.floor(tries / 100))
      battle.units.push(civilianUnit(battle, tile, CIVILIAN_HP, i % 2 === 0 ? 'hider' : 'runner'))
    }
  }
  // A raid's caches each stand by an alien, guarded.
  if (goal === 'raid') battle.caches = Array.from({ length: CACHES }, (_, i) => {
    const guards = posts.filter((_, p) => clusters.indexOf(clusters[p]) === p)
    const guard = guards[i] ?? posts[i] ?? null
    return guard ? (freeTilesNear(battle, guard, 4)[3] ?? guard) : freeTilesNear(battle, spot, 40)[10 * i]
  })
  planEntry(battle, heart)
  if (battle.deadline !== null) battle.deadline = deadlineFor(sentryTour(battle), Math.max(...reserve.map((s) => s.stats.move)), posted.length)
  return battle
}
