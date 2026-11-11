// The recruit choice's motion: a card opening into a hero's dossier and closing back into it, and the plunge past the hero into the globe on deploy.

/** How long a card takes to open or close, and the plunge on deploy, in milliseconds. */
const OPEN_MS = 420
export const DEPLOY_MS = 1200

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** The transform that lays `el`, at rest, over `card`, in `el`'s own pixels under any zoom. */
function over(el: HTMLElement, card: DOMRect): string {
  const at = el.getBoundingClientRect()
  const zoom = at.width / el.offsetWidth || 1
  return `translate(${(card.left - at.left) / zoom}px, ${(card.top - at.top) / zoom}px) scale(${card.width / at.width}, ${card.height / at.height})`
}

/** Grows the dossier in `root` out of the card it was opened from. */
export function expand(root: HTMLElement, card: DOMRect | undefined): void {
  const dossier = root.querySelector<HTMLElement>('.dossier')
  if (!dossier) return
  dossier.querySelector<HTMLElement>('[data-deploy]')?.focus()
  if (!card || calm()) return void dossier.animate({ opacity: [0, 1] }, 250)
  dossier.style.transformOrigin = '0 0'
  dossier.animate([{ transform: over(dossier, card), opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: OPEN_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
  for (const part of dossier.querySelectorAll<HTMLElement>('.stage, .about')) part.animate({ opacity: [0, 1] }, { duration: OPEN_MS * 0.6, delay: OPEN_MS * 0.4, fill: 'backwards' })
}

/** Shrinks the dossier in `root` back into its card, then `closed`. */
export function collapse(root: HTMLElement, card: DOMRect | undefined, closed: () => void): void {
  const dossier = root.querySelector<HTMLElement>('.dossier')
  if (!dossier) return closed()
  const keyframes = card && !calm() ? [{ transform: 'none', opacity: 1 }, { transform: over(dossier, card), opacity: 0 }] : { opacity: [1, 0] }
  for (const part of dossier.querySelectorAll<HTMLElement>('.stage, .about')) part.animate({ opacity: [1, 0] }, { duration: OPEN_MS * 0.4, fill: 'forwards' })
  dossier.animate(keyframes, { duration: OPEN_MS * 0.8, easing: 'cubic-bezier(0.5, 0, 0.8, 0.4)', fill: 'forwards' }).onfinish = closed
}

/** Plunges past the hero into the globe, down onto their city, then `landed`; a crossfade under reduced motion. */
export function deploy(root: HTMLElement, landed: () => void): void {
  const menu = root.querySelector<HTMLElement>('.picking')
  const globe = root.querySelector<HTMLElement>('.globe')
  const city = root.querySelector<HTMLElement>('.cell.chosen')
  menu?.classList.add('deploying')
  if (calm() || !menu || !globe || !city) {
    menu?.animate({ opacity: [1, 0] }, { duration: 400, fill: 'forwards' })
    return void setTimeout(landed, 400)
  }
  const ease = 'cubic-bezier(0.55, 0, 0.85, 0.35)'
  root.querySelector('.about')?.animate({ opacity: [1, 0], transform: ['none', 'translateX(40px)'] }, { duration: 300, fill: 'forwards' })
  root.querySelector('.stage')?.animate({ transform: ['none', 'scale(5)'], opacity: [1, 1, 0] }, { duration: DEPLOY_MS * 0.55, easing: ease, fill: 'forwards' })
  // The city comes to the middle of the screen as the globe falls toward it.
  // The city slides to the middle of the screen early, while the globe swells about it, slowly then fast.
  const map = globe.parentElement!
  const zoom = map.getBoundingClientRect().width / map.offsetWidth || 1
  const spot = city.getBoundingClientRect()
  const [dx, dy] = [(innerWidth / 2 - spot.left) / zoom, (innerHeight / 2 - spot.top) / zoom]
  map.animate({ transform: ['none', `translate(${dx}px, ${dy}px)`] }, { duration: DEPLOY_MS * 0.6, easing: 'ease-in-out', fill: 'forwards' })
  // The globe only ever slides, so swelling about the city keeps it where the slide puts it.
  const slid = getComputedStyle(globe).transform.replace('none', '')
  globe.classList.add('diving')
  globe.style.transformOrigin = `${city.offsetLeft}px ${city.offsetTop}px`
  globe.animate({ transform: [`${slid} scale(1)`, `${slid} scale(10)`] }, { duration: DEPLOY_MS, easing: ease, fill: 'forwards' })
  menu.animate({ opacity: [1, 1, 0] }, { duration: DEPLOY_MS, easing: 'ease-in', fill: 'forwards' })
  setTimeout(landed, DEPLOY_MS)
}
