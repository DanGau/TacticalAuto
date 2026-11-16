// Creating a battle: its state, its encounter, the aliens, civilians and goals placed by it.
import { type Battle, type Tile, type Reserve, GRID, type Unit, type Alien } from './battle'
import { randomInt } from './rng'
import { onGrid, distance, freeTilesNear, walkingDistances, spacedTile, NEIGHBORS, passable, openNear, walks } from './grid'
import { alienUnit, civilianUnit } from './spawn'
import { PROP_BULK, type TerrainKind, type Locale } from './terrain'
import type { Rule } from './doctrines'
import { flowOf, type Goal, CIVILIANS, CIVILIAN_HP } from './goals'
import { generateTerrain } from './terrain-gen'
import type { Twist } from './twists'
import { deploy, planEntry } from './landing'
import { ARENA_REACH, designEncounter } from './encounter'
import { deadlineFor, sentries, type ChallengeId } from './challenges'
import { clockFor, routeWalk } from './route'

/** Fills every open tile outside the walkable area holding `keep`, or else the largest, with stacks, so any open tile can reach any other. */
export function sealPockets(battle: Battle, keep?: Tile): void {
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
  const held = keep ? area[keep.y * GRID + keep.x] : -1
  const largest = held >= 0 ? held : sizes.indexOf(Math.max(...sizes))
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

/** The share of a clocked crossing's aliens held back as reinforcements, which pour in once its clock runs out. */
const HELD_BACK = 1 / 2

/** Whether a battle runs on a clock: a crossing or a takedown, but where a boss waits at the objective, which is the fight. */
const clocked = (goal: Goal, challenge: ChallengeId | null, aliens: Alien[]) => (goal === 'cross' || goal === 'assassinate') && challenge !== 'bigOne' && !aliens.some((a) => a.boss)

/** The share of a flood's aliens posted at the start; the rest come as waves. */
const FLOOD_POSTED = 1 / 3

/** Tiles apart a rescue's civilians start, from each other and the aliens, and the farthest from the terror's heart. */
export const CIVILIAN_CLEARANCE = 4

export const TERROR_REACH = 10

/**
 * A battle awaiting the hero's landing, its encounter designed as one piece: see designEncounter. A flood keeps most
 * of its aliens back as waves; a rescue's civilians are scattered about the objective. A crossing's and an ambush's
 * objective is the extraction zone. An ambush has no deploy screen: the hero is down at once.
 */
export function createBattle(seed: number, kind: TerrainKind, aliens: Alien[], reserve: Reserve[], goal: Goal = 'cross', rules: Rule[] = [], twist: Twist | null = null, place?: Locale, challenge: ChallengeId | null = null): Battle {
  const holder = { rng: seed }
  const terrain = generateTerrain(holder, GRID, kind, twist, place)
  const battle: Battle = {
    rng: holder.rng,
    goal,
    rules,
    twist,
    round: 0,
    flow: flowOf(goal, challenge),
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
    arenaKind: 'open',
    ...terrain,
    bulk: terrain.props.map((prop) => PROP_BULK[prop]),
    used: [],
    challenge,
    deadline: challenge === 'scattered' || clocked(goal, challenge, aliens) ? 0 : null,
    utility: null,
    second: null,
    kills: 0,
    rigged: null,
    boons: [],
    acid: [],
    fire: [],
    caltrops: [],
    husks: [],
    saved: 0,
    held: 0,
    actor: null,
    tally: {},
    marching: null,
    entry: null,
    objective: { x: 0, y: 0 },
    quarry: aliens.some((a) => a.target),
    arena: { x: 0, y: 0, reach: ARENA_REACH },
    approach: { x: 0, y: 0 },
    gates: [],
    rallied: 0,
    uplink: null,
    extract: null,
    escaped: [],
    lifted: {},
    opening: false,
    reserve,
    downed: [],
  }
  sealPockets(battle)
  const flood = battle.flow === 'flood'
  const posted = flood ? aliens.slice(0, Math.ceil(aliens.length * FLOOD_POSTED)) : challenge === 'scattered' ? aliens.slice(0, sentries(aliens.length)) : battle.deadline !== null ? aliens.slice(0, aliens.length - Math.floor(aliens.length * HELD_BACK)) : aliens
  const { spot, posts, clusters } = designEncounter(battle, posted, challenge)
  if (flood || battle.deadline !== null) battle.waves = clumps(battle, goal === 'hold' && posted.length === aliens.length ? aliens : aliens.slice(posted.length))
  sealPockets(battle, openNear(battle, spot))
  const b = battle.objective
  if (goal === 'hold') battle.uplink = b
  // Where a target waits at the objective, felling it is the way through.
  if (goal === 'ambush' || (goal === 'cross' && !battle.quarry)) battle.extract = b
  posted.forEach((alien, i) => {
    placeAlien(battle, alien, posts[i]).cluster = clusters[i]
  })
  // A rescue's civilians are scattered about the objective, half hiding where they are, half running from the aliens.
  if (goal === 'rescue') {
    for (let i = 0; i < CIVILIANS; i++) {
      let tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE)
      for (let tries = 0; distance(tile, b) > TERROR_REACH && tries < 500; tries++) tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE - Math.floor(tries / 100))
      battle.units.push(civilianUnit(battle, tile, CIVILIAN_HP, i % 2 === 0 ? 'hider' : 'runner'))
    }
  }
  planEntry(battle)
  if (goal === 'ambush') deploy(battle, battle.entry!)
  const move = Math.max(...reserve.map((s) => s.stats.move))
  if (battle.deadline !== null) battle.deadline = challenge === 'scattered' ? deadlineFor(routeWalk(battle), move, posted.length) : clockFor(battle, move)
  return battle
}
