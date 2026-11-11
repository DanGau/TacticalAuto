import { expect, test } from 'vitest'
import { begun } from '../core/roads'
import { skillOffers, xpFor, PICK_LEVELS } from '../core/squad'
import { powerOf, SKILLS, TREES } from '../core/skills'
import { rule, skillState, treeMap, treeView } from './tree'

const recruit = () => ({ ...begun(1).soldiers[0], xp: xpFor(PICK_LEVELS[1]) })

test('each skill shows its state: the power taken, the offers pickable, the turned down lost, the paths not taken locked', () => {
  const hero = recruit()
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
})

test('before the first pick, the tree shows each path by its entry and capstones, its rows between unnamed', () => {
  const hero = recruit()
  const { paths } = TREES[hero.cls!]
  expect(treeView(hero).kind).toBe('choose')
  const shown = treeMap(hero).split('<details')[0]
  for (const p of paths) {
    expect(shown).toContain(SKILLS[p.rows[0][0]].name)
    for (const id of p.rows.at(-1)!) expect(shown).toContain(SKILLS[id].name)
    for (const row of p.rows.slice(1, -1)) for (const id of row) expect(shown).not.toContain(`>${SKILLS[id].name}<`)
  }
  expect(shown.match(/class="toffer"/g)).toHaveLength(paths.length)
})

test('once committed, the tree shows the taken path, the offer in full, the next row by name, and the other paths closed', () => {
  const hero = { ...recruit(), xp: xpFor(PICK_LEVELS[2]) }
  const [path, ...others] = TREES[hero.cls!].paths
  hero.skills = [...hero.skills, path.rows[0][0]]
  expect(treeView(hero)).toMatchObject({ kind: 'path', path, offer: path.rows[1], next: path.rows[2], closed: others.map((p) => p.name) })
  const shown = treeMap(hero).split('<details')[0]
  expect(shown.match(/class="toffer"/g)).toHaveLength(3)
  for (const id of path.rows[3]) expect(shown).not.toContain(SKILLS[id].name)
  expect(shown).toContain(`${others.map((p) => p.name).join(', ')}: closed`)
  expect(treeMap(hero)).toContain(SKILLS[path.rows[3][0]].name)
})
