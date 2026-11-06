// A class's skill tree as a map: Basics on top, a column per branch, tiers downward, links where one skill opens the next.
import type { ClassId } from '../core/classes'
import { usage } from '../core/powers'
import type { Soldier } from '../core/run-state'
import { BASICS } from '../core/sources'
import { CAPSTONE_PICKS, powerOf, SKILLS, TREES, unlocked, type SkillId } from '../core/skills'
import { skillOffers } from '../core/squad'
import { describe } from './html'
import { tag } from './kit'

/** Whether a hero knows a skill, is offered it now, turned it down for good, could be offered it later, or has it locked. */
export type SkillState = 'taken' | 'offered' | 'lost' | 'open' | 'locked'

export const skillState = (hero: Soldier, id: SkillId): SkillState =>
  hero.skills.includes(id) ? 'taken' : skillOffers(hero).includes(id) ? 'offered' : hero.lost.includes(id) ? 'lost' : unlocked(hero.cls!, hero.skills).includes(id) ? 'open' : 'locked'

/** The map's size in its own units, which are about pixels at a phone's width. */
export const MAP = { width: 336, node: { w: 48, h: 40 }, row: 46, gap: 12, top: 76 }

export interface MapNode {
  id: SkillId
  branch: number
  tier: number
  /** The centre, in map units. */
  x: number
  y: number
}

/** Each skill placed, two abreast at most within its branch's column, every tier starting on one line; a link from each skill to each it helps open. */
export function treeLayout(cls: ClassId): { nodes: MapNode[]; links: { from: SkillId; to: SkillId }[]; basics: { x: number; y: number }[]; heads: { name: string; x: number }[]; height: number } {
  const branches = TREES[cls]
  const col = MAP.width / branches.length
  const nodes: MapNode[] = []
  let y = MAP.top
  for (let tier = 0; tier < 4; tier++) {
    const rows = Math.max(...branches.map((b) => Math.ceil(b.tiers[tier].length / 2)))
    branches.forEach(({ tiers }, branch) => {
      tiers[tier].forEach((id, i) => {
        const row = Math.floor(i / 2)
        const pair = tiers[tier].length - row * 2 > 1
        nodes.push({ id, branch, tier, x: col * (branch + 0.5) + (pair ? (i % 2 === 0 ? -1 : 1) * (MAP.node.w / 2 + 2) : 0), y: y + row * MAP.row + MAP.node.h / 2 })
      })
    })
    y += rows * MAP.row + MAP.gap
  }
  const links = branches.flatMap(({ tiers }) => tiers.slice(1).flatMap((skills, t) => skills.flatMap((to) => tiers[t].map((from) => ({ from, to })))))
  const basics = [1, 3, 5].map((k) => ({ x: (MAP.width * k) / 6, y: 22 }))
  return { nodes, links, basics, heads: branches.map((b, i) => ({ name: b.name, x: col * (i + 0.5) })), height: y }
}

/** What opens a skill, in words. */
function rule(cls: ClassId, node: MapNode): string {
  const branch = TREES[cls][node.branch]
  if (node.tier === 0) return 'Open from the first pick'
  if (node.tier === 1) return `Needs a tier 1 power of ${branch.name}`
  if (node.tier === 2) return `Needs a tier 2 power of ${branch.name} and ${CAPSTONE_PICKS} powers known`
  return `Needs ${branch.tiers[2].map((id) => SKILLS[id].name).join(' or ')}`
}

const STATE_WORDS: Record<SkillState, string> = { taken: 'Learned', offered: 'Offered now', open: 'May be offered later', lost: 'Lost: turned down this run', locked: 'Locked' }

/** A skill's card: name and source tag, use, text, what opens it, and where the hero stands with it. */
function card(hero: Soldier, node: MapNode, held?: Parameters<typeof describe>[2]): string {
  const skill = SKILLS[node.id]
  const kind = node.id === powerOf(hero.cls!) ? 'class' : 'skill'
  return `<span class="tree-card" role="tooltip">${tag(kind, skill.name)} <small class="use">${usage(skill)}</small><span>${describe(skill.text, skill.tags, held)}</span><small>${rule(hero.cls!, node)} · <b class="${skillState(hero, node.id)}">${STATE_WORDS[skillState(hero, node.id)]}</b></small></span>`
}

/** A hero's tree as a map; `cell` draws each skill's node, by default its name. */
export function treeMap(hero: Soldier, cell: (id: SkillId, state: SkillState) => string = (id, state) => `<span class="node-name ${state}" tabindex="0">${SKILLS[id].name}</span>`, held?: Parameters<typeof describe>[2]): string {
  const cls = hero.cls!
  const { nodes, links, basics, heads, height } = treeLayout(cls)
  const at = new Map(nodes.map((n) => [n.id, n]))
  // Each node by its top middle; no transform, so a card docked to the screen on a phone escapes it.
  const pct = (x: number, y: number) => `left:${(100 * x) / MAP.width}%;top:${(100 * y) / height}%`
  const line = ({ from, to }: { from: SkillId; to: SkillId }) => {
    const [a, b] = [at.get(from)!, at.get(to)!]
    const [sa, sb] = [skillState(hero, from), skillState(hero, to)]
    const look = sa === 'taken' && sb === 'taken' ? 'lit' : sa === 'taken' && sb === 'offered' ? 'live' : sb === 'lost' || sa === 'lost' ? 'dead' : sb === 'locked' ? 'locked' : 'dim'
    const midY = (a.y + MAP.node.h / 2 + b.y - MAP.node.h / 2) / 2
    return `<path class="link ${look}" d="M${a.x} ${a.y + MAP.node.h / 2}V${midY}H${b.x}V${b.y - MAP.node.h / 2}"/>`
  }
  const svg = `<svg viewBox="0 0 ${MAP.width} ${height}" preserveAspectRatio="none" aria-hidden="true">${links.map(line).join('')}${heads.map((h, i) => `<line class="spine" x1="${h.x}" y1="34" x2="${h.x}" y2="${MAP.top - 4}"/><text class="head" x="${h.x}" y="${MAP.top - 12}">${TREES[cls][i].name}</text>`).join('')}</svg>`
  const basic = basics.map((p, i) => `<div class="tree-node basic" style="${pct(p.x, p.y - 13)}"><span class="node-name taken">${tag('basic', [BASICS.attack, BASICS.throw, BASICS.jump][i])}</span></div>`).join('')
  const skills = nodes.map((n) => `<div class="tree-node t${n.tier + 1} ${skillState(hero, n.id)}" style="${pct(n.x, n.y - MAP.node.h / 2)}">${cell(n.id, skillState(hero, n.id))}${card(hero, n, held)}</div>`).join('')
  return `<div class="treemap" style="aspect-ratio:${MAP.width}/${height};--nw:${(100 * MAP.node.w) / MAP.width}%;--nh:${(100 * MAP.node.h) / height}%;--bh:${(100 * 26) / height}%"><small class="basics-head">Basics</small>${svg}${basic}${skills}</div>`
}
