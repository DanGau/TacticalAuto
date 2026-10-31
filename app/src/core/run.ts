// A run's journey: creating it, the route and each leg's map of stops, and moving along it.
import { type Reserve } from './battle'
import { secondaryOf } from './squad'
import { createBattle } from './setup'
import { holdCaptives } from './setup'
import { CLASSES } from './classes'
import { DOCTRINES, type Doctrine } from './doctrines'
import { RESISTS, type Resist } from './keywords'
import { RELICS, type Relic } from './relics'
import { SKILLS } from './skills'
import { type TerrainKind } from './terrain'
import { random, randomInt } from './rng'
import { TRAITS, type Trait, type TraitId } from './traits'
import { TOWNS } from './towns'
import { crosses, distance, plane, type Point } from './plane'
import { along, arc, CONTINENT_IDS, CONTINENTS, HUB, type City, type ContinentId, type LonLat } from './world'
import { LEG_STOPS, STOP_THREAT, THREAT_MAX } from './progress'
import { charges, draft, equipped, health, join, offerRecruits, skillOffers, soldierStats, weaponOf, xpFor } from './squad'
import { dropGear, settle } from './rewards'
import { drawBattle, missionAt, packsOf, placed, RISKS } from './missions'
import { type Leg, type MapNode, type Risk, type Run, type Stage, type Stop, type StopKind } from './run-state'

/** Access keys needed to find the alien source; each is won at a satellite, at the end of a leg. */
export const KEYS = 3
/** Rows a leg's map spreads across, and trails that wander them from start to satellite. */
export const MAP_ROWS = 5
const TRAILS = 4
export const START_SUPPLIES = 3
/** Supplies a supply drop gives. */
export const DROP_SUPPLIES = 4

/** Takes the recruit at `index` as the run's first soldier, with what its trait brings, and sets out from its home. */
export function recruit(run: Run, index: number): void {
  const soldier = run.recruits[index]
  run.recruits = []
  run.route = plotRoute(run, soldier.home!)
  run.route.forEach((stage, l) => placeLeg(run, run.legs[l], stage))
  drawStops(run)
  join(run, soldier)
  settle(run)
}

/** How many towns lie on the way to a hero's city at least, as a share of the most on the way to any on its continent. */
const FAR_CITY = 0.8

/** How many of a continent's towns lie on the way from `a` to `b`: past the one, short of the other. */
function townsBetween(continent: ContinentId, a: LonLat, b: LonLat): number {
  const flat = plane(a, b)
  const [x0, x1] = [flat(a).x, flat(b).x]
  return TOWNS[continent].filter(([, at]) => flat(at).x > x0 && flat(at).x < x1).length
}

/** A hero's level: elite, it joins seasoned, its skills learned. */
const HERO_LEVEL = 2

/**
 * The journey from `home`: across its own continent to a hero in another of its cities, then on to the nearest
 * continent not yet crossed, a leg each, and at last to the alien hub. A hero waits at each leg's end.
 */
function plotRoute(run: Run, home: City): Stage[] {
  const route: Stage[] = []
  const left = [...CONTINENT_IDS]
  let from = home
  for (let leg = 0; leg < KEYS; leg++) {
    const continent = leg === 0 ? left.find((id) => CONTINENTS[id].cities.some((c) => c.name === home.name))! : left.reduce((a, b) => (nearest(b, from.at) < nearest(a, from.at) ? b : a))
    left.splice(left.indexOf(continent), 1)
    // The hero waits in a city with about the most towns on the way there, so the leg crosses the continent.
    const others: City[] = CONTINENTS[continent].cities.filter((c) => c.name !== from.name)
    const most = Math.max(...others.map((c) => townsBetween(continent, from.at, c.at)))
    const cities = others.filter((c) => townsBetween(continent, from.at, c.at) >= FAR_CITY * most)
    const to = cities[randomInt(run, cities.length)]
    const hero = draft(run, [])
    hero.home = to
    hero.xp = xpFor(HERO_LEVEL)
    // A hero has a quirk of its own, as a recruit does, though never one that sets its level.
    const quirks = (Object.keys(TRAITS) as TraitId[]).filter((id) => !(TRAITS[id] as Trait).level)
    hero.trait = quirks[randomInt(run, quirks.length)]
    for (let offers = skillOffers(hero); offers.length > 0; offers = skillOffers(hero)) hero.skills.push(offers[randomInt(run, offers.length)])
    route.push({ continent, from: from.at, to, hero })
    from = to
  }
  route.push({ continent: null, from: from.at, to: HUB, hero: null })
  return route
}

