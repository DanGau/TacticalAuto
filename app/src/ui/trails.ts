/** Where a node sits in the map's scrolled content. */
function centre(map: Element, node: Element, side: 'left' | 'right'): { x: number; y: number } {
  const m = map.getBoundingClientRect()
  const r = node.getBoundingClientRect()
  return { x: (side === 'left' ? r.left : r.right) - m.left + map.scrollLeft, y: r.top + r.height / 2 - m.top }
}

/** A gently bending trail from `a` to `b`. */
function bend(a: { x: number; y: number }, b: { x: number; y: number }, cls: string): string {
  const mx = (a.x + b.x) / 2
  return `<path class="${cls}" d="M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}"/>`
}

/**
 * Draws dotted trails over the run map: along each row of stops, and between stretches through a waypoint where the
 * rows of one meet and the rows of the next part. Trails the squad has walked are solid; those it can take next glow.
 */
export function drawTrails(map: Element): void {
  const segs = [...map.querySelectorAll('.seg')]
  const paths: string[] = []
  const state = (a: Element, b: Element) => (a.matches('.done') && b.matches('.done, .here') ? 'walked' : a.matches('.done, .here') || a.closest('.branch') ? 'open' : '')
  const rows = (seg: Element) => [...seg.querySelectorAll('.nodes')].map((row) => [...row.querySelectorAll('.node')])
  segs.forEach((seg, i) => {
    for (const row of rows(seg)) row.slice(1).forEach((node, k) => paths.push(bend(centre(map, row[k], 'right'), centre(map, node, 'left'), state(row[k], node))))
    const next = segs[i + 1]
    if (!next) return
    const exits = rows(seg).map((row) => row.at(-1)!)
    const entries = rows(next).map((row) => row[0])
    const from = exits.map((a) => centre(map, a, 'right'))
    const to = entries.map((b) => centre(map, b, 'left'))
    const way = { x: (Math.max(...from.map((p) => p.x)) + Math.min(...to.map((p) => p.x))) / 2, y: (from.concat(to).reduce((n, p) => n + p.y, 0)) / (from.length + to.length) }
    const walked = exits.some((a) => a.matches('.done')) && entries.some((b) => b.matches('.done, .here'))
    exits.forEach((a, k) => paths.push(bend(from[k], way, a.matches('.done') ? (walked ? 'walked' : 'open') : '')))
    entries.forEach((b, k) => paths.push(bend(way, to[k], b.matches('.done, .here') && walked ? 'walked' : exits.some((a) => a.matches('.done, .here')) || b.closest('.branch') ? 'open' : '')))
    paths.push(`<circle class="${walked ? 'walked' : ''}" cx="${way.x}" cy="${way.y}" r="3"/>`)
  })
  map.querySelector('svg')?.remove()
  map.insertAdjacentHTML('afterbegin', `<svg class="trails" width="${map.scrollWidth}" height="${map.scrollHeight}">${paths.join('')}</svg>`)
}
