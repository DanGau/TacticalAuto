import { expect, test } from 'vitest'
import { CLASSES, type ClassId } from '../core/classes'
import { begun } from '../core/roads'
import { skillOffers, xpFor, PICK_LEVELS } from '../core/squad'
import { capstones, opensOf, powerOf, TREES, treeOf } from '../core/skills'
import { MAP, rule, skillState, treeLayout, treeMap } from './tree'

const classes = Object.keys(CLASSES) as ClassId[]

test('the map places every skill once, links each to each it opens, downward, keeps twins side by side, capstones on the last row, and no two nodes overlap', () => {
  for (const cls of classes) {
    const { nodes, links, twins, height } = treeLayout(cls)
    const at = new Map(nodes.map((n) => [n.id, n]))
    expect(nodes.map((n) => n.id).sort()).toEqual([...treeOf(cls)].sort())
    expect(links).toHaveLength(treeOf(cls).reduce((sum, id) => sum + opensOf(cls, id).length, 0))
    for (const { from, to } of links) expect(at.get(to)!.y).toBeGreaterThan(at.get(from)!.y)
    for (const [a, b] of twins) {
      expect(at.get(a)!.y).toBe(at.get(b)!.y)
      expect(Math.abs(at.get(a)!.x - at.get(b)!.x)).toBeLessThan(2 * MAP.node.w)
    }
    const bottom = Math.max(...nodes.map((n) => n.y))
    for (const id of capstones(cls)) expect(at.get(id)!.y).toBe(bottom)
    for (const a of nodes) {
      expect(a.x - MAP.node.w / 2).toBeGreaterThanOrEqual(0)
      expect(a.x + MAP.node.w / 2).toBeLessThanOrEqual(MAP.width)
      expect(a.y + MAP.node.h / 2).toBeLessThanOrEqual(height)
      for (const b of nodes) if (a !== b) expect(Math.abs(a.x - b.x) >= MAP.node.w || Math.abs(a.y - b.y) >= MAP.node.h).toBe(true)
    }
  }
})

test('each node shows its state: the power taken, the offers pickable, the turned down lost, a taken twin locking its pair', () => {
  const hero = { ...begun(1).soldiers[0], xp: xpFor(PICK_LEVELS[0]) }
  const offers = skillOffers(hero)
  hero.lost = treeOf(hero.cls!).filter((id) => !offers.includes(id) && id !== powerOf(hero.cls!)).slice(0, 1)
  expect(skillState(hero, powerOf(hero.cls!))).toBe('taken')
  for (const id of skillOffers(hero)) expect(skillState(hero, id)).toBe('offered')
  expect(skillState(hero, hero.lost[0])).toBe('lost')
  const html = treeMap(hero)
  expect(html.match(/class="tree-node /g)).toHaveLength(treeOf(hero.cls!).length + 3)
  expect(html.match(/tree-node [^"]*offered"/g)).toHaveLength(skillOffers(hero).length)
  expect(html.match(/tree-node cap /g)).toHaveLength(3)
  expect(html.match(/class="twin/g)).toHaveLength(TREES[hero.cls!].twins.length)
  const [a, b] = TREES[hero.cls!].twins[0]
  const twinned = { ...hero, skills: [powerOf(hero.cls!), a], lost: [] }
  expect(skillState(twinned, b)).toBe('locked')
  expect(rule(twinned, b)).toMatch(/locked by/)
})
