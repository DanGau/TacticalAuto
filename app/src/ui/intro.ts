import { ALIENS, type AlienKind } from '../core/aliens'
import type { Battle } from '../core/battle'
import type { GameEvent } from '../core/combat'

const KEY = 'metAliens'

/** Kinds this player has been introduced to, kept in the browser across runs. */
const met: Set<AlienKind> = (() => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as AlienKind[])
  } catch {
    return new Set()
  }
})()

/** Whether the player knows this kind: it needs no introduction, or has had one. */
export const known = (kind: AlienKind) => !ALIENS[kind].intro || met.has(kind)

/** The kinds the player has not met among the aliens `events` brought into view. */
export function newcomers(battle: Battle, events: GameEvent[]): AlienKind[] {
  const ids = events.flatMap((e) => (e.type === 'reveal' || e.type === 'wave' || e.type === 'sighted' ? e.units.map((u) => u.id) : e.type === 'spawn' ? [e.unit.id] : []))
  const kinds = ids.flatMap((id) => battle.units.find((u) => u.id === id)?.kind ?? [])
  return [...new Set(kinds)].filter((kind) => !known(kind))
}

/** Each introduced kind's portrait, drawn on a 200 by 200 canvas. */
const PORTRAITS: Partial<Record<AlienKind, string>> = {
  juggernaut: `<ellipse cx="100" cy="120" rx="62" ry="58" fill="#5d626b"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${44 + i * 28}" y="${66 + (i % 2) * 10}" width="34" height="78" rx="6" fill="#8a8f99" stroke="#3b3f46" stroke-width="3"/>`).join('')}
    <rect x="76" y="44" width="48" height="26" rx="8" fill="#6c717b"/><rect x="86" y="54" width="28" height="5" fill="#ff5555"/>`,
  incubator: `<ellipse cx="100" cy="112" rx="52" ry="68" fill="#d8c27a" opacity="0.9"/>
    <path d="M70 70 Q90 100 76 140 M126 64 Q112 104 130 150 M100 46 Q104 90 96 176" stroke="#8a6d2a" stroke-width="3" fill="none"/>
    <ellipse cx="100" cy="116" rx="26" ry="34" fill="#5a3a1a" opacity="0.6"/><circle cx="92" cy="104" r="4" fill="#ffd166"/><circle cx="108" cy="104" r="4" fill="#ffd166"/>`,
  wraith: `<path d="M100 30 C150 40 150 110 140 170 Q120 150 110 175 Q100 150 90 175 Q80 150 60 170 C50 110 50 40 100 30Z" fill="#b8c8ff" opacity="0.45"/>
    <path d="M100 48 C134 56 132 104 126 140 Q100 126 74 140 C68 104 66 56 100 48Z" fill="#dfe6ff" opacity="0.35"/>
    <ellipse cx="88" cy="86" rx="6" ry="9" fill="#fff"/><ellipse cx="112" cy="86" rx="6" ry="9" fill="#fff"/>`,
  burrower: `<rect x="0" y="140" width="200" height="60" fill="#3a2a1c"/><path d="M30 142 Q100 70 170 142Z" fill="#5c412a"/>
    <ellipse cx="100" cy="112" rx="36" ry="30" fill="#9c6b3f"/><circle cx="88" cy="104" r="5" fill="#ffd166"/><circle cx="112" cy="104" r="5" fill="#ffd166"/>
    ${[56, 74, 126, 144].map((x) => `<path d="M${x} 142 L${x + (x < 100 ? -10 : 10)} 96 L${x + (x < 100 ? 6 : -6)} 142Z" fill="#e8dcc0"/>`).join('')}`,
  feeder: `<ellipse cx="100" cy="110" rx="64" ry="62" fill="#c23b6e"/><circle cx="100" cy="118" r="38" fill="#2a0f1a"/>
    ${Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      const [x, y] = [100 + 38 * Math.cos(a), 118 + 38 * Math.sin(a)]
      const [tx, ty] = [100 + 24 * Math.cos(a), 118 + 24 * Math.sin(a)]
      return `<path d="M${x - 5 * Math.sin(a)} ${y + 5 * Math.cos(a)} L${tx} ${ty} L${x + 5 * Math.sin(a)} ${y - 5 * Math.cos(a)}Z" fill="#f4e6d0"/>`
    }).join('')}
    <circle cx="74" cy="66" r="6" fill="#ffd166"/><circle cx="126" cy="66" r="6" fill="#ffd166"/>`,
  regenerator: `<circle cx="100" cy="112" r="74" fill="none" stroke="#2fc7a0" stroke-width="3" opacity="0.4"/>
    <ellipse cx="100" cy="112" rx="50" ry="58" fill="#2fc7a0"/>
    <path d="M70 90 L130 130 M76 140 L124 84" stroke="#1a6b56" stroke-width="5" stroke-dasharray="6 4"/>
    <circle cx="86" cy="86" r="5" fill="#10141c"/><circle cx="114" cy="86" r="5" fill="#10141c"/>`,
  sprinter: `${[60, 90, 120].map((y) => `<line x1="10" y1="${y}" x2="70" y2="${y}" stroke="#f2e04b" stroke-width="3" opacity="0.5"/>`).join('')}
    <path d="M60 150 L110 60 L160 70 L130 100 L150 160 L120 120Z" fill="#f2e04b"/><circle cx="140" cy="76" r="5" fill="#10141c"/>`,
  hiveNode: `<path d="M40 170 Q30 90 80 60 Q120 30 150 70 Q180 110 160 170Z" fill="#6b3fa0"/>
    ${[[80, 100], [118, 86], [104, 130], [140, 126], [70, 146]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#2a1540"/>`).join('')}
    ${[[30, 186], [176, 182], [100, 190]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#3f8f4a"/>`).join('')}`,
  mirror: `<path d="M100 26 L156 100 L100 178 L44 100Z" fill="#e6f0ff" opacity="0.85"/><path d="M100 26 L156 100 L100 100Z" fill="#fff" opacity="0.6"/>
    <path d="M100 70 Q112 70 112 84 Q112 96 100 96 Q88 96 88 84 Q88 70 100 70Z M84 140 Q84 104 100 104 Q116 104 116 140Z" fill="#4a5a78" opacity="0.7"/>`,
}

/**
 * The first time the player meets a kind: a full screen of its portrait, its name and one calm line on what it will do,
 * until the player acknowledges it.
 */
export function introduce(kind: AlienKind): Promise<void> {
  met.add(kind)
  try {
    localStorage.setItem(KEY, JSON.stringify([...met]))
  } catch {
    // The introduction plays again next time.
  }
  const screen = document.createElement('div')
  screen.className = 'intro'
  screen.innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true">${PORTRAITS[kind] ?? ''}</svg><small>New contact</small><h1>${ALIENS[kind].name}</h1><p>${ALIENS[kind].intro}</p><button>Acknowledged</button>`
  document.body.append(screen)
  return new Promise((resolve) =>
    screen.querySelector('button')!.addEventListener('click', () => {
      screen.remove()
      resolve()
    }),
  )
}
