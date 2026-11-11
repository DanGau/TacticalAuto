// A class's skill tree, shown as far as the hero can see: the paths to choose from, or the chosen path's next steps; the whole tree behind a toggle.
import { usage } from '../core/powers'
import type { Soldier } from '../core/run-state'
import { PERKS } from '../core/perks'
import { committed, pathOf, powerOf, SKILLS, TREES, type Path, type SkillId } from '../core/skills'
import { skillOffers } from '../core/squad'
import { describe } from './html'
import { basicsOf, tag } from './kit'

/** Whether a hero knows a skill, is offered it now, turned it down for good, could be offered it later, or stands in a path it did not take. */
export type SkillState = 'taken' | 'offered' | 'lost' | 'open' | 'locked'

export function skillState(hero: Soldier, id: SkillId): SkillState {
  const took = committed(hero.cls!, hero.skills)
  return hero.skills.includes(id) ? 'taken' : skillOffers(hero).includes(id) ? 'offered' : hero.lost.includes(id) ? 'lost' : took && pathOf(hero.cls!, id) !== took ? 'locked' : 'open'
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

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/** A skill's name as a chip, its use and text in its tip. */
export const chip = (hero: Soldier, id: SkillId) => {
  const skill = SKILLS[id]
  return `<span class="tchip ${skillState(hero, id)}" tabindex="0" data-tip="${attr(`${skill.name} · ${usage(skill)}: ${skill.text}. ${rule(hero, id)}.`)}">${skill.name}</span>`
}

/** An offered skill in full, for the sheet: name, use and text. */
const offerCard = (id: SkillId, held?: Parameters<typeof describe>[2]) =>
  `<div class="toffer"><b>${SKILLS[id].name}</b><small class="use">${usage(SKILLS[id])}</small><span>${describe(SKILLS[id].text, SKILLS[id].tags, held)}</span></div>`

/** Depth still ahead, as faint ticks. */
const ticks = (n: number) => `<span class="tticks" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`

/** What a hero can see of its tree: before its first pick, each path's entry; after, its path's taken, offered and next rows, the rest hidden. */
export type TreeView = { kind: 'choose'; paths: Path[] } | { kind: 'path'; path: Path; taken: SkillId[][]; offer: SkillId[] | null; next: SkillId[] | null; closed: string[] }

export function treeView(hero: Soldier): TreeView {
  const { paths } = TREES[hero.cls!]
  const path = committed(hero.cls!, hero.skills)
  if (!path) return { kind: 'choose', paths }
  const done = path.rows.filter((row) => row.some((id) => hero.skills.includes(id))).length
  const offer = skillOffers(hero).length > 0 ? path.rows[done] : null
  const next = path.rows[offer ? done + 1 : done] ?? null
  return { kind: 'path', path, taken: path.rows.slice(0, done), offer, next, closed: paths.filter((p) => p !== path).map((p) => p.name) }
}

/** The whole tree, every row of every path as chips. */
function fullTree(hero: Soldier): string {
  const col = (p: Path) => `<div class="tcol"><b class="thead">${p.name}</b>${p.rows.map((row) => `<div class="trow">${row.map((id) => chip(hero, id)).join('')}</div>`).join('')}</div>`
  return `<details class="tfull"><summary>Full tree</summary><div class="tcols">${TREES[hero.cls!].paths.map(col).join('')}</div></details>`
}

/** A hero's tree as far as it can see; `offer` draws each offered skill, by default in full. */
export function treeMap(hero: Soldier, offer?: (id: SkillId) => string, held?: Parameters<typeof describe>[2]): string {
  const cls = hero.cls!
  const draw = offer ?? ((id: SkillId) => offerCard(id, held))
  const basics = [...basicsOf(hero).map((name) => tag('basic', name)), ...hero.perks.map((id) => tag('perk', PERKS[id].name, PERKS[id].text))].map((t) => `<span class="basic-chip">${t}</span>`).join('')
  const head = `<div class="tbasics"><small>Basics</small>${basics}</div><div class="tpower">${chip(hero, powerOf(cls))}</div>`
  const view = treeView(hero)
  if (view.kind === 'choose') {
    const leads = (p: Path) => `<small class="tleads">→ ${p.rows.at(-1)!.map((id) => SKILLS[id].name).join(' · ')}</small>`
    const col = (p: Path) => {
      const entry = p.rows[0][0]
      return `<div class="tcol"><b class="thead">${p.name}</b>${skillState(hero, entry) === 'offered' ? draw(entry) : chip(hero, entry)}${ticks(p.rows.length - 1)}${leads(p)}</div>`
    }
    return `<div class="tree">${head}<small class="tnote">First pick chooses a path; the others close.</small><div class="tcols">${view.paths.map(col).join('')}</div>${fullTree(hero)}</div>`
  }
  const lost = (row: SkillId[]) => row.filter((id) => hero.lost.includes(id)).map((id) => `<s>${SKILLS[id].name}</s>`).join('')
  const done = view.taken.map((row) => `<div class="tdone">${row.filter((id) => hero.skills.includes(id)).map((id) => chip(hero, id)).join('')}${lost(row)}</div>`).join('')
  const offerRow = view.offer ? `<div class="toffers">${view.offer.map(draw).join('')}</div>` : ''
  const nextRow = view.next ? `<div class="tnext">${view.next.map((id) => chip(hero, id)).join('')}</div>` : ''
  const left = view.path.rows.length - view.taken.length - (view.offer ? 1 : 0) - (view.next ? 1 : 0)
  return `<div class="tree">${head}<div class="tpath"><b class="thead">${view.path.name}</b>${done}${offerRow}${nextRow}${left > 0 ? ticks(left) : ''}</div><small class="tclosed">${view.closed.join(', ')}: closed</small>${fullTree(hero)}</div>`
}
