// Marks on the ground and over it: entrances, goals and their fences, acid and fire, fog, and glows of unfound aliens.
import { type Group, type Mesh, type MeshBasicMaterial, type Object3D, Sprite as Billboard, type SpriteMaterial } from 'three'
import { ENTRY_RADIUS, GRID, type Battle, type Tile } from '../core/battle'
import { UPLINK_REACH } from '../core/fighters'
import { EXTRACT_REACH } from '../core/goals'
import { nearestAlien } from '../core/grid'
import { ENTRANCE_KINDS } from '../core/entrances'
import { visibleTiles } from '../core/sight'
import { DECAL_LIFT, spot } from './camera'
import { fence } from './fences'
import { COLOR, mixTint } from './palette'
import { empty, Shapes, tinted } from './shapes'
import { ACROSS, TILE_W, tall } from './space'
import type { Label, Stage } from './stage'

/** Words over a tile, `rise` of their height above it. */
const label = (text: string, tile: Tile, color: number, size = 44): Label => ({ text, color, size, at: () => spot(tile.x, tile.y), rise: size === 44 ? 0.8 : 0, outline: 6, alpha: 1 })

/** Replaces the marks on the ground in `layer` with `shapes`. */
function lay(layer: Group, shapes: Shapes): void {
  empty(layer)
  const { mesh } = shapes.build()
  mesh.renderOrder = layer.renderOrder
  layer.add(mesh)
}

/** A tile's top, as a mark on the ground. */
const diamond = (shapes: Shapes, x: number, y: number, color: number, alpha: number, lift = DECAL_LIFT) => {
  const h = spot(x, y).y + lift
  shapes.flat(x - 0.5, y - 0.5, x + 0.5, y + 0.5, h, color, alpha)
}

/** A ring around a tile's top, `width` screen pixels wide. */
const ring = (shapes: Shapes, x: number, y: number, color: number, width: number, alpha: number) => {
  const h = spot(x, y).y + DECAL_LIFT * 2
  const w = width / ACROSS
  const c = [
    { x: x - 0.5, y: h, z: y - 0.5 },
    { x: x + 0.5, y: h, z: y - 0.5 },
    { x: x + 0.5, y: h, z: y + 0.5 },
    { x: x - 0.5, y: h, z: y + 0.5 },
  ]
  for (let i = 0; i < 4; i++) shapes.band(c[i], c[(i + 1) % 4], w, color, alpha)
}

/** Before the entrance: tints and names each entrance, and names those the mission turns on. */
export function drawMarks(s: Stage, battle: Battle): void {
  const { hovered, selected } = s
  const tint = new Shapes()
  const marks: Label[] = (s.marks = [])
  if (battle.uplink) marks.push(label('📡 UPLINK', battle.uplink, COLOR.uplink, 28))
  if (battle.extract) marks.push(label('🚁 EXTRACT', battle.extract, COLOR.uplink, 28))
  for (const cache of battle.caches) marks.push(label('📦', cache, COLOR.uplink, 24))
  const vip = battle.vip === 'held' && battle.units.find((u) => u.civilian === 'vip')
  if (vip) marks.push(label('⭐ VIP', vip, COLOR.vip, 28))
  // Soldiers down where they fell; a recovery's captives are held.
  for (const body of battle.downed.filter((d) => d.carrier === null)) marks.push(label(battle.captives.some((c) => c.soldier === body.soldier) ? '⛓ HELD' : '✚ DOWNED', body, COLOR.contact, 22))
  // Aliens caught off guard say so over their heads until they recover, while the squad sees them.
  for (const u of battle.units) {
    if (u.surprised && s.sprites.has(u.id) && (!s.seen || s.seen[u.y * GRID + u.x])) marks.push(label('❗ SURPRISED', u, COLOR.crit, 16))
  }
  if (battle.phase === 'deploy') {
    if (!s.briefing)
      battle.entrances.forEach(({ kind, at: zone }, i) => {
        for (let y = zone.y - ENTRY_RADIUS; y <= zone.y + ENTRY_RADIUS; y++) {
          for (let x = zone.x - ENTRY_RADIUS; x <= zone.x + ENTRY_RADIUS; x++) {
            if (y >= 0 && x >= 0 && y < GRID && x < GRID && battle.ground[y * GRID + x] !== 'void') diamond(tint, x, y, i === hovered || i === selected ? COLOR.zoneHover : COLOR.zone, 0.8)
          }
        }
        // The selected entrance's way in: a line to the uplink, or to the nearest contact.
        const toward = i === selected && (battle.uplink ?? nearestAlien(battle, zone))
        if (toward) {
          const a = spot(zone.x, zone.y)
          const b = spot(toward.x, toward.y)
          const lift = Math.max(a.y, b.y) + DECAL_LIFT * 3
          tint.band({ ...a, y: lift }, { ...b, y: lift }, 4 / ACROSS, battle.uplink ? COLOR.uplink : COLOR.contact, 0.9)
        }
        marks.push(label(`${ENTRANCE_KINDS[kind].icon} ${ENTRANCE_KINDS[kind].name}`, zone, 0xffffff, 26))
      })
    // Those the mission turns on are named; every other alien speaks for itself.
    for (const u of battle.units.filter((a) => a.side === 'alien' && (a.target || a.boss))) marks.push(label(u.target ? '🎯 COMMANDER' : battle.goal === 'ambush' ? 'THE HUNTER' : battle.place === 'hive' ? 'THE SOURCE' : 'GUARDIAN', u, COLOR.contact, 20))
  }
  lay(s.zones, tint)
  // A fence rings each zone in play: the entrances to choose from, the uplink to hold, the way out.
  const rings: [Tile, number, number][] = []
  if (battle.phase === 'deploy' && !s.briefing) battle.entrances.forEach(({ at }, i) => rings.push([at, ENTRY_RADIUS, i === hovered || i === selected ? COLOR.zoneHover : COLOR.zone]))
  if (battle.uplink) rings.push([battle.uplink, UPLINK_REACH, COLOR.uplink])
  if (battle.extract) rings.push([battle.extract, EXTRACT_REACH, COLOR.extract])
  const next = new Map<string, ReturnType<typeof fence>>()
  for (const [at, reach, color] of rings) {
    const key = `${at.x},${at.y},${reach},${color}`
    next.set(key, s.standing.get(key) ?? fence(at, reach, spot(at.x, at.y).y + DECAL_LIFT, color))
  }
  for (const [key, f] of s.standing) if (!next.has(key)) f.mesh.geometry.dispose()
  s.standing = next
  s.fences.clear()
  for (const f of s.standing.values()) s.fences.add(f.mesh)
}

