// Creating a battle: where pods, civilians and goals stand, the landing zones, relic drops, and the landing itself.
import { BARRIER_ARMOR, type Battle, type Tile, ZONE_RADIUS, type Reserve, ZONES, ZONE_CLEARANCE, type RelicEffect, GRID, type Unit, CHILL_TURNS, type Alien, type Plan } from './battle'
import { onGrid, coverAt, heightAt, nearestAlien, distance, freeTilesNear, type Within, walkingDistances, spacedTile, reachableFrom, blocked, walks, NEIGHBORS, passable, INNER, edgeDepths, randomTile, openNear } from './grid'
import { random, randomInt } from './rng'
import { alienUnit, civilianUnit, dropUnit, soldierUnit, TURRET } from './spawn'
import { PROP_COVER, type TerrainKind, type Locale } from './terrain'
import type { Rule } from './doctrines'
import { type Goal, VIP_HP, CIVILIANS, CIVILIAN_HP } from './goals'
import { generateTerrain } from './terrain-gen'
import type { Twist } from './twists'

/** What a landing zone offers: cover tiles in and around it, and the distance to the nearest alien. */
export function zoneInfo(battle: Battle, zone: Tile): { cover: number; contact: number; high: number } {
  let cover = 0
  let top = 0
  for (let y = zone.y - ZONE_RADIUS; y <= zone.y + ZONE_RADIUS; y++) {
    for (let x = zone.x - ZONE_RADIUS; x <= zone.x + ZONE_RADIUS; x++) {
      if (!onGrid(x, y)) continue
      if (coverAt(battle, x, y) > 0) cover++
      else top = Math.max(top, heightAt(battle, { x, y }))
    }
  }
  const alien = nearestAlien(battle, zone)
  return { cover, contact: alien ? distance(zone, alien) : Infinity, high: alien ? top - heightAt(battle, alien) : 0 }
}

/** What each plan is called, and what it does, for the player. */
export const PLANS: Record<Plan, { name: string; icon: string; text: string }> = {
  // The plain way in, from the edge, needs no name.
  march: { name: '', icon: '', text: '' },
  hot: { name: 'Hot drop', icon: '☄️', text: 'Land right on a pod: the drop pods hit it and it cannot shoot on its first turn, but every other pod hears and converges' },
  deep: { name: 'Parachute drop', icon: '🪂', text: 'Drop anywhere clear of every pod, deep in' },
  decap: { name: 'Decapitation', icon: '🗡️', text: 'Land on the commander: it cannot shoot on its first turn, but every guard converges on the squad' },
  overwatch: { name: 'Overwatch', icon: '🔭', text: "Land on high ground at range from the commander; its pod sees the squad coming" },
  bait: { name: 'Bait', icon: '🪤', text: 'Land far off: the guards come for the squad, leaving the commander alone' },
  uplink: { name: 'Drop on the uplink', icon: '📡', text: 'The drop pods land right beside the uplink' },
}

/** The supply caches a raid can grab, at most. */
export const CACHES = 3

/**
 * Lands the whole squad on the free tiles nearest the zone's centre, as the zone's plan has it, and begins the battle.
 * A hot drop or a decapitation breaches: the pod beneath is caught off guard and loses its first alien turn's shots, its
 * members take the impact in the first beat, and every other pod hears the landing and converges on it. An overwatch
 * alerts the commander's pod; bait draws every other pod to the landing. A hold's zone is the uplink it holds. The
 * barrage's zone opens with a strike on the pod nearest it.
 */
