// The player's camera: drag to pan, wheel or pinch to zoom, turn by quarter turns, recentre; the camera follows the action again once they let go.
import { clamped, closest, FIT, panned, settled, still, type Camera } from './camera'
import type { Stage } from './stage'

/** Screen pixels a press moves before it pans the camera. */
const DRAG_PX = 6
/** How long after the player lets go the camera is left where they put it. */
const HOLD_MS = 2500
/** How long a turn or a recentre glides. */
const TURN_MS = 450
/** The zoom a wheel notch, or a key, changes by. */
const NOTCH = 1.15
/** How much closer than the closest framing the player may zoom. */
const NEAREST = 3

/** Wires the camera to the canvas, the keys and the buttons in `#cam`. `home` is the framing of what is in play at turn `yaw`; `turned` hears a quarter turn. */
export function installControls(s: Stage, home: (yaw: number) => Camera, turned: (yaw: number) => void): HTMLElement {
  const { canvas } = s
  canvas.style.touchAction = 'none'
  const pointers = new Map<number, { x: number; y: number }>()
  let moved = false
  let start = { x: 0, y: 0 }
  const grab = () => {
    s.held = Infinity
    s.glides++
  }
  const letGo = () => (s.held = performance.now() + HOLD_MS)
  const bounded = (zoom: number) => Math.min(closest() * NEAREST, Math.max(FIT, zoom))

  /** Zooms by `k` about screen point `x`, `y`, the ground under it staying put. */
  function zoomAbout(k: number, x: number, y: number): void {
    const c = s.camera
    const zoom = bounded(c.zoom * k)
    const scale = s.scale()
    const keep = 1 - c.zoom / zoom
    s.look(clamped({ ...panned(c, -(x - innerWidth / 2) * keep, -(y - innerHeight / 2) * keep, scale), zoom }))
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    canvas.setPointerCapture(e.pointerId)
    if (pointers.size === 1) {
      moved = false
      start = { x: e.clientX, y: e.clientY }
    }
  })
  canvas.addEventListener('pointermove', (e) => {
    const was = pointers.get(e.pointerId)
    if (!was || !still(s.camera)) return
    if (pointers.size === 1) {
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= DRAG_PX) return
      moved = true
      grab()
      s.look(clamped(panned(s.camera, e.clientX - was.x, e.clientY - was.y, s.scale())))
    } else if (pointers.size === 2) {
      // A pinch zooms by how far the fingers spread, about their middle, and pans as the middle moves.
      const other = [...pointers].find(([id]) => id !== e.pointerId)![1]
      const before = Math.hypot(was.x - other.x, was.y - other.y)
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      moved = true
      grab()
      s.look(clamped(panned(s.camera, (e.clientX - was.x) / 2, (e.clientY - was.y) / 2, s.scale())))
      if (before > 0) zoomAbout(after / before, (e.clientX + other.x) / 2, (e.clientY + other.y) / 2)
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  })
  const release = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return
    if (moved && pointers.size === 0) letGo()
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  // A drag is not a click.
  canvas.addEventListener('click', (e) => moved && e.stopImmediatePropagation(), { capture: true })
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      if (!still(s.camera)) return
      grab()
      zoomAbout(NOTCH ** (-e.deltaY / 100), e.clientX, e.clientY)
      letGo()
    },
    { passive: false },
  )

  const turn = (by: number) => {
    if (!still(s.camera)) return
    const yaw = settled(s.camera.yaw) + by * (Math.PI / 2)
    turned(yaw)
    grab()
    void s.follow({ ...s.camera, yaw }, TURN_MS).then(letGo)
  }
  const recentre = () => {
    if (!still(s.camera)) return
    s.glides++
    s.held = 0
    void s.follow(home(settled(s.camera.yaw)), TURN_MS)
  }
  const zoomKey = (k: number) => {
    if (!still(s.camera)) return
    grab()
    zoomAbout(k, innerWidth / 2, innerHeight / 2)
    letGo()
  }

  const bar = document.createElement('div')
  bar.id = 'cam'
  bar.hidden = true
  const buttons: [string, string, () => void][] = [
    ['⟲', 'Turn camera left (Q)', () => turn(-1)],
    ['−', 'Zoom out (-)', () => zoomKey(1 / NOTCH)],
    ['⌖', 'Recentre camera (C)', recentre],
    ['+', 'Zoom in (+)', () => zoomKey(NOTCH)],
    ['⟳', 'Turn camera right (E)', () => turn(1)],
  ]
  bar.innerHTML = `<span class="cam-label">🎥</span>${buttons.map(([glyph, title], i) => `<button data-cam="${i}" title="${title}" aria-label="${title}">${glyph}</button>`).join('')}`
  bar.addEventListener('pointerdown', (e) => e.stopPropagation())
  bar.addEventListener('click', (e) => {
    const i = (e.target as HTMLElement).closest('button')?.dataset.cam
    if (i !== undefined) buttons[Number(i)][2]()
  })
  document.body.append(bar)
  const keys: Record<string, () => void> = { q: () => turn(-1), e: () => turn(1), c: recentre, Home: recentre, '+': () => zoomKey(NOTCH), '=': () => zoomKey(NOTCH), '-': () => zoomKey(1 / NOTCH) }
  addEventListener('keydown', (e) => {
    if (bar.hidden || e.ctrlKey || e.metaKey || e.altKey) return
    keys[e.key.length === 1 ? e.key.toLowerCase() : e.key]?.()
  })
  return bar
}