/**
 * Sets each stop of a leg at a real town on the way across its continent, as a traveller would plan the trip: each
 * column of stops a step on from the last, rows in order across the way, so every trail heads on toward the hero's
 * city, no two trails cross, and no stop stands on a trail not its own or crowds another. Each column takes the towns
 * nearest where it would ideally fall that keep the map so, going back to try a column's next best when the columns
 * after cannot; if no way works, the rules ease. The leg ends at the hero's city; the hub's leg at the hub.
 */
function placeLeg(run: Run, leg: Leg, stage: Stage): void {
  const end = leg.columns.length - 1
  leg.columns[end][0].at = stage.to.at
  leg.columns[end][0].town = stage.to.name
  if (!stage.continent) return
  const flat = plane(stage.from, stage.to.at)
  const [start, goal] = [flat(stage.from), flat(stage.to.at)]
  const towns = TOWNS[stage.continent].filter(([name]) => name !== stage.to.name).map(([name, at]) => ({ name: name as string | null, at, p: flat(at) }))
  const ahead = towns.filter((town) => town.p.x > start.x && town.p.x < goal.x)
  // A leg from overseas starts its steps just short of the coast.
  const from = Math.max(start.x, Math.min(goal.x, ...ahead.map((town) => town.p.x)) - (goal.x - start.x) / (end + 1))
  const step = (goal.x - from) / (end + 1)
  // Rows spread wide enough across the way to take in towns to spare for every stop.
  const wanted = SPARE * leg.columns.flat().length
  let gap = Math.max(MIN_ROW_GAP, ROW_SPREAD * step)
  while (gap < WIDEST * step && ahead.filter((town) => Math.abs(town.p.y) <= (MAP_ROWS / 2) * gap).length < wanted) gap *= 1.2
  const columns = leg.columns.slice(0, end)
  // Where each stop would ideally fall, before it is pushed on past the stops leading to it: in its row, and as many
  // towns on as there are stops to come, so the steps are short where the towns are thick.
  const steps = ahead.filter((town) => Math.abs(town.p.y) <= (MAP_ROWS / 2) * gap).map((town) => town.p.x).sort((a, b) => a - b)
  const ideal = columns.map((column, c) => {
    const x = steps.length > 0 ? steps[Math.min(steps.length - 1, Math.floor(((c + 1 + (random(run) - 0.5) * 0.5) / (end + 2)) * steps.length))] : from + (c + 1) * step
    // The rows draw in toward where the leg sets out and where it ends.
    const spread = Math.min(1, (c + 1) / 3, (end - c) / 2)
    return column.map((node) => ({ x, y: (node.row - (MAP_ROWS - 1) / 2 + (random(run) - 0.5) * 0.4) * gap * spread }))
  })
  type Town = (typeof towns)[number]
  // The picture so far: its stops, the first where the leg begins, and the trails between them.
  const stops: Point[] = [start]
  const lines: [number, number][] = []
  const picked: Town[][] = []
  let tries = 0
  /** Places columns from `c` on, true if all fit. */
  const place = (c: number, strict: number): boolean => {
    if (c === columns.length) return true
    if (++tries > TRIES) return false
    const column = columns[c]
    const first = stops.length
    const before = (k: number) => first - columns[c - 1].length + k
    const into = (i: number) => (c === 0 ? [0] : columns[c - 1].flatMap((n, k) => (n.next.includes(i) ? [before(k)] : [])))
    const behind = column.map((_, i) => Math.max(...into(i).map((k) => stops[k].x)))
    // Falling behind or ahead counts double straying across.
    const want = ideal[c].map((p, i) => ({ x: Math.max(p.x, behind[i] + SLOPE * step), y: p.y }))
    const off = (town: Town, i: number) => Math.hypot(2 * (town.p.x - want[i].x), town.p.y - want[i].y)
    const last = c === columns.length - 1
    const used = new Set(picked.flat())
    // Below 0 the picture may tangle; below -1 any towns in order do.
    const [loose, any, ease] = [strict < 0, strict < -1, Math.max(0, strict)]
    const [clear, room] = [ease * CLEAR * step, ease * ROOM * step]
    // A town fits a stop on its own if it is short of the hero's city and near its column's step, its trails there
    // head on, and it and they keep clear of the picture so far.
    const alone = (town: Town, i: number) =>
      any ||
      (goal.x - town.p.x > (columns.length - c) * SLOPE * step * Math.max(ease, 0.5) &&
        Math.abs(town.p.x - want[i].x) <= (strict === 1 ? 1 : 2) * WIDTH * step &&
      into(i).every((k) => heads(stops[k], town.p, ease)) &&
      stops.every((p) => Math.hypot(p.x - town.p.x, p.y - town.p.y) >= room) &&
      lines.every(([a, b]) => distance(town.p, stops[a], stops[b]) >= clear) &&
      (loose || into(i).every((k) => lines.every(([a, b]) => a === k || b === k || !crosses(stops[k], town.p, stops[a], stops[b])) && stops.every((p, j) => j === k || distance(p, stops[k], town.p) >= clear))))
    const pools = want.map((_, i) =>
      towns
        .filter((town) => !used.has(town) && alone(town, i))
        .sort((a, b) => off(a, i) - off(b, i))
        .slice(0, POOL),
    )
    // The trails a choice adds; the last column's lead on to the hero's city.
    const trails = [...column.flatMap((_, i) => into(i).map((k): [number, number] => [k, first + i])), ...(last ? column.map((_, i): [number, number] => [first + i, first + column.length]) : [])]
    // The BRANCH cheapest choices that keep the picture untangled, cheapest first.
    const choices: { picks: Town[]; cost: number }[] = []
    const search = (picks: Town[], cost: number) => {
      if (choices.length === BRANCH && cost >= choices[BRANCH - 1].cost) return
      const i = picks.length
      if (i < column.length) {
        for (const town of pools[i]) if (!picks.includes(town) && (i === 0 || town.p.y > picks[i - 1].p.y) && (loose || picks.every((t) => Math.hypot(t.p.x - town.p.x, t.p.y - town.p.y) >= room))) search([...picks, town], cost + off(town, i))
        return
      }
      if (!any && last && picks.some((t) => !heads(t.p, goal, ease))) return
      if (!loose && !fresh([...stops, ...picks.map((t) => t.p), ...(last ? [goal] : [])], lines, trails, first, clear, room)) return
      choices.push({ picks, cost })
      choices.sort((x, y) => x.cost - y.cost)
      if (choices.length > BRANCH) choices.pop()
    }
    search([], 0)
    for (const { picks } of choices) {
      stops.push(...picks.map((t) => t.p))
      const kept = trails.filter(([, b]) => b < stops.length)
      lines.push(...kept)
      picked.push(picks)
      if (place(c + 1, strict)) return true
      stops.length = first
      lines.length -= kept.length
      picked.pop()
    }
    return false
  }
  // The rules ease until the leg fits: half the room, then none and any heading on, then crossings, then any towns in order.
  const fits = [1, 0.5, 0, -1, -2].some((strict) => {
    tries = 0
    return place(0, strict)
  })
  columns.forEach((column, c) =>
    column.forEach((node, i) => {
      // A continent out of towns: the stops stand where they would ideally fall.
      const town = fits ? picked[c][i] : { name: null, at: offset(stage, (ideal[c][i].x - start.x) / (goal.x - start.x), ideal[c][i].y) }
      node.town = town.name
      node.at = town.at
    }),
  )
}

