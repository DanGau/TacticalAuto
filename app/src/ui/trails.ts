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
 * those it can take next glow, or, with a stop picked, those from it on.
 */
export function drawTrails(map: Element): void {
  const paths: string[] = []
  // With a stop picked, its trails ahead light up and the rest grey out.
  const picked = map.querySelector('.option.picked')?.closest<HTMLElement>('.cell')
  const lit = new Set<string>()
  for (let todo = picked ? [picked.dataset.n!] : []; todo.length > 0; ) {
    const id = todo.pop()!
    if (lit.has(id)) continue
    lit.add(id)
    const cell = map.querySelector<HTMLElement>(`[data-n="${id}"]`)
    if (cell) todo.push(...cell.dataset.next!.split(' ').filter(Boolean))
  }
  for (const cell of map.querySelectorAll<HTMLElement>('.cell')) cell.classList.toggle('dim', !!picked && !lit.has(cell.dataset.n!) && !cell.querySelector('.done, .here'))
  for (const cell of map.querySelectorAll<HTMLElement>('.cell')) {
    const from = cell.querySelector('.node')!
    for (const id of cell.dataset.next!.split(' ').filter(Boolean)) {
      // A stop hidden from the squad has no trail to it.
      const target = map.querySelector(`[data-n="${id}"]`)
      const to = target?.querySelector('.node')
      if (!target || !to) continue
      const walked = from.matches('.done') && to.matches('.done, .here')
      const ahead = picked ? lit.has(cell.dataset.n!) && lit.has(id) : target.querySelector('.option') || from.matches('.here')
      const cls = walked ? 'walked' : picked && to.closest('.option.picked') ? 'open' : ahead ? 'open' : ''
      paths.push(bend(edge(map, from, 'top'), edge(map, to, 'bottom'), cls))
    }
  }
  map.querySelector('svg')?.remove()
  map.insertAdjacentHTML('afterbegin', `<svg class="trails" width="${map.scrollWidth}" height="${map.scrollHeight}">${paths.join('')}</svg>`)
}
