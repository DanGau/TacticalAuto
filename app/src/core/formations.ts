// Gathers a battle's aliens into clusters: how they are grouped, the shapes they stand in, and how the ground shapes those.
import { ENGAGE_REACH, GRID, type Alien, type Battle, type Tile } from './battle'
import { distance, onGrid } from './grid'
import { random, randomInt } from './rng'
import { CHALLENGES, type ChallengeId } from './challenges'

/** What the encounter tells the gathering: the open ground, the fight's heading, and where the set pieces stand. */
export interface Plot {
  ground: Tile[]
  spot: Tile
  heading: [fx: number, fy: number]
  commander: Tile
  boss: Tile
  /** What the mission is about. */
  objective: Tile | null
  challenge: ChallengeId | null
}

/** How a challenge stands its clusters: their sizes, how far along the axis and off it, how far apart, and in what shape. */
const STAGING: Partial<Record<ChallengeId, { sizes: number[]; band: [number, number]; wander: number; apart: number; shape?: Shape }>> = {
  slog: { sizes: [2, 3], band: [7, 11], wander: 10, apart: 6, shape: 'line' },
  firingLine: { sizes: [2, 3], band: [8, 10], wander: 11, apart: 6, shape: 'line' },
  ironWall: { sizes: [4, 5, 6], band: [0, 8], wander: 5, apart: 8, shape: 'line' },
  scattered: { sizes: [1], band: [-14, 16], wander: 18, apart: 14 },
  killBox: { sizes: [99], band: [-6, -6], wander: 0, apart: 2, shape: 'crowd' },
}

/** A cluster's size is drawn from these: mostly pairs and trios, some crowds, the odd sentry. */
const SIZES = [1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6]
/** Tiles apart a push's clusters want their centres, and a flood's; both give way when the ground runs out. */
const SEPARATION = { push: 10, flood: 6 }
/** The stretch of the axis a push's clusters fill, from nearest the ways in. */
const PUSH_BAND = [-3, 11]
/** How far off the axis a push's clusters wander, how far from what it wanted a cluster settles, and the widest a shape runs. */
const WANDER = 9
const SETTLE = 6
const SPAN = 8
/** The nearest an ambush's aliens stand to the squad in the arena's middle. */
const AMBUSH_CLEAR = 6

type Feature = 'height' | 'wall' | 'object' | 'road' | 'open'
const FEATURES: Feature[] = ['height', 'wall', 'object', 'road', 'open', 'open']

const featureAt = (battle: Battle, { x, y }: Tile): Feature => {
  const t = y * GRID + x
  if (battle.height[t] > 0) return 'height'
  if (battle.north[t] !== 'none' || battle.west[t] !== 'none' || (y + 1 < GRID && battle.north[t + GRID] !== 'none') || (x + 1 < GRID && battle.west[t + 1] !== 'none')) return 'wall'
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (onGrid(x + dx, y + dy) && battle.bulk[(y + dy) * GRID + x + dx] > 0 && !['void', 'water'].includes(battle.props[(y + dy) * GRID + x + dx])) return 'object'
  return battle.ground[t] === 'road' ? 'road' : 'open'
}

/** The way a road runs at `at`, by the road tiles about it. */
function roadRun(battle: Battle, at: Tile): [number, number] {
  let [wide, tall] = [0, 0]
  for (let y = at.y - 5; y <= at.y + 5; y++) {
    for (let x = at.x - 5; x <= at.x + 5; x++) {
      if (!onGrid(x, y) || battle.ground[y * GRID + x] !== 'road') continue
      wide += Math.abs(x - at.x)
      tall += Math.abs(y - at.y)
    }
  }
  return wide >= tall ? [1, 0] : [0, 1]
}