export function land(battle: Battle, zone: Tile): void {
  const plan = battle.plans[battle.zones.indexOf(zone)]
  battle.landed = plan
  if (battle.zones.indexOf(zone) === battle.barrage) {
    const pod = nearestAlien(battle, zone)?.pod
    for (const alien of battle.units.filter((u) => u.side === 'alien' && u.pod === pod)) alien.hp = Math.max(1, alien.hp - STRIKE.damage)
  }
  if (plan === 'hot' || plan === 'decap') {
    battle.breach = true
    const under = nearestAlien(battle, zone)!.pod!
    battle.pods.forEach((pod, i) => {
      if (i === under) Object.assign(pod, { revealed: true, alert: true, surprised: true })
      else pod.waypoint = zone
    })
  }
  // A rescue lands in the thick of it: every pod is in the open and fighting.
  if (battle.goal === 'rescue') {
    for (const pod of battle.pods) Object.assign(pod, { revealed: true, alert: true })
  }
  const commander = battle.units.find((u) => u.target)
  if (plan === 'overwatch' && commander) Object.assign(battle.pods[commander.pod!], { revealed: true, alert: true })
  if (plan === 'bait') battle.pods.forEach((pod, i) => i !== commander?.pod && (pod.waypoint = zone))
  const tiles = freeTilesNear(battle, zone, battle.reserve.length)
  battle.reserve.forEach((soldier, i) => battle.units.push(soldierUnit(battle, soldier, tiles[i])))
  battle.reserve = []
  battle.phase = 'battle'
  const squad = battle.units.filter((u) => u.side === 'human' && !u.civilian)
  dropRelics(battle, squad, [zone])
  // A barrier projector armors every squadmate of its carrier.
  for (const carrier of squad.filter((u) => u.effects.includes('barrier'))) {
    for (const mate of squad) if (mate !== carrier) mate.armor += BARRIER_ARMOR
  }
}

/** Lays each soldier the aliens hold on a recovery beside a pod, in turn. */
export function holdCaptives(battle: Battle, captives: Reserve[]): void {
  battle.captives = captives
  const pods = battle.pods.map((_, i) => battle.units.find((u) => u.pod === i)!).filter(Boolean)
  captives.forEach((captive, i) => {
    const [tile] = freeTilesNear(battle, pods[i % pods.length], 12).filter((t) => !battle.downed.some((d) => d.x === t.x && d.y === t.y))
    battle.downed.push({ soldier: captive.soldier, ...tile, carrier: null })
  })
}

/** An artillery strike's threat, and the damage it does each alien of the pod it hits, never killing one. */
export const STRIKE = { threat: 2, damage: 5 }

/** Tiles weighed for each zone of a distinct kind. */
export const CANDIDATES = 40

