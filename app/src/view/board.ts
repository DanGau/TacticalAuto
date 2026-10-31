// Builds the battlefield in its region's look: the ground, props, walls, windows and roofs.
import { Group, type MeshBasicMaterial, type Object3D } from 'three'
import { GRID, type Battle, type Tile } from '../core/battle'
import type { Edge, Prop } from '../core/terrain'
import { onGridTile, spot } from './camera'
import { buildChasm } from './chasm'
import { LOOKS, type Look } from './looks'
import { COLOR, GROUND_COLOR, highland } from './palette'
import { addTree, CAP_UP, EDGE_BOXES, EDGE_UP, pick, propBoxes, WALL_THICK, type Box } from './props'
import { addRoof } from './roofs'
import { ditherable, empty, shade, Shapes } from './shapes'
import { LEVEL, tall } from './space'
import type { Stage } from './stage'

/** Adds a box to `shapes`, centred on the tile at x, z standing at height y. */
function addBox(shapes: Shapes, x: number, y: number, z: number, box: Box): void {
  const w = box.wide / 2
  const d = box.deep / 2
  shapes.box(x - w, z - d, x + w, z + d, y + tall(box.base), y + tall(box.base + box.up), box.color, box.alpha ?? 1)
}

/** Builds the shapes into a node of the scenery, which fog can dim; a wall, standing `wall`, can thin as a unit passes behind it. */
function stand(s: Stage, shapes: Shapes, blobs: Object3D[], lit: number[], wall?: Tile): void {
  const node = new Group()
  const { mesh, lines } = shapes.build(!!wall)
  node.add(mesh, ...blobs)
  if (lines) node.add(lines)
  s.terrain.add(node)
  s.scenery.push({ node, tiles: lit })
  if (wall) s.walls.push({ at: wall, fade: ditherable(mesh.material as MeshBasicMaterial) })
}

/**
 * Adds the prop on a tile to `shapes`, and any leaves to `blobs`. A prop that continues onto the tile above or
 * below, such as a car parked along y, is turned to lie that way; the two halves of a car share a colour.
 */
function addProp(props: Prop[], tile: number, shapes: Shapes, blobs: Object3D[], look: Look): void {
  const prop = props[tile] as Exclude<Prop, 'none'>
  const x = tile % GRID
  const y = Math.floor(tile / GRID)
  const at = spot(x, y)
  if (prop === 'tree') return addTree(look, at, shapes, blobs, tile)
  const same = (other: number) => other >= 0 && other < GRID * GRID && props[other] === prop
  const alongX = (tile % GRID > 0 && same(tile - 1)) || (tile % GRID < GRID - 1 && same(tile + 1))
  const alongY = !alongX && (same(tile - GRID) || same(tile + GRID))
  // The first tile of the run the prop lies in.
  const head = alongY ? (same(tile - GRID) ? tile - GRID : tile) : tile % GRID > 0 && same(tile - 1) ? tile - 1 : tile
  for (const box of propBoxes(prop, look, head)) addBox(shapes, x, at.y, y, alongY ? { ...box, wide: box.deep, deep: box.wide } : box)
}

/**
 * The battle's buildings: a floor tile joins the floor tiles beside it into a building, and each building takes the
 * next of the region's wall colours. Returns each building's floor tiles, and the wall colour by tile.
 */
function buildings(battle: Battle, look: Look): { rooms: number[][]; colour: Map<number, number> } {
  const colour = new Map<number, number>()
  const rooms: number[][] = []
  battle.ground.forEach((g, start) => {
    if (g !== 'floor' || colour.has(start)) return
    const paint = look.walls[rooms.length % look.walls.length]
    const room = [start]
    colour.set(start, paint)
    for (const t of room)
      for (const n of [t - 1, t + 1, t - GRID, t + GRID]) {
        if (n < 0 || n >= GRID * GRID || colour.has(n) || battle.ground[n] !== 'floor' || Math.abs((n % GRID) - (t % GRID)) > 1) continue
        colour.set(n, paint)
        room.push(n)
      }
    rooms.push(room)
  })
  return { rooms, colour }
}

/**
 * Roofs each building at the height of its walls' trim, in one of the region's roof styles and colours. A ruin has none.
 */
function addRoofs(s: Stage, battle: Battle, look: Look, rooms: number[][], colour: Map<number, number>, top: number): void {
  // A roof runs out over the walls round its edge.
  const eave = WALL_THICK
  rooms.forEach((room, i) => {
    if (battle.place === 'ruins') return
    const paint = look.roofs ? look.roofs[i % look.roofs.length] : shade(colour.get(room[0])!, 0.72)
    const shapes = new Shapes()
    const y = spot(room[0] % GRID, Math.floor(room[0] / GRID)).y + top
    const xs = room.map((t) => t % GRID)
    const ys = room.map((t) => Math.floor(t / GRID))
    const footing = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys), y }
    // A rectangular building takes one of its region's roofs; any other shape, such as one round a courtyard, a flat one.
    const square = (footing.x2 - footing.x1 + 1) * (footing.y2 - footing.y1 + 1) === room.length
    let seed = room[0] * 2654435761
    const rand = () => ((seed = (seed * 1103515245 + 12345) | 0) >>> 8) / 16777216
    // Weathered, no two roofs quite the same shade.
    const worn = shade(paint, 0.85 + rand() * 0.3)
    if (square) addRoof(shapes, look.roof[pick(room[0], look.roof.length)], footing, worn, colour.get(room[0])!, eave, rand)
    else for (const t of room) shapes.flat((t % GRID) - 0.5 - eave, Math.floor(t / GRID) - 0.5 - eave, (t % GRID) + 0.5 + eave, Math.floor(t / GRID) + 0.5 + eave, y, worn)
    const { mesh } = shapes.build(true)
    s.terrain.add(mesh)
    s.scenery.push({ node: mesh, tiles: room })
    s.roofs.push({ tiles: new Set(room), box: footing, fade: ditherable(mesh.material as MeshBasicMaterial), mesh })
  })
}

