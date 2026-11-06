// The floating tip over any `[data-tip]` mark, and the card inside any `[data-card]` mark: shown on hover, focus, or tap, kept inside the screen.

export function installTips(root: HTMLElement): void {
  const box = document.createElement('div')
  box.className = 'charttip'
  box.hidden = true
  document.body.append(box)
  let held: HTMLElement | null = null

  const show = (mark: HTMLElement) => {
    held = mark
    box.textContent = mark.dataset.tip!
    box.hidden = false
    // Zoomed as the panel is, so it reads at the panel's size; placed in screen pixels over the zoom.
    const zoom = Number(getComputedStyle(root).zoom) || 1
    box.style.zoom = String(zoom)
    const at = mark.getBoundingClientRect()
    const [w, h] = [box.offsetWidth * zoom, box.offsetHeight * zoom]
    const x = Math.min(Math.max(8, at.left + at.width / 2 - w / 2), innerWidth - w - 8)
    const above = at.top - h - 8
    box.style.left = `${x / zoom}px`
    box.style.top = `${(above >= 8 ? above : at.bottom + 8) / zoom}px`
  }
  const hide = (mark: Element | null) => {
    if (mark !== held) return
    held = null
    box.hidden = true
  }
  const markOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('[data-tip]')

  root.addEventListener('pointerover', (e) => {
    const mark = markOf(e)
    if (mark && e.pointerType === 'mouse') show(mark)
  })
  root.addEventListener('pointerout', (e) => e.pointerType === 'mouse' && hide(markOf(e)))
  root.addEventListener('focusin', (e) => markOf(e) && show(markOf(e)!))
  root.addEventListener('focusout', (e) => hide(markOf(e)))
  // Caught before the card under it hears it: a tap on a mark shows its tip, and does not also choose the card.
  root.addEventListener(
    'click',
    (e) => {
      const mark = markOf(e)
      if (!mark) return
      e.stopPropagation()
      mark.focus()
    },
    true,
  )
  root.addEventListener('scroll', () => held && show(held), true)
  new MutationObserver(() => hide(held)).observe(root, { childList: true })
  installCards(root)
}

/** Where a w by h card goes by `at`: below, above, right or left, the first inside the screen and clear of `keep`. */
export function placeCard(at: DOMRect, w: number, h: number, keep: DOMRect | null, screen = { w: innerWidth, h: innerHeight }): [number, number] {
  const fitX = (x: number) => Math.min(Math.max(8, x), screen.w - w - 8)
  const fitY = (y: number) => Math.min(Math.max(8, y), screen.h - h - 8)
  const spots: [number, number][] = [
    [fitX(at.left), at.bottom + 6],
    [fitX(at.left), at.top - h - 6],
    [at.right + 6, fitY(at.top)],
    [at.left - w - 6, fitY(at.top)],
  ]
  const inside = ([x, y]: [number, number]) => x >= 8 && y >= 8 && x + w <= screen.w - 8 && y + h <= screen.h - 8
  const clear = ([x, y]: [number, number]) => !keep || x + w <= keep.left || x >= keep.right || y + h <= keep.top || y >= keep.bottom
  return spots.find((s) => inside(s) && clear(s)) ?? spots.find(inside) ?? [fitX(at.left), fitY(at.bottom + 6)]
}

function installCards(root: HTMLElement): void {
  let held: HTMLElement | null = null
  const cardOf = (mark: HTMLElement) => mark.querySelector<HTMLElement>('.gearpop')!
  const show = (mark: HTMLElement) => {
    if (held && held !== mark) cardOf(held).hidden = true
    held = mark
    const card = cardOf(mark)
    card.hidden = false
    const zoom = Number(getComputedStyle(root).zoom) || 1
    const keep = root.querySelector('.found')?.getBoundingClientRect() ?? null
    const [x, y] = placeCard(mark.getBoundingClientRect(), card.offsetWidth * zoom, card.offsetHeight * zoom, keep)
    card.style.left = `${x / zoom}px`
    card.style.top = `${y / zoom}px`
  }
  const hide = (mark: HTMLElement | null) => {
    if (!mark || mark !== held) return
    cardOf(mark).hidden = true
    held = null
  }
  const markOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('[data-card]')
  const leaves = (e: PointerEvent | FocusEvent) => !markOf(e)?.contains(e.relatedTarget as Node)
  root.addEventListener('pointerover', (e) => e.pointerType === 'mouse' && markOf(e) && show(markOf(e)!))
  root.addEventListener('pointerout', (e) => e.pointerType === 'mouse' && leaves(e) && hide(markOf(e)))
  root.addEventListener('focusin', (e) => markOf(e) && show(markOf(e)!))
  root.addEventListener('focusout', (e) => leaves(e) && hide(markOf(e)))
  // A tap on a mark shows its card and does not choose the option it sits in; a tap elsewhere puts it away.
  root.addEventListener(
    'click',
    (e) => {
      const mark = markOf(e)
      if (!mark) return hide(held)
      e.stopPropagation()
      mark.focus()
      show(mark)
    },
    true,
  )
  root.addEventListener('scroll', () => held && show(held), true)
  new MutationObserver(() => (held = null)).observe(root, { childList: true })
}