/** Lays out the zones a battle offers and what each means, by its goal; see Plan. `centres` are where the pods stand; `heart`, a rescue's terror. */
export function planZones(battle: Battle, centres: Tile[], heart: Tile | null): void {
  const clear = (within: Within = 'edge') => spacedTile(battle, [...battle.units, ...battle.zones], ZONE_CLEARANCE, within)
  // A zone the squad can walk off and the aliens can walk to: high ground may be a ledge with no way down.
  const anchor = centres[0]
  const toAnchor = anchor && walkingDistances(battle, anchor)
  const fromAnchor = anchor && reachableFrom(battle, anchor)
  const joined = (t: Tile) => !anchor || (toAnchor![t.y * GRID + t.x] < Infinity && fromAnchor![t.y * GRID + t.x])
  // Zones clear of every pod differ in kind, one each in turn: the highest ground over the aliens, the heaviest cover,
  // the nearest to them. Which suits a squad depends on who is in it.
  const kinds = [(i: ReturnType<typeof zoneInfo>) => i.high, (i: ReturnType<typeof zoneInfo>) => i.cover, (i: ReturnType<typeof zoneInfo>) => -i.contact]
  let next = randomInt(battle, kinds.length)
  const distinct = (within: Within = 'edge', draw = () => clear(within)) => {
    const score = kinds[next++ % kinds.length]
    const sampled = Array.from({ length: CANDIDATES }, draw)
    const options = sampled.filter(joined).length > 0 ? sampled.filter(joined) : sampled
    return options.reduce((a, b) => (score(zoneInfo(battle, b)) > score(zoneInfo(battle, a)) ? b : a))
  }
  const add = (zone: Tile, plan: Plan) => {
    battle.zones.push(zone)
    battle.plans.push(plan)
  }
  const held = (effect: RelicEffect) => battle.reserve.some((r) => r.effects.includes(effect))
  const goal = battle.goal
  if (goal === 'hold') {
    // The uplink stands within; the squad comes at it from the edge, or with drop pods, lands on it.
    battle.uplink = clear('inner')
    if (held('dropPods')) add(battle.uplink, 'uplink')
    while (battle.zones.length < ZONES) add(distinct(), 'march')
  } else if (goal === 'assassinate') {
    const commander = battle.units.find((u) => u.target)!
    // Landing on the commander takes drop pods, and on high ground over it parachutes; else the squad comes in from the edge.
    if (held('dropPods')) add({ x: commander.x, y: commander.y }, 'decap')
    // The highest open tile at range from the commander, clear of its guards.
    const ring = Array.from({ length: GRID * GRID }, (_, t) => ({ x: t % GRID, y: Math.floor(t / GRID) })).filter(
      (t) => !blocked(battle, t.x, t.y) && distance(t, commander) >= 7 && distance(t, commander) <= 10 && battle.units.every((u) => u.side !== 'alien' || distance(u, t) >= 4) && joined(t),
    )
    if (held('canopies')) add(ring.length > 0 ? ring.reduce((a, b) => (heightAt(battle, b) > heightAt(battle, a) ? b : a)) : clear(), 'overwatch')
    add(spacedTile(battle, [commander, ...battle.zones], 2 * ZONE_CLEARANCE, 'edge'), 'bait')
    while (battle.zones.length < ZONES) add(distinct(), 'march')
  } else if (goal === 'raid') {
    // A raid lands once, clear of the guards; its choice is how many caches to go for. Each stands by a pod, guarded.
    add(distinct(), 'march')
    battle.caches = Array.from({ length: CACHES }, (_, i) => (centres[i] ? (freeTilesNear(battle, centres[i], 4)[3] ?? centres[i]) : clear('inner')))
  } else if (goal === 'rescue') {
    // A hot drop into the terror: every zone lies among the civilians, a few tiles from the aliens.
    const aliens = battle.units.filter((u) => u.side === 'alien')
    const near = Array.from({ length: GRID * GRID }, (_, t) => ({ x: t % GRID, y: Math.floor(t / GRID) })).filter(
      (t) => distance(t, heart!) <= TERROR_REACH && !blocked(battle, t.x, t.y) && aliens.every((a) => distance(a, t) >= RESCUE_CLEARANCE),
    )
    while (battle.zones.length < ZONES) {
      const open = near.filter((t) => battle.zones.every((z) => distance(z, t) >= RESCUE_CLEARANCE))
      add(open.length > 0 ? distinct('anywhere', () => open[randomInt(battle, open.length)]) : distinct(), 'march')
    }
  } else {
    // Exterminate and VIP rescue: quiet approaches from the edge; Orbital Drop Pods make one a hot drop onto a pod, Night
    // Canopies one a parachute drop anywhere within.
    if (held('dropPods') && centres.length > 0) add(centres[randomInt(battle, centres.length)], 'hot')
    if (held('canopies')) add(distinct('anywhere'), 'deep')
    while (battle.zones.length < ZONES) add(distinct(), 'march')
  }
  // One quiet approach comes with an artillery strike on the pod in front of it.
  const marches = battle.plans.flatMap((plan, i) => (plan === 'march' && goal !== 'raid' ? [i] : []))
  if (marches.length > 0) battle.barrage = marches[randomInt(battle, marches.length)]
}

/** The nearest a rescue's landing zone lies to an alien or another zone. */
export const RESCUE_CLEARANCE = 6

/** How near a landing the drop pods' relics reach aliens. */
export const POD_REACH = 4

/** The damage Impact Charges add to the drop pods' impact. */
export const POD_BLAST = 3

/**
 * What the squad's drop pod relics do where it lands: hurt, strip or chill the aliens near, raise full cover beside each
 * soldier toward the nearest alien, or drop a turret.
 */
export function dropRelics(battle: Battle, squad: Unit[], spots: Tile[]): void {
  const held = (effect: RelicEffect) => squad.some((u) => u.effects.includes(effect))
  // The impact lands in the first beat; these relics give every landing one, reaching farther.
  if (held('podBlast') || held('podShred') || held('podFrost')) battle.breach = true
  for (const spot of spots) {
    for (const alien of battle.units.filter((u) => u.side === 'alien' && distance(u, spot) <= POD_REACH)) {
      if (held('podShred')) alien.armor = 0
      if (held('podFrost') && !alien.resists.includes('frost')) alien.chilled = CHILL_TURNS
    }
    if (held('podTurret')) dropUnit(battle, squad.find((u) => distance(u, spot) <= ZONE_RADIUS) ?? squad[0], TURRET, spot)
  }
  if (!held('podWall')) return
  walks.delete(battle)
  for (const soldier of squad) {
    const toward = nearestAlien(battle, soldier) ?? { x: GRID >> 1, y: GRID >> 1 }
    // The free tile beside the soldier nearest that alien.
    const tile = NEIGHBORS.map(([dx, dy]) => ({ x: soldier.x + dx, y: soldier.y + dy }))
      .filter((t) => onGrid(t.x, t.y) && !blocked(battle, t.x, t.y))
      .sort((a, b) => distance(a, toward) - distance(b, toward))[0]
    if (!tile) continue
    const t = tile.y * GRID + tile.x
    const open = walkingDistances(battle, soldier).filter(Number.isFinite).length
    battle.props[t] = 'stack'
    battle.cover[t] = PROP_COVER.stack
    walks.delete(battle)
    // Cover that would cut ground off from the soldier is not raised.
    if (walkingDistances(battle, soldier).filter(Number.isFinite).length < open - 1) {
      battle.props[t] = 'none'
      battle.cover[t] = 0
      walks.delete(battle)
    }
  }
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
}