/**
 * Whether stops from `first` on, with `trails` added to `lines`, leave the picture untangled: no new trail crosses
 * another, and no stop stands within `clear` of a trail not its own or within `room` of another stop.
 */
function fresh(stops: Point[], lines: [number, number][], trails: [number, number][], first: number, clear: number, room: number): boolean {
  const touches = ([a, b]: [number, number], [c, d]: [number, number]) => a === c || a === d || b === c || b === d
  for (const [i, t] of trails.entries()) {
    for (const u of [...lines, ...trails.slice(i + 1)]) if (!touches(t, u) && crosses(stops[t[0]], stops[t[1]], stops[u[0]], stops[u[1]])) return false
    for (const [k, p] of stops.entries()) if (k !== t[0] && k !== t[1] && distance(p, stops[t[0]], stops[t[1]]) < clear) return false
  }
  for (let k = first; k < stops.length; k++) {
    for (const [a, b] of lines) if (distance(stops[k], stops[a], stops[b]) < clear) return false
    for (let j = 0; j < k; j++) if (Math.hypot(stops[k].x - stops[j].x, stops[k].y - stops[j].y) < room) return false
  }
  return true
}

/** How many towns nearest where a stop would ideally fall are tried for it, how many of a column's best choices are tried before going back, and how many columns are tried in all. */
const POOL = 10
const BRANCH = 3
const TRIES = 150
/** How many towns the way takes in for each stop. */
const SPARE = 1.3
/** The widest the rows spread apart, in steps. */
const WIDEST = 1.5
/** Whether the trail from `a` to `b` heads on along the leg: by at least SLOPE of its length, eased by `strict`. */
const heads = (a: Point, b: Point, strict: number) => b.x - a.x > strict * SLOPE * Math.hypot(b.x - a.x, b.y - a.y)
const SLOPE = 0.3
/** How far along the leg a stop may stray from its column's step, in steps. */
const WIDTH = 0.6
/** In steps of a leg: the least room between a stop and a trail not its own, and between two stops. */
const CLEAR = 0.2
const ROOM = 0.4

