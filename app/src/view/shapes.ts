// Building blocks for meshes and 2D sketches: boxes, blobs, lines, tints.
import { type Object3D, BufferGeometry, CanvasTexture, type Material, DoubleSide, Float32BufferAttribute, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial } from 'three'

/** A point in the world: x and z on the ground, along a tile's x and y; y up. */
export interface Point3 {
  x: number
  y: number
  z: number
}

/** A colour scaled toward black, or toward white above 1. */
export function shade(color: number, by: number): number {
  const ch = (c: number) => Math.max(0, Math.min(255, Math.round(by <= 1 ? c * by : c + (255 - c) * (by - 1))))
  return (ch(color >> 16) << 16) | (ch((color >> 8) & 255) << 8) | ch(color & 255)
}

/** Colour `a` moved `t` of the way to `b`. */
export function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift
  return ch(16) | ch(8) | ch(0)
}

/** How much a box's faces darken: its two that face the default camera, and the two that face away. */
const FACE = { south: 0.72, east: 0.55, north: 0.62, west: 0.48 }

/** Flat-coloured triangles and lines, gathered then built into one mesh: the scenery is drawn from boxes and quads. */
export class Shapes {
  private tris: number[] = []
  private colors: number[] = []
  private lines: number[] = []
  private lineColors: number[] = []

  /** A quad through four corners in order, of `color` at `alpha`. */
  quad(a: Point3, b: Point3, c: Point3, d: Point3, color: number, alpha = 1): this {
    this.tri(a, b, c, color, alpha)
    return this.tri(a, c, d, color, alpha)
  }

  tri(a: Point3, b: Point3, c: Point3, color: number, alpha = 1): this {
    for (const p of [a, b, c]) {
      this.tris.push(p.x, p.y, p.z)
      this.colors.push(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, alpha)
    }
    return this
  }

  /** A flat quad on the ground at height `y`, spanning x0..x1 and z0..z1. */
  flat(x0: number, z0: number, x1: number, z1: number, y: number, color: number, alpha = 1): this {
    return this.quad({ x: x0, y, z: z0 }, { x: x1, y, z: z0 }, { x: x1, y, z: z1 }, { x: x0, y, z: z1 }, color, alpha)
  }

  /** A box spanning x0..x1, z0..z1 and y0..y1, its top in `color` and each side shaded by the way it faces. */
  box(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, color: number, alpha = 1): this {
    const p = (x: number, y: number, z: number) => ({ x, y, z })
    this.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), shade(color, FACE.south), alpha)
    this.quad(p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0), shade(color, FACE.east), alpha)
    this.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), shade(color, FACE.north), alpha)
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), shade(color, FACE.west), alpha)
    return this.flat(x0, z0, x1, z1, y1, color, alpha)
  }

  /** A four-sided spike from a square base of half-width `r` up to `apex`. */
  spike(x: number, z: number, y: number, r: number, apex: Point3, color: number, alpha = 1): this {
    const c = [
      { x: x - r, y, z: z + r },
      { x: x + r, y, z: z + r },
      { x: x + r, y, z: z - r },
      { x: x - r, y, z: z - r },
    ]
    const shades = [FACE.south, FACE.east, FACE.north, FACE.west]
    for (let i = 0; i < 4; i++) this.tri(c[i], c[(i + 1) % 4], apex, shade(color, shades[i]), alpha)
    return this
  }

  /** A disc on the ground, of radius rx along x and rz along z. */
  disc(x: number, z: number, y: number, rx: number, rz: number, color: number, alpha = 1): this {
    const steps = 20
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const b = ((i + 1) / steps) * Math.PI * 2
      this.tri({ x, y, z }, { x: x + Math.cos(a) * rx, y, z: z + Math.sin(a) * rz }, { x: x + Math.cos(b) * rx, y, z: z + Math.sin(b) * rz }, color, alpha)
    }
    return this
  }

  /** A line on the ground from `a` to `b`, `width` world units wide. */
  band(a: Point3, b: Point3, width: number, color: number, alpha = 1): this {
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const nx = (-(b.z - a.z) / len) * (width / 2)
    const nz = ((b.x - a.x) / len) * (width / 2)
    return this.quad({ x: a.x + nx, y: a.y, z: a.z + nz }, { x: b.x + nx, y: b.y, z: b.z + nz }, { x: b.x - nx, y: b.y, z: b.z - nz }, { x: a.x - nx, y: a.y, z: a.z - nz }, color, alpha)
  }

  /** A hairline from `a` to `b`. */
  line(a: Point3, b: Point3, color: number, alpha = 1): this {
    this.lines.push(a.x, a.y, a.z, b.x, b.y, b.z)
    for (let i = 0; i < 2; i++) this.lineColors.push(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, alpha)
    return this
  }

  /**
   * The triangles as one mesh, and the lines as another, each colour multiplied by its material's, so it can be tinted.
   * Meshes share their material unless `own`, which a mesh to be dithered needs.
   */
  build(own = false): { mesh: Mesh; lines: LineSegments | null } {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(this.tris, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 4))
    const kind = this.colors.some((c, i) => i % 4 === 3 && c < 1) ? 'translucent' : 'opaque'
    const mesh = new Mesh(geometry, own ? vertexMaterial(kind) : tinted(kind))
    let lines: LineSegments | null = null
    if (this.lines.length > 0) {
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(this.lines, 3))
      g.setAttribute('color', new Float32BufferAttribute(this.lineColors, 4))
      lines = new LineSegments(g, tinted('line'))
    }
    return { mesh, lines }
  }
}

type Kind = 'opaque' | 'translucent' | 'line'

