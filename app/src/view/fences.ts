// The holographic fences round zones in play.
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial } from 'three'
import type { Tile } from '../core/battle'
import { tall } from './space'

/** How tall a zone's fence stands, in screen pixels seen from the still camera, and how long it takes to rise. */
const HEIGHT = 64
export const RISE_MS = 700

/**
 * A holographic fence round a square zone: `reach` tiles each way from `at`, standing on ground `base` units up. It
 * glows brightest at its foot, fades toward its top, and bands of light climb it; `rise` lifts it out of the ground.
 */
export function fence(at: Tile, reach: number, base: number, color: number): { mesh: Mesh; time: { value: number }; rise: { value: number } } {
  const [x0, x1, z0, z1] = [at.x - reach - 0.5, at.x + reach + 0.5, at.y - reach - 0.5, at.y + reach + 0.5]
  const corners = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]
  const top = base + tall(HEIGHT)
  // Each side a wall: two triangles, `up` 0 at the foot and 1 at the top, `along` running round the fence.
  const position: number[] = []
  const up: number[] = []
  const along: number[] = []
  corners.forEach(([ax, az], i) => {
    const [bx, bz] = corners[(i + 1) % 4]
    const [s, e] = [i, i + 1]
    position.push(ax, base, az, bx, base, bz, bx, top, bz, ax, base, az, bx, top, bz, ax, top, az)
    up.push(0, 0, 1, 0, 1, 1)
    along.push(s, e, e, s, e, s)
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(position), 3))
  geometry.setAttribute('up', new BufferAttribute(new Float32Array(up), 1))
  geometry.setAttribute('along', new BufferAttribute(new Float32Array(along), 1))
  const time = { value: 0 }
  const rise = { value: 0 }
  const material = new ShaderMaterial({
    uniforms: { time, rise, color: { value: new Color(color) } },
    vertexShader: `
      attribute float up;
      attribute float along;
      uniform float rise;
      varying float vUp;
      varying float vAlong;
      void main() {
        vUp = up;
        vAlong = along;
        vec3 p = position;
        p.y = mix(${base.toFixed(3)}, p.y, rise);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying float vUp;
      varying float vAlong;
      void main() {
        float fade = pow(1.0 - vUp, 1.6);
        float bands = 0.55 + 0.45 * smoothstep(0.6, 1.0, sin((vUp * 9.0 - time * 2.2) * 3.14159));
        float posts = smoothstep(0.92, 1.0, abs(fract(vAlong * 4.0) * 2.0 - 1.0));
        float foot = smoothstep(0.08, 0.0, vUp);
        gl_FragColor = vec4(color * 1.6, clamp(fade * bands * 0.95 + posts * fade * 0.8 + foot, 0.0, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  })
  return { mesh: new Mesh(geometry, material), time, rise }
}
