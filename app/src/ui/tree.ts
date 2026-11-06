// A class's skill tree as a map: Basics and the class power on top, a column per path, links downward where one skill opens the next, twins side by side, capstones along the bottom.
import type { ClassId } from '../core/classes'
import { usage } from '../core/powers'
import type { Soldier } from '../core/run-state'
import { BASICS } from '../core/sources'
import { capstones, locked, opensOf, pathOf, powerOf, SKILLS, TREES, treeOf, twinOf, unlocked, type SkillId } from '../core/skills'
import { skillOffers } from '../core/squad'
import { describe } from './html'
import { tag } from './kit'

/** Whether a hero knows a skill, is offered it now, turned it down for good, could be offered it later, or has it locked. */
export type SkillState = 'taken' | 'offered' | 'lost' | 'open' | 'locked'

export const skillState = (hero: Soldier, id: SkillId): SkillState =>
  hero.skills.includes(id) ? 'taken' : skillOffers(hero).includes(id) ? 'offered' : hero.lost.includes(id) ? 'lost' : unlocked(hero.cls!, hero.skills).includes(id) ? 'open' : 'locked'

/** The map's size in its own units, which are about pixels at a phone's width. */
export const MAP = { width: 336, node: { w: 46, h: 40 }, row: 48, gap: 10, root: 66, heads: 104, top: 112 }

export interface MapNode {
  id: SkillId
  /** Its path's column, or -1 for the class power. */
  path: number
  /** Its row band: 1 under the power, down to the capstones' at the bottom. */
  layer: number
  /** The centre, in map units. */
  x: number
  y: number
}

const parentsOf = (cls: ClassId, id: SkillId) => treeOf(cls).filter((k) => opensOf(cls, k).includes(id))

/** Each skill's row band: one below the lowest of those that open it, so every link runs down; capstones share the last. */
function layers(cls: ClassId): Map<SkillId, number> {
  const layer = new Map<SkillId, number>([[powerOf(cls), 0]])
  const of = (id: SkillId): number => layer.get(id) ?? (layer.set(id, 1 + Math.max(...parentsOf(cls, id).map(of))), layer.get(id)!)
  for (const id of treeOf(cls)) of(id)
  const last = Math.max(...capstones(cls).map(of))
  for (const id of capstones(cls)) layer.set(id, last)
  return layer
}

/** Each skill placed two abreast at most within its path's column, twins paired; a link from each skill to each it opens. */
export function treeLayout(cls: ClassId): { nodes: MapNode[]; links: { from: SkillId; to: SkillId }[]; twins: [SkillId, SkillId][]; basics: { x: number; y: number }[]; heads: { name: string; x: number }[]; height: number } {
  const { paths } = TREES[cls]
  const col = MAP.width / paths.length
  const layer = layers(cls)
  const nodes: MapNode[] = [{ id: powerOf(cls), path: -1, layer: 0, x: MAP.width / 2, y: MAP.root }]
  let y = MAP.top
  for (let band = 1; band <= Math.max(...layer.values()); band++) {
    const groups = paths.map((_, p) => {
      const here = treeOf(cls).filter((id) => layer.get(id) === band && pathOf(cls, id) === paths[p])
      const paired = here.filter((id) => here.includes(twinOf(cls, id)!))
      return [...paired, ...here.filter((id) => !paired.includes(id))]
    })
    groups.forEach((ids, path) =>
      ids.forEach((id, i) => {
        const row = Math.floor(i / 2)
        const pair = ids.length - row * 2 > 1
        nodes.push({ id, path, layer: band, x: col * (path + 0.5) + (pair ? (i % 2 === 0 ? -1 : 1) * (MAP.node.w / 2 + 6) : 0), y: y + row * MAP.row + MAP.node.h / 2 })
      }),
    )
    y += Math.max(...groups.map((ids) => Math.ceil(ids.length / 2))) * MAP.row + MAP.gap
  }
  const links = treeOf(cls).flatMap((from) => opensOf(cls, from).map((to) => ({ from, to })))
  const basics = [1, 3, 5].map((k) => ({ x: (MAP.width * k) / 6, y: 22 }))
  return { nodes, links, twins: TREES[cls].twins, basics, heads: paths.map((p, i) => ({ name: p.name, x: col * (i + 0.5) })), height: y }
}

const names = (ids: SkillId[]) => ids.map((id) => SKILLS[id].name).join(' or ')

