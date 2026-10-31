// Where things are in the world and on the camera's picture, and the cameras that frame them.
import { Vector3 } from 'three'
import { GRID, type Tile } from '../core/battle'
import type { Point3 } from './shapes'
import { ACROSS, LEVEL, PITCH, TILE_H, TILE_W, YAW } from './space'

export const WIDTH = 1280
export const HEIGHT = 720

/** Zoom that shows the whole map. */
export const FIT = Math.min(WIDTH / (GRID * TILE_W), HEIGHT / (GRID * TILE_H + 80))
/** Screen pixels kept clear around what the camera frames. */
const MARGIN = 220
/** How far a decal floats over the ground it marks, so the ground never shows through it. */
export const DECAL_LIFT = 0.02

export const onGridTile = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID

/** The height of each tile of the battle shown, row by row. */
let heights: number[] = []

/** Sets the heights of the battle shown, which `spot` stands points on. */
export const setHeights = (to: number[]) => void (heights = to)

/** The point on the ground at the centre of a tile, its height that of the tile it rounds to. Fractional tiles are allowed. */
export const spot = (x: number, y: number): Point3 => ({ x, y: LEVEL * (heights[Math.round(y) * GRID + Math.round(x)] ?? 0), z: y })

/** The world point the camera's plane is measured from: the middle of the map, on the ground. */
const ORIGIN = { x: (GRID - 1) / 2, y: 0, z: (GRID - 1) / 2 }

/** The camera's axes for a turn of `yaw` and a tilt of `pitch`: toward it, and to the right and up across its picture. */
export function axes(yaw: number, pitch = PITCH): { back: Vector3; right: Vector3; up: Vector3 } {
  const back = new Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw))
  const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
  return { back, right, up: new Vector3().crossVectors(back, right) }
}

/**
 * Where a world point falls in the camera's picture, in screen pixels at zoom 1 measured from the map's middle, y
 * down. Seen from the still camera, it is where the flat isometric map would draw it.
 */
export function picture(p: Point3, yaw: number): Tile {
  const { right, up } = axes(yaw)
  const d = new Vector3(p.x - ORIGIN.x, p.y - ORIGIN.y, p.z - ORIGIN.z)
  return { x: d.dot(right) * ACROSS, y: -d.dot(up) * ACROSS }
}

export const lerp = (a: Tile, b: Tile, t: number): Tile => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** How far a walk through `points` goes over the ground, in tiles: a diagonal step is the longer. */
const ground = (points: Tile[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0)

/** Where a walk through `points` is once it has gone a share `t` of the way, at a steady pace. */
export function along(points: Tile[], t: number): Tile {
  let left = t * ground(points)
  for (let i = 1; i < points.length; i++) {
    const step = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    if (left <= step && step > 0) return lerp(points[i - 1], points[i], left / step)
    left -= step
  }
  return points.at(-1)!
}

/**
 * What the camera shows: the world point at the screen's centre; a zoom, the screen size of what stands there; its
 * turn about the vertical and tilt down from level; its lens's field of view in degrees; and how thick the haze that
 * sinks the distance into the night. At the still lens the view is all but flat, as an isometric map is.
 */
export interface Camera {
  x: number
  y: number
  z: number
  zoom: number
  yaw: number
  pitch: number
  fov: number
  haze: number
}

/** The still camera's lens: so narrow, and so far off, that the map is drawn all but flat. */
export const STILL_FOV = 0.25
/** How far the haze reaches past what the camera looks at, in world units, at its thinnest and thickest. */
export const HAZE_REACH = [400, 26]

/** A shot's camera, against the still camera: how much more it turns and tilts, its lens, its haze, and the third of the screen its subject sits on, -1 left to 1 right. */
export interface Shot {
  turn?: number
  pitch?: number
  fov?: number
  haze?: number
  third?: number
}

/** The camera that shows the picture point `at` at the screen's centre, aimed at the ground `height` units up. */
export function aim(at: Tile, zoom: number, yaw = YAW, height = 0): Camera {
  const { back, right, up } = axes(yaw)
  const p = new Vector3(ORIGIN.x, ORIGIN.y, ORIGIN.z).addScaledVector(right, at.x / ACROSS).addScaledVector(up, -at.y / ACROSS)
  // Slid along the line of sight, which leaves the picture as it is, onto the ground.
  p.addScaledVector(back, (height - p.y) / back.y)
  return { x: p.x, y: p.y, z: p.z, zoom, yaw, pitch: PITCH, fov: STILL_FOV, haze: 0 }
}

/** The camera that frames the given tiles, zoomed in no closer than life size. */
export function framing(points: Tile[], yaw = YAW, margin = MARGIN): Camera {
  const at = points.map((p) => picture(spot(p.x, p.y), yaw))
  const xs = at.map((p) => p.x)
  const ys = at.map((p) => p.y)
  const width = Math.max(...xs) - Math.min(...xs) + margin
  const height = Math.max(...ys) - Math.min(...ys) + margin
  const middle = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 }
  const ground = points.reduce((sum, p) => sum + spot(p.x, p.y).y, 0) / points.length
  return aim(middle, Math.max(FIT, Math.min(1, WIDTH / width, HEIGHT / height)), yaw, ground)
}

/**
 * The still camera `to` moved only as far in, and over, as keeps everything it shows on the map, so the
 * screen never reaches past it, unless that would push any of `keep` out of frame. A wide lens shows the far
 * distance by design, and is left alone.
 */
export function clamped(to: Camera, keep: Tile[] = []): Camera {
  if (to.fov > STILL_FOV) return to
  const s = Math.min(innerWidth / WIDTH, innerHeight / HEIGHT)
  // The ground the screen shows, in tiles from its centre to its farthest corner at zoom 1, whichever way it turns.
  const corner = Math.hypot(innerWidth / 2 / s / ACROSS, innerHeight / 2 / s / ACROSS / Math.sin(to.pitch))
  const half = (GRID - 1) / 2
  const zoom = Math.max(to.zoom, corner / half)
  const reach = corner / zoom
  const within = (v: number) => Math.min(GRID - 1 - reach, Math.max(reach, v))
  const kept = keep.map((p) => picture(spot(p.x, p.y), to.yaw))
  const shows = (c: Camera) => {
    const at = picture(c, c.yaw)
    return kept.every((p) => Math.abs(p.x - at.x) * zoom <= WIDTH / 4 && Math.abs(p.y - at.y) * zoom <= HEIGHT / 4)
  }
  // Slid back toward `to` until all of `keep` is in the screen's middle half.
  for (let t = 1; ; t -= 0.1) {
    const c = { ...to, x: to.x + (within(to.x) - to.x) * t, z: to.z + (within(to.z) - to.z) * t, zoom }
    if (t <= 0 || shows(c)) return c
  }
}