/**
 * Builds the battle's ground, props, walls and windows afresh, in its region's look. They change only when a blast
 * wrecks them.
 */
export function drawTerrain(s: Stage, battle: Battle): void {
  s.scenery.length = 0
  s.walls = []
  s.roofs = []
  empty(s.terrain)
  empty(s.chasm)
  s.chasm.add(buildChasm(battle))
  const look = LOOKS[battle.region]
  const { rooms, colour: paint } = buildings(battle, look)
  /** A wall's colour: the building's on either side of it. */
  const wallColour = (a: number, b: number) => paint.get(a) ?? paint.get(b) ?? look.walls[0]
  const lift = look.up / EDGE_UP
  // Each wall is topped by its region's trim.
  const edgeBoxes = (edge: Exclude<Edge, 'none'>, color: number) => [
    ...EDGE_BOXES[edge].map((box) => ({ ...box, base: box.base * lift, up: box.up * lift, color: box.alpha ? look.glass : color })),
    { wide: 1, deep: WALL_THICK * 1.5, base: EDGE_UP * lift, up: CAP_UP, color: look.cap },
  ]
  const ground = new Shapes()
  for (let tile = 0; tile < GRID * GRID; tile++) {
    const kind = battle.ground[tile]
    // Where the ground falls away there is nothing to draw.
    if (kind === 'void') continue
    const x = tile % GRID
    const y = Math.floor(tile / GRID)
    const top = LEVEL * battle.height[tile]
    const color = kind === 'floor' ? look.floor : (look.ground[kind] ?? GROUND_COLOR[kind])
    // The faces a raised tile shows above its lower neighbours.
    const drop = (nx: number, ny: number) => (onGridTile(nx, ny) ? Math.max(0, battle.height[tile] - battle.height[ny * GRID + nx]) * LEVEL : 0)
    const sides = [
      [x - 0.5, y + 0.5, x + 0.5, y + 0.5, drop(x, y + 1), 0.6],
      [x + 0.5, y - 0.5, x + 0.5, y + 0.5, drop(x + 1, y), 0.45],
      [x - 0.5, y - 0.5, x + 0.5, y - 0.5, drop(x, y - 1), 0.6],
      [x - 0.5, y - 0.5, x - 0.5, y + 0.5, drop(x - 1, y), 0.45],
    ] as const
    for (const [ax, az, bx, bz, fall, light] of sides) if (fall > 0) ground.quad({ x: ax, y: top, z: az }, { x: bx, y: top, z: bz }, { x: bx, y: top - fall, z: bz }, { x: ax, y: top - fall, z: az }, shade(color, light))
    ground.flat(x - 0.5, y - 0.5, x + 0.5, y + 0.5, top, highland(color, battle.height[tile]))
    for (const [ax, az, bx, bz] of [
        [x - 0.5, y - 0.5, x + 0.5, y - 0.5],
        [x - 0.5, y - 0.5, x - 0.5, y + 0.5],
      ])
        ground.line({ x: ax, y: top + 0.002, z: az }, { x: bx, y: top + 0.002, z: bz }, COLOR.line, 0.5)
  }
  const built = ground.build()
  // The ground is the terrain's first child, which a click on the map is tested against.
  s.terrain.add(built.mesh)
  if (built.lines) s.terrain.add(built.lines)
  for (let tile = 0; tile < GRID * GRID; tile++) {
    const props = battle.props
    if (battle.ground[tile] === 'void') continue
    const x = tile % GRID
    const y = Math.floor(tile / GRID)
    const at = spot(x, y)
    const north = battle.north[tile]
    const west = battle.west[tile]
    if (props[tile] !== 'none') {
      const shapes = new Shapes()
      const blobs: Object3D[] = []
      addProp(props, tile, shapes, blobs, look)
      stand(s, shapes, blobs, [tile])
    }
    // A wall stands on the edge it divides this tile from its neighbour by.
    if (north !== 'none') {
      const shapes = new Shapes()
      for (const box of edgeBoxes(north, wallColour(tile, tile - GRID))) addBox(shapes, x, at.y, y - 0.5, box)
      stand(s, shapes, [], [tile, tile - GRID], { x, y: y - 0.5 })
    }
    if (west !== 'none') {
      const shapes = new Shapes()
      for (const box of edgeBoxes(west, wallColour(tile, tile - 1))) addBox(shapes, x - 0.5, at.y, y, { ...box, wide: box.deep, deep: box.wide })
      stand(s, shapes, [], [tile, tile - 1], { x: x - 0.5, y })
    }
  }
  addRoofs(s, battle, look, rooms, paint, tall(EDGE_UP * lift + CAP_UP) + 0.01)
}