/** How far apart a leg's rows of stops lie across its way, in steps along it, and at least, in degrees. */
const ROW_SPREAD = 0.7
const MIN_ROW_GAP = 1.2

/** The place a share `t` of the way along a stage, `d` degrees to its left. */
function offset(stage: Stage, t: number, d: number): LonLat {
  const at = along(stage.from, stage.to.at, t)
  const ahead = along(stage.from, stage.to.at, Math.min(1, t + 0.01))
  const scale = Math.cos(at[1] * (Math.PI / 180))
  const dx = (ahead[0] - at[0]) * scale
  const dy = ahead[1] - at[1]
  const len = Math.hypot(dx, dy) || 1
  return [at[0] + ((-dy / len) * d) / scale, at[1] + (dx / len) * d]
}

/** How near a continent's nearest city lies to `at`, in degrees round the globe. */
const nearest = (id: ContinentId, at: LonLat) => Math.min(...CONTINENTS[id].cities.map((c) => arc(c.at, at)))

/** How likely a stop past a leg's first column is to be each kind other than a battle; the rest are battles. */
export const STOP_CHANCE = { unknown: 0.25, shop: 0.1, medic: 0.1, supply: 0.08, cache: 0.08 }

/**
 * The shape of a leg's map: trails start apart and wander a row up, down or on each column, never crossing, and
 * every stop they pass is a node. Then the satellite, which all reach.
 */
