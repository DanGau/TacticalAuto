import { expect, test } from 'vitest'
import { CLASSES, type ClassId } from '../core/classes'
import { begun } from '../core/roads'
import { skillOffers, xpFor, PICK_LEVELS } from '../core/squad'
import { capstones, powerOf, TREES, treeOf } from '../core/skills'
import { MAP, rule, skillState, treeLayout, treeMap } from './tree'

const classes = Object.keys(CLASSES) as ClassId[]

test('the map places every skill once in its path column, links each row to the whole next, downward, capstones on the last row, and no two nodes overlap', () => {
  for (const cls of classes) {
    const { nodes, links, height } = treeLayout(cls)
    const at = new Map(nodes.map((n) => [n.id, n]))
    expect(nodes.map((n) => n.id).sort()).toEqual([...treeOf(cls)].sort())
    expect(links).toHaveLength(TREES[cls].paths.length * (1 + 3 + 9 * (PICK_LEVELS.length - 2)))
    for (const { from, to } of links) expect(at.get(to)!.y).toBeGreaterThan(at.get(from)!.y)
    const bottom = Math.max(...nodes.map((n) => n.y))
    for (const id of capstones(cls)) expect(at.get(id)!.y).toBeGreaterThan(bottom - MAP.row * 2)
    for (const a of nodes) {
      expect(a.x - MAP.node.w / 2).toBeGreaterThanOrEqual(0)
      expect(a.x + MAP.node.w / 2).toBeLessThanOrEqual(MAP.width)
      expect(a.y + MAP.node.h / 2).toBeLessThanOrEqual(height)
      for (const b of nodes) if (a !== b) expect(Math.abs(a.x - b.x) >= MAP.node.w || Math.abs(a.y - b.y) >= MAP.node.h).toBe(true)
    }
  }
})

test('each node shows its state: the power taken, the offers pickable, the turned down lost, the paths not taken locked', () => {
  const hero = { ...begun(1).soldiers[0], xp: xpFor(PICK_LEVELS[1]) }
  const cls = hero.cls!
  expect(skillState(hero, powerOf(cls))).toBe('taken')
  const entries = skillOffers(hero)
  for (const id of entries) expect(skillState(hero, id)).toBe('offered')
  expect(skillState(hero, TREES[cls].paths[0].rows[1][0])).toBe('open')
  hero.skills.push(entries[0])
  hero.lost.push(...entries.slice(1))
  expect(skillState(hero, entries[1])).toBe('lost')
  expect(skillState(hero, TREES[cls].paths[1].rows[2][0])).toBe('locked')
  expect(rule(hero, TREES[cls].paths[1].rows[2][0])).toMatch(/^Locked/)
  const html = treeMap(hero)
  expect(html.match(/class="tree-node /g)).toHaveLength(treeOf(cls).length + 3)
  expect(html.match(/tree-node [^"]*offered"/g)).toHaveLength(3)
  expect(html.match(/tree-node cap /g)).toHaveLength(capstones(cls).length)
  expect(html.match(/class="head shut"/g)).toHaveLength(2)
})