/** What opens a skill and what it shuts, in words. */
export function rule(hero: Soldier, id: SkillId): string {
  const cls = hero.cls!
  if (id === powerOf(cls)) return 'Free on recruit'
  const twin = twinOf(cls, id)
  const parts = [`Opened by ${names(parentsOf(cls, id))}`]
  if (twin) parts.push(`twin of ${SKILLS[twin].name}: taking one locks the other`)
  if (capstones(cls).includes(id)) parts.push('capstone: a hero takes one')
  if (locked(cls, hero.skills).includes(id)) parts.push(hero.skills.includes(twin!) ? `locked by ${SKILLS[twin!].name}` : 'locked by the capstone taken')
  return parts.join('; ')
}

const STATE_WORDS: Record<SkillState, string> = { taken: 'Learned', offered: 'Offered now', open: 'May be offered later', lost: 'Lost: turned down this run', locked: 'Locked' }

/** A skill's card: name and source tag, use, text, what opens it, and where the hero stands with it. */
function card(hero: Soldier, id: SkillId, held?: Parameters<typeof describe>[2]): string {
  const skill = SKILLS[id]
  const kind = id === powerOf(hero.cls!) ? 'class' : 'skill'
  return `<span class="tree-card" role="tooltip">${tag(kind, skill.name)} <small class="use">${usage(skill)}</small><span>${describe(skill.text, skill.tags, held)}</span><small>${rule(hero, id)} · <b class="${skillState(hero, id)}">${STATE_WORDS[skillState(hero, id)]}</b></small></span>`
}

/** A hero's tree as a map; `cell` draws each skill's node, by default its name. */
export function treeMap(hero: Soldier, cell: (id: SkillId, state: SkillState) => string = (id, state) => `<span class="node-name ${state}" tabindex="0">${SKILLS[id].name}</span>`, held?: Parameters<typeof describe>[2]): string {
  const cls = hero.cls!
  const { nodes, links, twins, basics, heads, height } = treeLayout(cls)
  const at = new Map(nodes.map((n) => [n.id, n]))
  const caps = capstones(cls)
  // Each node by its top middle; no transform, so a card docked to the screen on a phone escapes it.
  const pct = (x: number, y: number) => `left:${(100 * x) / MAP.width}%;top:${(100 * y) / height}%`
  const line = ({ from, to }: { from: SkillId; to: SkillId }) => {
    const [a, b] = [at.get(from)!, at.get(to)!]
    const [sa, sb] = [skillState(hero, from), skillState(hero, to)]
    const look = sa === 'taken' && sb === 'taken' ? 'lit' : sa === 'taken' && sb === 'offered' ? 'live' : sb === 'lost' || sa === 'lost' ? 'dead' : sb === 'locked' ? 'locked' : 'dim'
    const midY = b.y - MAP.node.h / 2 - 5
    return `<path class="link ${look}" d="M${a.x} ${a.y + MAP.node.h / 2}V${midY}H${b.x}V${b.y - MAP.node.h / 2}"/>`
  }
  const bar = ([a, b]: [SkillId, SkillId]) => {
    const [p, q] = [at.get(a)!, at.get(b)!]
    const shut = [a, b].some((id) => hero.skills.includes(id))
    return `<g class="twin${shut ? ' shut' : ''}"><line x1="${p.x + MAP.node.w / 2}" y1="${p.y}" x2="${q.x - MAP.node.w / 2}" y2="${q.y}"/><text x="${(p.x + q.x) / 2}" y="${p.y + 4}">⟷</text></g>`
  }
  const head = (h: { name: string; x: number }) => `<text class="head" x="${h.x}" y="${MAP.heads}">${h.name}</text>`
  const svg = `<svg viewBox="0 0 ${MAP.width} ${height}" preserveAspectRatio="none" aria-hidden="true">${links.map(line).join('')}${heads.map(head).join('')}${twins.map(bar).join('')}</svg>`
  const basic = basics.map((p, i) => `<div class="tree-node basic" style="${pct(p.x, p.y - 13)}"><span class="node-name taken">${tag('basic', [BASICS.attack, BASICS.throw, BASICS.jump][i])}</span></div>`).join('')
  const look = (n: MapNode) => [n.path < 0 ? 'root' : '', caps.includes(n.id) ? 'cap' : '', skillState(hero, n.id)].filter(Boolean).join(' ')
  const skills = nodes.map((n) => `<div class="tree-node ${look(n)}" style="${pct(n.x, n.y - MAP.node.h / 2)}">${cell(n.id, skillState(hero, n.id))}${card(hero, n.id, held)}</div>`).join('')
  return `<div class="treemap" style="aspect-ratio:${MAP.width}/${height};--nw:${(100 * MAP.node.w) / MAP.width}%;--nh:${(100 * MAP.node.h) / height}%;--bh:${(100 * 26) / height}%"><small class="basics-head">Basics</small>${svg}${basic}${skills}</div>`
}
