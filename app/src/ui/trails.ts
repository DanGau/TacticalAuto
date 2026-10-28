/** Where a node's top or bottom edge sits in the map's scrolled content. */
function edge(map: Element, node: Element, side: 'top' | 'bottom'): { x: number; y: number } {
  const m = map.getBoundingClientRect()
  const r = node.getBoundingClientRect()
  return { x: r.left + r.width / 2 - m.left + map.scrollLeft, y: (side === 'top' ? r.top : r.bottom) - m.top + map.scrollTop }
}

/** A gently bending trail up from `a` to `b`. */
function bend(a: { x: number; y: number }, b: { x: number; y: number }, cls: string): string {
  const my = (a.y + b.y) / 2
  return `<path class="${cls}" d="M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}"/>`
}

/**
 * Draws dotted trails over the run map, up from each stop to each shown that it leads to. Trails the squad has walked are solid;
 * those it can take next glow.
 */
export function drawTrails(map: Element): void {
  const paths: string[] = []
  for (const cell of map.querySelectorAll<HTMLElement>('.cell')) {
    const from = cell.querySelector('.node')!
    for (const id of cell.dataset.next!.split(' ').filter(Boolean)) {
      // A stop hidden from the squad has no trail to it.
      const target = map.querySelector(`[data-n="${id}"]`)
      const to = target?.querySelector('.node')
      if (!target || !to) continue
      const cls = from.matches('.done') && to.matches('.done, .here') ? 'walked' : target.querySelector('.option') || from.matches('.here') ? 'open' : ''
      paths.push(bend(edge(map, from, 'top'), edge(map, to, 'bottom'), cls))
    }
  }
  map.querySelector('svg')?.remove()
  map.insertAdjacentHTML('afterbegin', `<svg class="trails" width="${map.scrollWidth}" height="${map.scrollHeight}">${paths.join('')}</svg>`)
}