function drawShape(run: Run): MapNode[][] {
  const edges = Array.from({ length: LEG_STOPS }, () => new Map<number, Set<number>>())
  const first = randomInt(run, MAP_ROWS)
  for (let t = 0; t < TRAILS; t++) {
    let row = t === 0 ? first : t === 1 ? (first + 1 + randomInt(run, MAP_ROWS - 1)) % MAP_ROWS : randomInt(run, MAP_ROWS)
    for (let c = 0; c < LEG_STOPS; c++) {
      const out = edges[c].get(row) ?? new Set<number>()
      edges[c].set(row, out)
      if (c === LEG_STOPS - 1) break
      const step = Math.min(MAP_ROWS - 1, Math.max(0, row + randomInt(run, 3) - 1))
      // Only a step up and a step down between the same two rows can cross; then the trail goes straight on.
      const to = step !== row && edges[c].get(step)?.has(row) ? row : step
      out.add(to)
      row = to
    }
  }
  const rows = edges.map((column) => [...column.keys()].sort((a, b) => a - b))
  const nodes = rows.map((column, c) =>
    column.map((row): MapNode => ({ row, stop: null, town: null, at: null, next: c === LEG_STOPS - 1 ? [0] : [...edges[c].get(row)!].sort((a, b) => a - b).map((r) => rows[c + 1].indexOf(r)) })),
  )
  return [...nodes, [{ row: Math.floor(MAP_ROWS / 2), next: [], stop: null, town: null, at: null }]]
}

/** Fills the stops of the leg under way: its first column battles, the rest drawn at random, each battle mustered for where it stands. */
export function drawStops(run: Run): void {
  const leg = run.legs[run.keys]
  if (run.keys === KEYS) {
    leg.columns[0][0].stop = fixed('final', 'hive')
    return
  }
  const risks = Object.keys(RISKS) as Risk[]
  leg.columns.forEach((column, c) => {
    for (const node of column) {
      let roll = random(run)
      const kind = c === 0 ? undefined : (Object.keys(STOP_CHANCE) as (keyof typeof STOP_CHANCE)[]).find((k) => (roll -= STOP_CHANCE[k]) < 0)
      node.stop = c === LEG_STOPS ? { ...fixed('key', 'compound'), ...placed(run, 'compound'), city: run.route[run.keys].to.name } : kind ? fixed(kind, 'town') : drawBattle(run, risks[randomInt(run, risks.length)], { ...run, stop: c })
      // A stop is named for the town it is at.
      if (node.town) node.stop.city = node.town
    }
  })
}

/** A stop with no aliens drawn ahead: any but a battle. */
const fixed = (kind: StopKind, terrain: TerrainKind): Stop => ({ kind, risk: 'standard', goal: 'exterminate', terrain, twist: null, packs: [] })

/** The leg under way. */
export const legOf = (run: Run) => run.legs[run.keys]

/** The node the squad has entered and not yet passed; null while it chooses where to go. */
export function current(run: Run): MapNode | null {
  const leg = legOf(run)
  return leg.path.length > run.stop ? leg.columns[run.stop][leg.path[run.stop]] : null
}

/** Indexes in the next column of where the squad can go: where its last stop leads, or anywhere at a leg's start or out of a tunnel. */
export function ways(run: Run): number[] {
  const leg = legOf(run)
  const last = leg.path[run.stop - 1] ?? -1
  return last === -1 ? leg.columns[run.stop].map((_, i) => i) : leg.columns[run.stop - 1][last].next
}

/** Enters the node at `index` of the next column. */
export function go(run: Run, index: number): void {
  legOf(run).path.push(index)
}

