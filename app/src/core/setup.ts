// Creating a battle: the arena, where pods, civilians and goals stand in it, and the entrances by them.
import { type Battle, type Tile, type Reserve, POD_CLEARANCE, GRID, type Unit, type Alien, type Arena } from './battle'
import { onGrid, distance, freeTilesNear, walkingDistances, spacedTile, NEIGHBORS, passable, INNER, edgeDepths, openNear, blocked, walks } from './grid'
import { randomInt } from './rng'
import { alienUnit, civilianUnit } from './spawn'
import { PROP_COVER, type TerrainKind, type Locale, type Prop } from './terrain'
import type { Rule } from './doctrines'
import { type Goal, VIP_HP, CIVILIANS, CIVILIAN_HP } from './goals'
import { generateTerrain } from './terrain-gen'
import type { Twist } from './twists'
import { deploy, planEntrances } from './entrances'

/** Lays each soldier the aliens hold on a recovery beside a pod, in turn. */
export function holdCaptives(battle: Battle, captives: Reserve[]): void {
  battle.captives = captives
  const pods = battle.pods.map((_, i) => battle.units.find((u) => u.pod === i)!).filter(Boolean)
  captives.forEach((captive, i) => {
    const [tile] = freeTilesNear(battle, pods[i % pods.length], 12).filter((t) => !battle.downed.some((d) => d.x === t.x && d.y === t.y))
    battle.downed.push({ soldier: captive.soldier, ...tile, carrier: null })
  })
}

/** Fills every open tile outside the largest walkable area with stacks, so any open tile can reach any other. */
export function sealPockets(battle: Battle): void {
  const area = Array<number>(GRID * GRID).fill(-1)
  const sizes: number[] = []
  for (let start = 0; start < GRID * GRID; start++) {
    if (battle.cover[start] > 0 || area[start] >= 0) continue
    area[start] = sizes.length
    const queue = [start]
    for (const tile of queue) {
      for (const [dx, dy] of NEIGHBORS) {
        const x = (tile % GRID) + dx
        const y = Math.floor(tile / GRID) + dy
        const from = { x: tile % GRID, y: Math.floor(tile / GRID) }
        if (!onGrid(x, y) || battle.cover[y * GRID + x] > 0 || area[y * GRID + x] >= 0 || !passable(battle, from, { x, y })) continue
        area[y * GRID + x] = sizes.length
        queue.push(y * GRID + x)
      }
    }
    sizes.push(queue.length)
  }
  const largest = sizes.indexOf(Math.max(...sizes))
  area.forEach((id, tile) => {
    if (id < 0 || id === largest) return
    battle.cover[tile] = 2
    battle.props[tile] = 'stack'
  })
  walks.delete(battle)
}

/** A random open tile under a roof within, or any open tile within if no building stands there. */
export function indoors(battle: Battle): Tile {
  const depth = edgeDepths(battle)
  const inside = battle.ground.flatMap((g, t) => (g === 'floor' && depth[t] > INNER && battle.cover[t] === 0 ? [{ x: t % GRID, y: Math.floor(t / GRID) }] : []))
  return inside.length > 0 ? inside[randomInt(battle, inside.length)] : spacedTile(battle, [], 0, 'inner')
}

/**
 * Places a pack as a new pod around `centre`, its post. Every pod is in the open but burrowers, which keep
 * underground; `revealed` false keeps any pod unseen, as a wave coming in.
 */
export function placePod(battle: Battle, pack: { name: string; aliens: Alien[] }, centre: Tile, revealed = true): Unit[] {
  const units = freeTilesNear(battle, centre, pack.aliens.length).map((tile, i) => alienUnit(battle, pack.aliens[i], tile, battle.pods.length))
  battle.units.push(...units)
  // One that never moves stands where it walls no ground off, as seen from across the map.
  const far = openNear(battle, { x: GRID - 1 - centre.x, y: GRID - 1 - centre.y })
  for (const still of units.filter((u) => u.stats.move === 0)) {
    battle.units.splice(battle.units.indexOf(still), 1)
    const open = walkingDistances(battle, far).filter(Number.isFinite).length
    const tile = freeTilesNear(battle, centre, 30).find((t) => {
      Object.assign(still, t)
      battle.units.push(still)
      const walls = walkingDistances(battle, far).filter(Number.isFinite).length < open - 1
      battle.units.splice(battle.units.indexOf(still), 1)
      return !walls
    })
    if (tile) Object.assign(still, tile)
    battle.units.push(still)
  }
  const burrowers = units.every((u) => u.kind === 'burrower')
  battle.pods.push({ name: pack.name, revealed: revealed && !burrowers, surprised: false, engaged: false, post: centre })
  return units
}

