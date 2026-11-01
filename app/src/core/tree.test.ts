import { expect, test } from 'vitest'
import { CLASSES, type ClassId } from './classes'
import { begun } from './roads'
import { MAX_SKILLS, skillOffers, xpFor } from './squad'
import { SKILL_EFFECTS } from './skill-effects'
import { CAPSTONE_PICKS, roots, SKILLS, TREES, unlocked, type SkillId } from './skills'

const classes = Object.keys(CLASSES) as ClassId[]
const veteran = (cls: ClassId, skills: SkillId[]) => ({ ...begun(1).soldiers[0], cls, skills, xp: xpFor(MAX_SKILLS + 1) })

test('every skill stands in one tree, every class has 2 or 3 branches of tiers 1 to 4, and each opens with a skill to take', () => {
  const all = classes.flatMap((cls) => TREES[cls].flatMap((b) => b.tiers.flat()))
  expect(new Set(all).size).toBe(all.length)
  expect(new Set(all)).toEqual(new Set(Object.keys(SKILLS)))
  for (const cls of classes) {
    expect(TREES[cls].length).toBeGreaterThanOrEqual(2)
    expect(TREES[cls].length).toBeLessThanOrEqual(3)
    for (const { tiers } of TREES[cls]) expect(tiers.map((t) => t.length > 0)).toEqual([true, true, true, true])
    expect(unlocked(cls, [])).toEqual(roots(cls))
    expect(SKILLS[roots(cls)[0]].name).toBe(CLASSES[cls].abilityName)
  }
})

test('no power no tree offers: every skill effect belongs to a skill, and every skill to a tree', () => {
  const offered = classes.flatMap((cls) => TREES[cls].flatMap((b) => b.tiers.flat()))
  const effects = new Set(offered.map((id) => SKILLS[id].effect))
  expect(SKILL_EFFECTS.filter((effect) => !effects.has(effect))).toEqual([])
})

test('tier locks hold: tier 2 needs a tier 1 of its branch, tier 3 a tier 2 and enough picks, tier 4 its tier 3', () => {
  for (const cls of classes) {
    for (const { tiers } of TREES[cls]) {
      const [low, mid, top, last] = tiers
      expect(unlocked(cls, [])).not.toContain(mid[0])
      expect(unlocked(cls, [low[0]])).toContain(mid[0])
      expect(unlocked(cls, [low[0]])).not.toContain(top[0])
      expect(unlocked(cls, [low[0], mid[0]]).includes(top[0])).toBe(CAPSTONE_PICKS <= 2)
      const three = [low[0], mid[0], roots(cls).find((id) => !low.includes(id))!]
      expect(unlocked(cls, three)).toContain(top[0])
      expect(unlocked(cls, three)).not.toContain(last[0])
      expect(unlocked(cls, [...three, top[0]])).toContain(last[0])
    }
  }
})

test("every skill of every class's tree can be reached, offers stay in the unlocked, and no level completes a tree", () => {
  for (const cls of classes) {
    for (const { tiers } of TREES[cls]) {
      const known: SkillId[] = [roots(cls).find((id) => !tiers[0].includes(id))!]
      for (const id of tiers.flat()) {
        expect(skillOffers(veteran(cls, known.slice(0, MAX_SKILLS - 1)))).toEqual(unlocked(cls, known.slice(0, MAX_SKILLS - 1)))
        expect(unlocked(cls, known)).toContain(id)
        known.push(id)
      }
    }
    expect(TREES[cls].flatMap((b) => b.tiers.flat()).length).toBeGreaterThan(MAX_SKILLS)
  }
})

test('a hero with nothing left to learn is owed nothing, so the reward phase cannot stall', () => {
  for (const cls of classes) {
    const all = TREES[cls].flatMap((b) => b.tiers.flat())
    expect(unlocked(cls, all)).toEqual([])
    expect(skillOffers(veteran(cls, all))).toEqual([])
  }
})