const SHAPES = {
  /** Scattered about the centre, thick in the middle. */
  crowd: (n: number, r: () => number) => Array.from({ length: n }, () => polar(r() * 6.28, (0.4 + r() * 0.8) * Math.sqrt(n) * r() + 0.5)),
  /** Abreast across `run`, at a loose stride. */
  line: (n: number, r: () => number) => { const stride = Math.min(1.2 + r() * 1.8, SPAN / n); return Array.from({ length: n }, (_, i) => [0.8 * (r() - 0.5), (i - (n - 1) / 2) * stride]) },
  /** File along `run`, meandering. */
  stream: (n: number, r: () => number) => { const stride = Math.min(1.5 + r() * 1.5, SPAN / n); const bend = r() * 6.28; return Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * stride, 1.3 * Math.sin(bend + i)]) },
  /** A bow, its open side toward the heroes. */
  arc: (n: number, r: () => number) => { const radius = 2.5 + r() * 2; return Array.from({ length: n }, (_, i) => polar(Math.PI / 2 + (Math.PI * (i + 0.5)) / n, radius)) },
  /** Around the centre, leaving a gap at random. */
  ring: (n: number, r: () => number) => { const radius = 1.3 + r() * 1.2; const start = r() * 6.28; const sweep = 4.6 + r() * 1.6; return Array.from({ length: n }, (_, i) => polar(start + (sweep * i) / n, radius)) },
  /** The first at the centre, the rest pressed about it. */
  retinue: (n: number, r: () => number) => { const start = r() * 6.28; return Array.from({ length: n }, (_, i) => (i === 0 ? [0, 0] : polar(start + i * 2.1 + r(), 1.3 + r()))) },
}
type Shape = keyof typeof SHAPES

function polar(angle: number, radius: number): number[] {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}

/** The shapes that suit `feature` and a cluster of `n`. */
function shapesFor(feature: Feature, n: number): Shape[] {
  if (n === 2) return ['crowd', 'line']
  if (feature === 'height') return ['crowd', 'retinue']
  if (feature === 'object') return ['ring', 'ring', 'arc']
  if (feature === 'road') return ['stream', 'stream', 'line']
  if (feature === 'wall') return ['stream', 'crowd']
  return n >= 4 ? ['crowd', 'crowd', 'arc', 'line', 'stream', 'retinue'] : ['crowd', 'arc', 'line', 'retinue']
}

/** How strong an alien looks, to lead a retinue. */
const bulk = (alien: Alien) => alien.stats.hp + alien.stats.damage

/** Which aliens stand together: those a set piece holds first, then the rest in clusters of drawn sizes. */
function groupsOf(battle: Battle, aliens: Alien[], plot: Plot): { members: number[]; at: Tile | null; shape: Shape | null }[] {
  // Leaders last, so no retinue swallows another's leader.
  const leads = (i: number) => (aliens[i].boss || aliens[i].target ? 1 : 0)
  const left = aliens.map((_, i) => i).sort((a, b) => leads(a) - leads(b))
  const take = (first: number, more: number) => {
    left.splice(left.indexOf(first), 1)
    return [first, ...left.splice(0, more)]
  }
  const groups: { members: number[]; at: Tile | null; shape: Shape | null }[] = []
  const lead = aliens.findIndex((a) => a.target)
  if (lead >= 0) groups.push({ members: take(lead, 2), at: plot.commander, shape: 'retinue' })
  const boss = aliens.findIndex((a, i) => a.boss && left.includes(i))
  if (boss >= 0) groups.push({ members: take(boss, 2 + randomInt(battle, 2)), at: plot.boss, shape: 'retinue' })
  if (plot.objective && left.length > 0) groups.push({ members: left.splice(0, 2 + randomInt(battle, 2)), at: plot.objective, shape: 'ring' })
  for (let i = left.length - 1; i > 0; i--) {
    const j = randomInt(battle, i + 1)
    ;[left[i], left[j]] = [left[j], left[i]]
  }
  const sizes = (plot.challenge && STAGING[plot.challenge]?.sizes) || SIZES
  while (left.length > 0) groups.push({ members: left.splice(0, sizes[randomInt(battle, sizes.length)]), at: null, shape: null })
  return groups
}

/** The nearest two clusters of a push stand, so that a soldier nearing one wakes only it. */
const WAKE_CLEAR = ENGAGE_REACH + 1