const vertexMaterial = (kind: Kind) =>
  kind === 'line'
    ? new LineBasicMaterial({ vertexColors: true, transparent: true })
    : // One pass: three draws a translucent double-sided mesh twice otherwise, recompiling its program each time.
      new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, forceSinglePass: true, transparent: kind === 'translucent', depthWrite: kind === 'opaque' })

/** Materials shared by every mesh of a kind and tint: thousands of meshes, a handful of materials to compile and switch. */
const materials = new Map<string, MeshBasicMaterial | LineBasicMaterial>()

/** The shared material of vertex colours of `kind`, tinted `tint`. */
export function tinted(kind: Kind, tint = 0xffffff): MeshBasicMaterial | LineBasicMaterial {
  const key = `${kind}:${tint}`
  let material = materials.get(key)
  if (!material) {
    material = vertexMaterial(kind)
    material.color.setHex(tint)
    material.userData.kind = kind
    materials.set(key, material)
  }
  return material
}

/** A soft-edged white dot, tinted per use: smoke, fire, lights and leaves. */
let dot: CanvasTexture | null = null

/** A round blob always facing the camera, `r` world units across, of `color` at `alpha`. */
export function blob(at: Point3, r: number, color: number, alpha = 1): Sprite {
  if (!dot) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(32, 32, 31, 0, Math.PI * 2)
    ctx.fill()
    dot = new CanvasTexture(canvas)
  }
  // A solid blob hides what lies behind it, as a box does; a faint one, such as smoke, shows it through.
  const solid = alpha === 1
  const sprite = new Sprite(new SpriteMaterial({ map: dot, color, opacity: alpha, transparent: !solid, alphaTest: solid ? 0.5 : 0, depthWrite: solid }))
  sprite.position.set(at.x, at.y, at.z)
  sprite.scale.set(r * 2, r * 2, 1)
  return sprite
}

/** A fill or stroke style, as Canvas takes it: a colour, or a colour with an alpha and, for a stroke, a width. */
type Style = number | { color: number; alpha?: number; width?: number }

type Op = (ctx: CanvasRenderingContext2D) => void

/**
 * Vector shapes over the scene, in the camera's plane: a projectile, a spark, a pod streaking down. Each shape is kept
 * until `clear`, and drawn afresh every frame.
 */
export class Sketch {
  private path: Op[] = []
  /** Whether the path was filled or stroked, so the next shape starts a new one. */
  private used = false
  private shapes: { path: Op[]; style: Style; fill: boolean }[] = []

  clear(): this {
    this.shapes = []
    this.path = []
    this.used = false
    return this
  }

  private add(op: Op): this {
    if (this.used) {
      this.path = []
      this.used = false
    }
    this.path.push(op)
    return this
  }

  circle(x: number, y: number, r: number): this {
    return this.add((c) => {
      c.moveTo(x + Math.max(0, r), y)
      c.arc(x, y, Math.max(0, r), 0, Math.PI * 2)
    })
  }

  ellipse(x: number, y: number, rx: number, ry: number): this {
    return this.add((c) => {
      c.moveTo(x + Math.max(0, rx), y)
      c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2)
    })
  }

  rect(x: number, y: number, w: number, h: number): this {
    return this.add((c) => c.rect(x, y, w, h))
  }

  roundRect(x: number, y: number, w: number, h: number, r: number): this {
    return this.add((c) => c.roundRect(x, y, w, Math.max(0, h), Math.min(r, Math.max(0, h) / 2)))
  }

  poly(points: number[]): this {
    return this.add((c) => {
      c.moveTo(points[0], points[1])
      for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1])
      c.closePath()
    })
  }

  moveTo(x: number, y: number): this {
    return this.add((c) => c.moveTo(x, y))
  }

  lineTo(x: number, y: number): this {
    return this.add((c) => c.lineTo(x, y))
  }

  arc(x: number, y: number, r: number, from: number, to: number): this {
    return this.add((c) => c.arc(x, y, r, from, to))
  }

  closePath(): this {
    return this.add((c) => c.closePath())
  }

  fill(style: Style): this {
    this.shapes.push({ path: this.path, style, fill: true })
    this.used = true
    return this
  }

  stroke(style: Style): this {
    this.shapes.push({ path: this.path, style, fill: false })
    this.used = true
    return this
  }

  /** Draws the shapes on `ctx`, already transformed to the camera's plane. */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const shape of this.shapes) {
      const { color, alpha = 1, width = 1 } = typeof shape.style === 'number' ? { color: shape.style } : shape.style
      ctx.globalAlpha = alpha
      ctx.beginPath()
      for (const op of shape.path) op(ctx)
      if (shape.fill) {
        ctx.fillStyle = css(color)
        ctx.fill()
      } else {
        ctx.strokeStyle = css(color)
        ctx.lineWidth = width
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }
}

export const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`

/**
 * Lets a material fade by screen-door dithering: at `fade` below 1 it drops a share of its pixels in a fine fixed
 * pattern, so what lies behind shows through without the sorting faults true transparency has. Returns the handle
 * that sets it, 0 to 1.
 */
export function ditherable(material: Material): { value: number } {
  const fade = { value: 1 }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fade = fade
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `uniform float fade;
const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
void main() {
  ivec2 cell = ivec2(mod(gl_FragCoord.xy, 4.));
  if (fade < 0.999 && (BAYER[cell.y * 4 + cell.x] + 0.5) / 16. >= fade) discard;`,
    )
  }
  material.customProgramCacheKey = () => 'dither'
  return fade
}

/** Empties `group`, freeing what its meshes held on the GPU but the shared materials. */
export function empty(group: Object3D): void {
  group.traverse((part) => {
    if (part === group || !(part instanceof Mesh || part instanceof LineSegments || part instanceof Sprite)) return
    if (!(part instanceof Sprite)) part.geometry.dispose()
    if (!part.material.userData.kind) part.material.dispose()
  })
  group.clear()
}