export function createRun(seed: number): Run {
  const run: Run = {
    seed,
    rng: seed,
    keys: 0,
    legs: [],
    stop: 0,
    threat: 0,
    phase: 'overworld',
    mission: null,
    battle: null,
    report: null,
    soldiers: [],
    nextSoldier: 1,
    supplies: START_SUPPLIES,
    finds: [],
    nextGear: 1,
    relics: [],
    kit: [],
    relicOffers: [],
    recruits: [],
    route: [],
    bosses: [],
    shop: null,
    event: null,
    met: [],
    doctrines: [],
    captives: [],
  }
  offerRecruits(run)
  run.legs = Array.from({ length: KEYS + 1 }, (_, k) => ({ columns: k === KEYS ? [[{ row: Math.floor(MAP_ROWS / 2), next: [], stop: null, town: null, at: null }]] : drawShape(run), path: [] }))
  run.phase = 'recruit'
  const resists = Object.keys(RESISTS) as Resist[]
  run.bosses = Array.from({ length: KEYS + 1 }, () => resists[randomInt(run, resists.length)])
  return run
}

/**
 * The stop the squad travels to next: a recovery if the aliens hold soldiers, an ambush if threat is full, else the
 * stop it has entered. Null while it chooses.
 */
export function nextStop(run: Run): StopKind | 'ambush' | 'recovery' | null {
  const node = current(run)
  if (!node) return null
  return run.captives.length > 0 ? 'recovery' : run.threat >= THREAT_MAX ? 'ambush' : node.stop!.kind
}

/** Moves past the stop the squad is at. */
export function passStop(run: Run): void {
  run.stop++
}

/** Travels to the next stop, unless it is a shop or unknown. A battle begins; a supply drop or cache is collected at once. */
export function advance(run: Run): void {
  const here = current(run)!.stop!
  const stop = nextStop(run)!
  if (stop === 'shop' || stop === 'unknown' || stop === 'medic') throw new Error('a shop, medic or unknown stop is arrived at, not advanced to')
  if (stop === 'supply' || stop === 'cache') {
    const before = run.threat
    run.threat = Math.min(run.threat + STOP_THREAT, THREAT_MAX)
    const supplies = stop === 'supply' ? DROP_SUPPLIES : 0
    run.supplies += supplies
    if (stop === 'cache') dropGear(run, run.relics.some((id) => (RELICS[id] as Relic).rareGear))
    run.report = { stop, won: true, threat: { before, after: run.threat }, supplies, key: false, soldiers: [], hired: null, rescued: null, found: null }
    passStop(run)
    settle(run)
    return
  }
  const goal = stop === 'battle' ? here.goal : stop === 'ambush' ? 'ambush' : stop === 'recovery' ? 'recover' : 'exterminate'
  const mission = missionAt(run, stop, stop === 'recovery' ? 'standard' : here.risk, goal)
  run.mission = mission
  run.phase = 'battle'
  const doctrines = run.doctrines.map((id): Doctrine => DOCTRINES[id])
  const reserve = run.soldiers.map((s): Reserve => ({
    soldier: s.id,
    stats: soldierStats(run, s),
    hp: health(run, s),
    ability: s.cls && CLASSES[s.cls].ability,
    charges: charges(run, s),
    secondary: secondaryOf(s),
    stance: doctrines.find((d) => d.stance)?.stance ?? weaponOf(s)?.stance ?? (s.cls ? CLASSES[s.cls].stance : ('balanced' as const)),
    effects: [...doctrines.flatMap((d) => d.effect ?? []), ...[weaponOf(s)].flatMap((w) => w?.effect ?? []),...equipped(s).flatMap((gear) => gear.effect ?? []), ...s.skills.flatMap((id) => SKILLS[id].effect ?? []), ...run.relics.flatMap((id): Relic['effect'][] => [RELICS[id].effect]).flatMap((effect) => effect ?? [])],
  }))
  const rules = doctrines.flatMap((d) => d.rule ?? [])
  const held = (r: Reserve) => run.captives.includes(r.soldier)
  run.battle = createBattle(randomInt(run, 2 ** 31), here.terrain, packsOf(run, mission, stop === 'battle' ? here.packs : undefined), reserve.filter((r) => !held(r)), mission.goal, rules, here.twist, here.region && here.city ? { region: here.region, city: here.city } : undefined)
  holdCaptives(run.battle, reserve.filter(held))
}