/** How far from its centre the arena reaches, and the share of its open ground that should give cover. */
export const ARENA_REACH = 14
export const ARENA_COVER = 0.1

/** How far from the squad an ambush's Hunter starts. */
export const HUNTER_START = 10

/** Tiles apart a rescue's civilians start, from each other and the aliens, and the farthest from the terror's heart. */
export const CIVILIAN_CLEARANCE = 4

export const TERROR_REACH = 10

/** The supply caches a raid can grab, at most. */
export const CACHES = 3

/** The cover a region scatters where its arena is bare, low and high; crates and stacks elsewhere. */
const SCATTER: Partial<Record<TerrainKind, [Prop, Prop]>> = { countryside: ['fence', 'tree'], hive: ['growth', 'spire'] }

/** Scatters cover over the arena until ARENA_COVER of its ground gives some, never beside other cover, so it walls nothing off. */
function furnish(battle: Battle, arena: Arena): void {
  const [low, high] = SCATTER[battle.place] ?? ['crate', 'stack']
  const tiles: number[] = []
  for (let y = arena.y - arena.reach; y <= arena.y + arena.reach; y++) for (let x = arena.x - arena.reach; x <= arena.x + arena.reach; x++) if (onGrid(x, y) && battle.ground[y * GRID + x] !== 'void') tiles.push(y * GRID + x)
  let covered = tiles.filter((t) => battle.cover[t] > 0).length
  for (let tries = 0; covered < ARENA_COVER * tiles.length && tries < 4 * tiles.length; tries++) {
    const t = tiles[randomInt(battle, tiles.length)]
    const x = t % GRID
    const y = Math.floor(t / GRID)
    if (battle.cover[t] > 0 || NEIGHBORS.some(([dx, dy]) => onGrid(x + dx, y + dy) && battle.cover[(y + dy) * GRID + x + dx] > 0)) continue
    battle.props[t] = randomInt(battle, 3) === 0 ? high : low
    battle.cover[t] = PROP_COVER[battle.props[t]]
    covered++
  }
  walks.delete(battle)
}

/** A random open tile in the arena the centre walks to, at least `clearance` from every tile in `avoid` and `from` the centre; both ease if the arena is crowded. */
function arenaTile(battle: Battle, avoid: Tile[], clearance: number, from = 0): Tile {
  const { arena } = battle
  const walk = walkingDistances(battle, arena)
  const r = arena.reach - 2
  for (let tries = 0; tries < 3000; tries++) {
    const tile = { x: arena.x - r + randomInt(battle, 2 * r + 1), y: arena.y - r + randomInt(battle, 2 * r + 1) }
    const ease = Math.floor(tries / 300)
    if (!onGrid(tile.x, tile.y) || blocked(battle, tile.x, tile.y) || walk[tile.y * GRID + tile.x] === Infinity || distance(tile, arena) < from - ease) continue
    if (avoid.every((other) => distance(tile, other) >= clearance - ease)) return tile
  }
  return spacedTile(battle, avoid, clearance, 'inner')
}

/**
 * A battle awaiting the squad's entrance. The fight is staged in an arena within: its pods hang out there at their
 * posts, with cover between them, and the entrances lie by them. A VIP rescue's arena is about the VIP, a hold's the
 * uplink; an assassination keeps its commander at the far side. A hold keeps half its packs back as waves; a rescue's
 * civilians are scattered about its last pod. An ambush has no entrance: the squad is down in the arena's middle,
 * the Hunter nearest.
 */
