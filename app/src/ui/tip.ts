// The floating tip over any `[data-tip]` mark: shown on hover, focus, or tap, kept inside the screen.

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
}
