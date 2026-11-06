import { expect, test } from 'vitest'
import { CLASSES, type ClassId } from '../core/classes'
import { begun } from '../core/roads'
import { skillOffers, xpFor, PICK_LEVELS } from '../core/squad'
import { TREES, treeOf, powerOf } from '../core/skills'
import { MAP, skillState, treeLayout, treeMap } from './tree'

const classes = Object.keys(CLASSES) as ClassId[]

test('the map places every skill once, links each to each of the tier below in its branch, and no two nodes overlap', () => {
  for (const cls of classes) {
    const { nodes, links, height } = treeLayout(cls)
    expect(nodes.map((n) => n.id).sort()).toEqual([...treeOf(cls)].sort())
    expect(links).toHaveLength(TREES[cls].reduce((sum, { tiers }) => sum + tiers.slice(1).reduce((s, t, i) => s + t.length * tiers[i].length, 0), 0))
    for (const a of nodes) {
      expect(a.x - MAP.node.w / 2).toBeGreaterThanOrEqual(0)
      expect(a.x + MAP.node.w / 2).toBeLessThanOrEqual(MAP.width)
      expect(a.y + MAP.node.h / 2).toBeLessThanOrEqual(height)
      for (const b of nodes) if (a !== b) expect(Math.abs(a.x - b.x) >= MAP.node.w || Math.abs(a.y - b.y) >= MAP.node.h).toBe(true)
    }
    for (const tier of [1, 2, 3]) expect(Math.min(...nodes.filter((n) => n.tier === tier).map((n) => n.y))).toBeGreaterThan(Math.max(...nodes.filter((n) => n.tier === tier - 1).map((n) => n.y)))
  }
})

test('each node shows its state: the power taken, the offers pickable, the turned down lost', () => {
  const hero = { ...begun(1).soldiers[0], xp: xpFor(PICK_LEVELS[0]) }
  const offers = skillOffers(hero)
  hero.lost = treeOf(hero.cls!).filter((id) => !offers.includes(id) && id !== powerOf(hero.cls!)).slice(0, 1)
  expect(skillState(hero, powerOf(hero.cls!))).toBe('taken')
  for (const id of skillOffers(hero)) expect(skillState(hero, id)).toBe('offered')
  expect(skillState(hero, hero.lost[0])).toBe('lost')
  const html = treeMap(hero)
  expect(html.match(/class="tree-node /g)).toHaveLength(treeOf(hero.cls!).length + 3)
  expect(html.match(/tree-node t\d offered/g)).toHaveLength(skillOffers(hero).length)
})