export function createBattle(seed: number, kind: TerrainKind, packs: { name: string; aliens: Alien[] }[], reserve: Reserve[], goal: Goal = 'exterminate', rules: Rule[] = [], twist: Twist | null = null, place?: Locale): Battle {
  const holder = { rng: seed }
  const terrain = generateTerrain(holder, GRID, kind, twist, place)
  const battle: Battle = {
    rng: holder.rng,
    goal,
    rules,
    twist,
    round: 0,
    // All of a recovery's packs come on a second time, as waves.
    waves: goal === 'hold' ? packs.slice(Math.ceil(packs.length / 2)) : goal === 'recover' ? [...packs] : [],
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
    cover: terrain.props.map((prop) => PROP_COVER[prop]),
    pods: [],
    used: [],
    primed: [],
    acid: [],
    fire: [],
    caltrops: [],
    husks: [],
    saved: 0,
    vip: goal === 'vip' ? 'held' : null,
    held: 0,
    actor: null,
    tally: {},
    entrances: [],
    entered: null,
    arena: { x: 0, y: 0, reach: ARENA_REACH },
    rallied: 0,
    spotlight: null,
    uplink: null,
    extract: null,
    escaped: [],
    lifted: {},
    caches: [],
    greed: 0,
    grabbed: 0,
    opening: false,
    reserve,
    downed: [],
    captives: [],
  }
  sealPockets(battle)
  // A VIP waits in a building within, a hold's uplink stands within: the arena is about either.
  const spot = goal === 'vip' ? indoors(battle) : spacedTile(battle, [], 0, 'inner')
  battle.arena = { x: spot.x, y: spot.y, reach: ARENA_REACH }
  furnish(battle, battle.arena)
  sealPockets(battle)
  const centre = openNear(battle, spot)
  const vip = goal === 'vip' ? centre : null
  if (goal === 'hold') battle.uplink = centre
  if (vip) battle.units.push(civilianUnit(battle, vip, VIP_HP, 'vip'))
  const ambush = goal === 'ambush'
  const around = (reach: number) => {
    const angle = (2 * Math.PI * randomInt(battle, 360)) / 360
    const at = (v: number) => Math.max(0, Math.min(GRID - 1, Math.round(v)))
    return openNear(battle, { x: at(centre.x + reach * Math.cos(angle)), y: at(centre.y + reach * Math.sin(angle)) })
  }
  const centres: Tile[] = []
  packs.slice(0, goal === 'hold' ? packs.length - battle.waves.length : packs.length).forEach((pack, i) => {
    const post =
      vip && i === 0
        ? vip
        : ambush
          ? around(i === 0 ? HUNTER_START : HUNTER_START - 2 + randomInt(battle, 6))
          : goal === 'assassinate' && i === 0
            ? arenaTile(battle, [], 0, ARENA_REACH - 3)
            : arenaTile(battle, [...centres, ...(battle.uplink ? [battle.uplink] : [])], POD_CLEARANCE)
    centres.push(post)
    placePod(battle, pack, post)
  })
  if (ambush) {
    deploy(battle, centre)
    return battle
  }
  // A rescue's terror is about its last pod: civilians scattered about it, half hiding where they are, half running from the aliens.
  const heart = goal === 'rescue' ? centres.at(-1)! : null
  if (heart) {
    for (let i = 0; i < CIVILIANS; i++) {
      let tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE)
      for (let tries = 0; distance(tile, heart) > TERROR_REACH && tries < 500; tries++) tile = spacedTile(battle, battle.units, CIVILIAN_CLEARANCE - Math.floor(tries / 100))
      battle.units.push(civilianUnit(battle, tile, CIVILIAN_HP, i % 2 === 0 ? 'hider' : 'runner'))
    }
  }
  // A raid's caches each stand by a pod, guarded.
  if (goal === 'raid') battle.caches = Array.from({ length: CACHES }, (_, i) => (centres[i] ? (freeTilesNear(battle, centres[i], 4)[3] ?? centres[i]) : arenaTile(battle, centres, 4)))
  planEntrances(battle, heart)
  return battle
}
