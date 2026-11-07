// A class's skill tree as a map: Basics and perks, then the class power on top, a column per path, its rows downward, links from each row to the next, capstones along the bottom.
import type { ClassId } from '../core/classes'
import { usage } from '../core/powers'
import type { Soldier } from '../core/run-state'
import { PERKS } from '../core/perks'
import { capstones, committed, pathOf, powerOf, SKILLS, TREES, type SkillId } from '../core/skills'
import { skillOffers } from '../core/squad'
import { describe } from './html'
import { basicsOf, tag } from './kit'

/** Whether a hero knows a skill, is offered it now, turned it down for good, could be offered it later, or stands in a path it did not take. */
export type SkillState = 'taken' | 'offered' | 'lost' | 'open' | 'locked'

export function skillState(hero: Soldier, id: SkillId): SkillState {
  const took = committed(hero.cls!, hero.skills)
  return hero.skills.includes(id) ? 'taken' : skillOffers(hero).includes(id) ? 'offered' : hero.lost.includes(id) ? 'lost' : took && pathOf(hero.cls!, id) !== took ? 'locked' : 'open'
}

/** The map's size in its own units, which are about pixels at a phone's width. */
export const MAP = { width: 336, node: { w: 46, h: 40 }, row: 46, gap: 12, root: 66, heads: 104, top: 112 }

export interface MapNode {
  id: SkillId
  /** Its path's column, or -1 for the class power. */
  path: number
  /** Its row: 0 the power's, 1 the entries', down to the capstones'. */
  layer: number
  /** The centre, in map units. */
  x: number
  y: number
}

/** Each row of a path placed in its column, two abreast and the third under them; a link from each node to each of the next row. */
export function treeLayout(cls: ClassId): { nodes: MapNode[]; links: { from: SkillId; to: SkillId }[]; heads: { name: string; x: number }[]; height: number } {
  const { paths, power } = TREES[cls]
  const col = MAP.width / paths.length
  const nodes: MapNode[] = [{ id: power, path: -1, layer: 0, x: MAP.width / 2, y: MAP.root }]
  const spread = MAP.node.w / 2 + 6
  let y = MAP.top
  for (let r = 0; r < paths[0].rows.length; r++) {
    const lines = Math.max(...paths.map((p) => Math.ceil(p.rows[r].length / 2)))
    paths.forEach((p, path) =>
      p.rows[r].forEach((id, i) => {
        const pair = p.rows[r].length - (i - (i % 2)) > 1
        nodes.push({ id, path, layer: r + 1, x: col * (path + 0.5) + (pair ? (i % 2 === 0 ? -spread : spread) : 0), y: y + Math.floor(i / 2) * MAP.row + MAP.node.h / 2 })
      }),
    )
    y += lines * MAP.row + MAP.gap
  }
  const links = paths.flatMap((p) => [...p.rows[0].map((to) => ({ from: power, to })), ...p.rows.slice(1).flatMap((row, r) => p.rows[r].flatMap((from) => row.map((to) => ({ from, to }))))])
  return { nodes, links, heads: paths.map((p, i) => ({ name: p.name, x: col * (i + 0.5) })), height: y }
}

/** Where a skill stands in the tree and what taking it does, in words. */
export function rule(hero: Soldier, id: SkillId): string {
  const cls = hero.cls!
  const path = pathOf(cls, id)
  if (!path) return 'Free on recruit'
  const row = path.rows.findIndex((r) => r.includes(id))
  const took = committed(cls, hero.skills)
  if (took && took !== path) return `Locked: ${hero.name} took ${took.name}`
  if (row === 0) return `First pick: takes ${path.name}, and the other paths lock`
  return `Pick ${row + 1} of ${path.name}${row === path.rows.length - 1 ? ', a capstone' : ''}`
}

const STATE_WORDS: Record<SkillState, string> = { taken: 'Learned', offered: 'Offered now', open: 'May be offered later', lost: 'Lost: turned down this run', locked: 'Locked' }