/** Dims a node of the scenery, or a unit, by `tint`. */
function dim(node: Object3D, tint: number): void {
  node.traverse((part) => {
    const material = (part as Mesh).material as MeshBasicMaterial | SpriteMaterial | undefined
    if (!material) return
    // A shared material is swapped for the shared one of the tint.
    if (material.userData.kind) return void ((part as Mesh).material = tinted(material.userData.kind, tint))
    // A blob's material holds its own colour, so it is dimmed from that; a box's colours are its vertices'.
    if (part instanceof Billboard) part.userData.color ??= material.color.getHex()
    const own = part.userData.color as number | undefined
    material.color.setHex(own === undefined ? tint : mixTint(own, tint))
  })
}

/** Darkens every tile no soldier sees, and whatever stands on it. Before the entrance nothing is fogged. */
export function drawFog(s: Stage, battle: Battle, snap = false): void {
  const shapes = new Shapes()
  const seen = (s.seen = battle.phase === 'deploy' ? null : visibleTiles(battle))
  const tint = (tile: number) => (!seen || seen[tile] ? 0xffffff : COLOR.dim)
  seen?.forEach((lit, i) => {
    if (!lit && battle.ground[i] !== 'void') diamond(shapes, i % GRID, Math.floor(i / GRID), COLOR.fog, 0.55, DECAL_LIFT * 3)
  })
  lay(s.fog, shapes)
  // Mid-beat, a glow stays where its slide left it; the battle already holds where the alien ends up.
  const lurking = seen ? battle.units.filter((u) => u.hp > 0 && !u.civilian && !u.revealed) : []
  const ids = new Set(lurking.map((u) => u.id))
  for (const [id, glow] of s.glows) {
    if (ids.has(id)) continue
    s.lurk.remove(glow.node)
    s.glows.delete(id)
  }
  for (const unit of lurking) {
    let glow = s.glows.get(unit.id)
    if (!glow) {
      const shapes = new Shapes()
      for (const [scale, alpha] of [[1, 0.12], [0.65, 0.14], [0.35, 0.16]]) shapes.disc(0, 0, DECAL_LIFT * 4, (TILE_W / 2 / ACROSS) * scale, (TILE_W / 2 / ACROSS) * scale, COLOR.lurk, alpha)
      const node = shapes.build().mesh
      s.lurk.add(node)
      glow = { node, tile: unit }
      s.glows.set(unit.id, glow)
    } else if (!snap) continue
    glow.tile = { x: unit.x, y: unit.y }
    const p = spot(unit.x, unit.y)
    glow.node.position.set(p.x, p.y, p.z)
  }
  for (const { node, tiles: lit } of s.scenery) dim(node, !seen || lit.some((tile) => seen?.[tile]) ? 0xffffff : COLOR.dim)
  for (const sprite of s.sprites.values()) (sprite.body.material as SpriteMaterial).color.setHex(tint(Math.round(sprite.tile.y) * GRID + Math.round(sprite.tile.x)))
}

/** Tints every tile of acid or fire, marks every tile of caltrops, and rings each unit rooted or charged. */
export function drawAcid(s: Stage, battle: Battle): void {
  const shapes = new Shapes()
  for (const pool of battle.acid) diamond(shapes, pool.x, pool.y, COLOR.acid, 0.45)
  for (const pool of battle.fire) diamond(shapes, pool.x, pool.y, COLOR.fire, 0.5)
  // Caltrops: a scatter of spikes across the tile.
  for (const tile of battle.caltrops) {
    const at = spot(tile.x, tile.y)
    for (const [dx, dz] of [[-0.25, 0.1], [0, -0.2], [0.25, 0.1], [-0.12, 0.25], [0.12, 0.25]]) shapes.spike(at.x + dx, at.z + dz, at.y, 0.05, { x: at.x + dx, y: at.y + tall(5), z: at.z + dz }, COLOR.spike)
  }
  for (const unit of battle.units.filter((u) => u.hp > 0 && u.revealed)) {
    if (unit.rooted > 0) ring(shapes, unit.x, unit.y, COLOR.rooted, 3, 0.9)
    if (unit.booming > 0) ring(shapes, unit.x, unit.y, COLOR.booming, 2, 0.9)
  }
  lay(s.acid, shapes)
}