/** A post and a cluster number, from 1, for each of `aliens`. */
export function gather(battle: Battle, aliens: Alien[], plot: Plot): { posts: Tile[]; clusters: number[] } {
  const r = () => random(battle)
  const { spot, heading: [fx, fy] } = plot
  const along = (t: Tile) => (t.x - spot.x) * fx + (t.y - spot.y) * fy
  const clear = battle.goal === 'ambush' ? AMBUSH_CLEAR : 0
  const outdoors = plot.ground.filter((t) => battle.ground[t.y * GRID + t.x] !== 'floor' && distance(t, spot) >= clear)
  const open = outdoors.length > 0 ? outdoors : plot.ground
  const groups = groupsOf(battle, aliens, plot)
  const staged = plot.challenge ? STAGING[plot.challenge] : undefined
  const free = groups.filter((g) => !g.at)
  const centres: Tile[] = groups.flatMap((g) => g.at ?? [])
  const taken = new Set<number>([spot.y * GRID + spot.x])
  const posts: Tile[] = []
  const clusters: number[] = []
  let order = 0
  // Volleying clusters are all in the fight from the start, so only those that wake need to stand apart.
  const keepApart = battle.flow === 'push' && !(plot.challenge && CHALLENGES[plot.challenge].volley)
  const clearOfOthers = (t: Tile, by: number) => !keepApart || posts.every((p) => !p || distance(p, t) >= WAKE_CLEAR + by)
  groups.forEach((group, g) => {
    const n = group.members.length
    let at = group.at
    let joinTo: number | null = null
    if (!at) {
      const i = order++
      const span = PUSH_BAND[1] - PUSH_BAND[0]
      const wanted = staged
        ? { along: staged.band[0] + ((staged.band[1] - staged.band[0]) * (i + 0.5)) / free.length, across: (r() * 2 - 1) * staged.wander }
        : battle.flow === 'push'
        ? { along: PUSH_BAND[0] + (span * (i + 0.5)) / free.length + (r() - 0.5) * 3, across: (r() * 2 - 1) * WANDER }
        : { along: (r() * 2 - 1) * 11, across: (r() * 2 - 1) * 11 }
      const aim = { x: spot.x + fx * wanted.along - fy * wanted.across, y: spot.y + fy * wanted.along + fx * wanted.across }
      const want = FEATURES[randomInt(battle, FEATURES.length)]
      for (let sep = staged?.apart ?? SEPARATION[battle.flow]; !at && sep >= (keepApart ? WAKE_CLEAR : 2); sep--) {
        const room = open.filter((t) => centres.every((c) => distance(c, t) >= sep) && clearOfOthers(t, Math.ceil(Math.sqrt(n))))
        const score = (t: Tile) => -Math.hypot(t.x - aim.x, t.y - aim.y) + (!staged && featureAt(battle, t) === want ? SETTLE : 0) + r()
        at = room.reduce<Tile | null>((a, b) => (!a || score(b) > score(a) ? b : a), null)
      }
      // No room stands clear: it joins the nearest cluster, which engages as one.
      if (!at && keepApart && posts.length > 0) {
        const joined = group.members.length && posts.reduce<Tile | null>((p, q) => (q && (!p || distance(q, spot) < distance(p, spot)) ? q : p), null)
        at = joined || spot
        joinTo = clusters[posts.indexOf(at)]
      }
      at ??= spot
      centres.push(at)
    }
    const feature = featureAt(battle, at)
    const options = n === 1 ? (['retinue'] as Shape[]) : shapesFor(feature, n)
    const shape = group.shape ?? staged?.shape ?? options[randomInt(battle, options.length)]
    // A line lies across the way, a stream along it: a road's if it stands on one, else the fight's.
    const [rx, ry] = feature === 'road' ? roadRun(battle, at) : [fx, fy]
    const points = SHAPES[shape](n, r)
    const mine = (t: Tile) => group.at || !keepApart || posts.every((p, m) => !p || clusters[m] === joinTo || distance(p, t) >= WAKE_CLEAR)
    const pool = (group.at ? plot.ground : open).filter(mine)
    const tiles = points.map(([u, v]) => {
      const ideal = { x: at.x + rx * u - ry * v + (r() - 0.5), y: at.y + ry * u + rx * v + (r() - 0.5) }
      const tile = pool.reduce<Tile | null>((a, b) => {
        if (taken.has(b.y * GRID + b.x)) return a
        return !a || Math.hypot(b.x - ideal.x, b.y - ideal.y) < Math.hypot(a.x - ideal.x, a.y - ideal.y) ? b : a
      }, null) ?? at
      taken.add(tile.y * GRID + tile.x)
      return tile
    })
    // A retinue's strongest takes the middle; elsewhere shooters take the far side.
    const members = shape === 'retinue' ? [...group.members].sort((a, b) => (aliens[a].boss || aliens[a].target ? -1 : aliens[b].boss || aliens[b].target ? 1 : bulk(aliens[b]) - bulk(aliens[a]))) : [...group.members].sort((a, b) => aliens[b].stats.range - aliens[a].stats.range)
    const places = shape === 'retinue' ? tiles : [...tiles].sort((a, b) => along(b) - along(a))
    members.forEach((m, i) => {
      posts[m] = places[i]
      clusters[m] = joinTo ?? g + 1
    })
  })
  return { posts, clusters }
}