/** A skill's card: name and source tag, use, text, where it stands, and where the hero stands with it. */
function card(hero: Soldier, id: SkillId, held?: Parameters<typeof describe>[2]): string {
  const skill = SKILLS[id]
  const kind = id === powerOf(hero.cls!) ? 'class' : 'skill'
  return `<span class="tree-card" role="tooltip">${tag(kind, skill.name)} <small class="use">${usage(skill)}</small><span>${describe(skill.text, skill.tags, held)}</span><small>${rule(hero, id)} · <b class="${skillState(hero, id)}">${STATE_WORDS[skillState(hero, id)]}</b></small></span>`
}

/** A hero's tree as a map; `cell` draws each skill's node, by default its name. */
export function treeMap(hero: Soldier, cell: (id: SkillId, state: SkillState) => string = (id, state) => `<span class="node-name ${state}" tabindex="0">${SKILLS[id].name}</span>`, held?: Parameters<typeof describe>[2]): string {
  const cls = hero.cls!
  const { nodes, links, heads, height } = treeLayout(cls)
  const at = new Map(nodes.map((n) => [n.id, n]))
  const caps = capstones(cls)
  const took = committed(cls, hero.skills)
  // Each node by its top middle; no transform, so a card docked to the screen on a phone escapes it.
  const pct = (x: number, y: number) => `left:${(100 * x) / MAP.width}%;top:${(100 * y) / height}%`
  const line = ({ from, to }: { from: SkillId; to: SkillId }) => {
    const [a, b] = [at.get(from)!, at.get(to)!]
    const [sa, sb] = [skillState(hero, from), skillState(hero, to)]
    const look = sa === 'taken' && sb === 'taken' ? 'lit' : sa === 'taken' && sb === 'offered' ? 'live' : sb === 'lost' || sa === 'lost' ? 'dead' : sb === 'locked' ? 'locked' : 'dim'
    const midY = b.y - MAP.node.h / 2 - 5
    return `<path class="link ${look}" d="M${a.x} ${a.y + MAP.node.h / 2}V${midY}H${b.x}V${b.y - MAP.node.h / 2}"/>`
  }
  // Lit and live links drawn last, so they show over the dim.
  const order = (l: { from: SkillId; to: SkillId }) => ['taken', 'offered'].filter((s) => s === skillState(hero, l.to) || s === skillState(hero, l.from)).length
  const head = (h: { name: string; x: number }, i: number) => `<text class="head${took && TREES[cls].paths[i] !== took ? ' shut' : ''}" x="${h.x}" y="${MAP.heads}">${h.name}</text>`
  const svg = `<svg viewBox="0 0 ${MAP.width} ${height}" preserveAspectRatio="none" aria-hidden="true">${[...links].sort((a, b) => order(a) - order(b)).map(line).join('')}${heads.map(head).join('')}</svg>`
  const basic = `<div class="basics-row" style="top:${(100 * 14) / height}%;height:var(--bh)">${[...basicsOf(hero).map((name) => tag('basic', name)), ...hero.perks.map((id) => tag('perk', PERKS[id].name, PERKS[id].text))].map((t) => `<span class="basic-chip">${t}</span>`).join('')}</div>`
  const look = (n: MapNode) => [n.path < 0 ? 'root' : '', caps.includes(n.id) ? 'cap' : '', skillState(hero, n.id)].filter(Boolean).join(' ')
  const skills = nodes.map((n) => `<div class="tree-node ${look(n)}" style="${pct(n.x, n.y - MAP.node.h / 2)}">${cell(n.id, skillState(hero, n.id))}${card(hero, n.id, held)}</div>`).join('')
  return `<div class="treemap" style="aspect-ratio:${MAP.width}/${height};--nw:${(100 * MAP.node.w) / MAP.width}%;--nh:${(100 * MAP.node.h) / height}%;--bh:${(100 * 30) / height}%"><small class="basics-head">Basics</small>${svg}${basic}${skills}</div>`
}
