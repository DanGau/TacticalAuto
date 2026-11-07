import { expect, test } from 'vitest'
import { CLASSES, type ClassId } from './classes'
import { begun } from './roads'
import { PICK_LEVELS, skillOffers, xpFor } from './squad'
import { SKILL_EFFECTS, ULTIMATE_EFFECTS } from './skill-effects'
import { capstones, pathOf, powerOf, SKILLS, TREES, treeOf, type SkillId } from './skills'

const classes = Object.keys(CLASSES) as ClassId[]
const veteran = (cls: ClassId, skills: SkillId[]) => ({ ...begun(1).soldiers[0], cls, skills, lost: [] as SkillId[], xp: xpFor(PICK_LEVELS.at(-1)!) })

test('every skill stands in one tree; each tree roots in its power, which teaches, then 3 paths of an entry and a row of 3 for each later pick', () => {
  const all = classes.flatMap(treeOf)
  expect(new Set(all).size).toBe(all.length)
  expect(new Set(all)).toEqual(new Set(Object.keys(SKILLS)))
  for (const cls of classes) {
    expect(SKILLS[powerOf(cls)].teaches).toBe(true)
    expect(TREES[cls].paths).toHaveLength(3)
    for (const path of TREES[cls].paths) expect(path.rows.map((r) => r.length)).toEqual([1, ...PICK_LEVELS.slice(1).map(() => 3)])
  }
})

test('no power no tree offers: every skill effect belongs to a skill of a tree, and every ultimate is a capstone', () => {
  const effects = new Set(classes.flatMap(treeOf).map((id) => SKILLS[id].effect))
  expect(SKILL_EFFECTS.filter((effect) => !effects.has(effect))).toEqual([])
  const caps = new Set(classes.flatMap(capstones).map((id) => SKILLS[id].effect))
  expect(ULTIMATE_EFFECTS.filter((effect) => !caps.has(effect))).toEqual([])
})

/** Plays every pick of a hero of `cls`, taking offer `choose` picks; returns each pick's offers. */
function build(cls: ClassId, choose: (offers: SkillId[], pick: number) => number) {
  const hero = veteran(cls, [powerOf(cls)])
  const picks: SkillId[][] = []
  for (let offers = skillOffers(hero); offers.length > 0; offers = skillOffers(hero)) {
    picks.push(offers)
    const i = choose(offers, picks.length - 1)
    hero.lost.push(...offers.filter((_, j) => j !== i))
    hero.skills.push(offers[i])
  }
  return { hero, picks }
}

test('the first pick offers each path its entry; each later pick, 3 of the path taken, none known or lost; every choice leads to a full build', () => {
  for (const cls of classes) {
    for (let code = 0; code < 3 ** PICK_LEVELS.length; code++) {
      const { hero, picks } = build(cls, (_, pick) => Math.floor(code / 3 ** pick) % 3)
      expect(hero.skills[0]).toBe(powerOf(cls))
      expect(picks).toHaveLength(PICK_LEVELS.length)
      expect(picks[0]).toEqual(TREES[cls].paths.map((p) => p.rows[0][0]))
      const path = pathOf(cls, hero.skills[1])!
      for (const [i, offers] of picks.slice(1).entries()) {
        expect(offers).toHaveLength(3)
        expect(offers).toEqual(path.rows[i + 1])
      }
      expect(new Set(picks.flat()).size).toBe(picks.flat().length)
      expect(hero.skills.slice(1).every((id) => pathOf(cls, id) === path)).toBe(true)
      expect(capstones(cls)).toContain(hero.skills.at(-1))
      expect(skillOffers(hero)).toEqual([])
    }
  }
})