/** A random open tile under a roof within, or any open tile within if no building stands there. */
export function indoors(battle: Battle): Tile {
  const depth = edgeDepths(battle)
  const inside = battle.ground.flatMap((g, t) => (g === 'floor' && depth[t] > INNER && battle.cover[t] === 0 ? [{ x: t % GRID, y: Math.floor(t / GRID) }] : []))
  return inside.length > 0 ? inside[randomInt(battle, inside.length)] : spacedTile(battle, [], 0, 'inner')
}

/** Places a pack as a new pod around `centre`. */
export function placePod(battle: Battle, pack: { name: string; aliens: Alien[] }, centre: Tile, revealed: boolean, guard = false): Unit[] {
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
  battle.pods.push({ name: pack.name, revealed, alert: revealed, surprised: false, guard, waypoint: randomTile(battle) })
  return units
}

/** The share of packs that hold their post as guards. */
export const GUARD_SHARE = 0.25

/** How far from the squad an ambush's Hunter starts. */
export const HUNTER_START = 10

/** Tiles apart a rescue's civilians start, from each other and the aliens, and the farthest from the terror's heart. */
export const CIVILIAN_CLEARANCE = 4

export const TERROR_REACH = 10

/**
 * A battle awaiting the squad's landing, with terrain, alien pods, and landing zones placed. A hold keeps half its
 * packs back as waves; a rescue's civilians are scattered among its pods. An ambush has no landing: the squad is
 * already down at a corner, every pod alert and closing in, the Hunter nearest.
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
    zones: [],
    uplink: null,
    extract: null,
    escaped: [],
    lifted: {},
    plans: [],
    landed: null,
    caches: [],
    greed: 0,
    grabbed: 0,
    breach: false,
    barrage: null,
    reserve,
    downed: [],
    captives: [],
  }
  sealPockets(battle)
  const ambush = goal === 'ambush'
  // Ambushed where it stands, within: the Hunter in sight a short way off, the packs closing in unseen from around it.
  const drop = ambush ? spacedTile(battle, [], 0, 'inner') : null
  const around = (reach: number) => {
    const angle = 2 * Math.PI * random(battle)
    const at = (v: number) => Math.max(0, Math.min(GRID - 1, Math.round(v)))
    return openNear(battle, { x: at(drop!.x + reach * Math.cos(angle)), y: at(drop!.y + reach * Math.sin(angle)) })
  }
  // A VIP waits in a building within, its first pack standing guard over it.
  const vip = goal === 'vip' ? indoors(battle) : null
  if (vip) battle.units.push(civilianUnit(battle, vip, VIP_HP, 'vip'))
  const centres: Tile[] = []
  packs.slice(0, goal === 'hold' ? packs.length - battle.waves.length : packs.length).forEach((pack, i) => {
    const centre = vip && i === 0 ? vip : !drop ? spacedTile(battle, centres, ZONE_CLEARANCE, 'inner') : around(i === 0 ? HUNTER_START : HUNTER_START + randomInt(battle, HUNTER_START))
    centres.push(centre)
    placePod(battle, pack, centre, ambush && i === 0, (vip !== null && i === 0) || (!ambush && random(battle) < GUARD_SHARE))
  })
  if (drop) {
    for (const pod of battle.pods) Object.assign(pod, { alert: true, waypoint: drop })
    battle.zones = [drop]
    battle.plans = ['march']
    land(battle, drop)
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
  planZones(battle, centres, heart)
  return battle
}
