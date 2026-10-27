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
 * Draws dotted trails over the run map, from each stop to each it leads to. Trails the squad has walked are solid;
 * those it can take next glow.
 */
export function drawTrails(map: Element): void {
  const paths: string[] = []
  for (const cell of map.querySelectorAll<HTMLElement>('.cell')) {
    const from = cell.querySelector('.node')!
    for (const id of cell.dataset.next!.split(' ').filter(Boolean)) {
      const target = map.querySelector(`[data-n="${id}"]`)!
      const to = target.querySelector('.node')!
      const cls = from.matches('.done') && to.matches('.done, .here') ? 'walked' : target.querySelector('.option') || from.matches('.here') ? 'open' : ''
      paths.push(bend(centre(map, from, 'right'), centre(map, to, 'left'), cls))
    }
  }
  map.querySelector('svg')?.remove()
  map.insertAdjacentHTML('afterbegin', `<svg class="trails" width="${map.scrollWidth}" height="${map.scrollHeight}">${paths.join('')}</svg>`)
}
