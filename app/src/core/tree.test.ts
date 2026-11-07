import { expect, test } from 'vitest'
import { CLASSES, type ClassId } from './classes'
import { begun } from './roads'
import { MAX_SKILLS, OFFERS, PICK_LEVELS, skillOffers, xpFor } from './squad'
import { SKILL_EFFECTS } from './skill-effects'
import { capstones, depthOf, locked, opensOf, pathOf, powerOf, SKILLS, TREES, treeOf, twinOf, unlocked, type SkillId } from './skills'

const classes = Object.keys(CLASSES) as ClassId[]
const veteran = (cls: ClassId, skills: SkillId[]) => ({ ...begun(1).soldiers[0], cls, skills, lost: [] as SkillId[], xp: xpFor(PICK_LEVELS.at(-1)!) })

test('every skill stands in one tree; each tree roots in its power, which teaches, and holds 3 paths and 23 to 27 skills', () => {
  const all = classes.flatMap(treeOf)
  expect(new Set(all).size).toBe(all.length)
  expect(new Set(all)).toEqual(new Set(Object.keys(SKILLS)))
  for (const cls of classes) {
    expect(TREES[cls].paths).toHaveLength(3)
    expect(treeOf(cls).length - 1).toBeGreaterThanOrEqual(23)
    expect(treeOf(cls).length - 1).toBeLessThanOrEqual(27)
    expect(SKILLS[powerOf(cls)].teaches).toBe(true)
    expect(unlocked(cls, [powerOf(cls)])).toEqual(treeOf(cls).filter((id) => TREES[cls].opens.includes(id)))
    for (const id of treeOf(cls)) for (const to of opensOf(cls, id)) expect(treeOf(cls)).toContain(to)
  }
})

test('no power no tree offers: every skill effect belongs to a skill of a tree', () => {
  const effects = new Set(classes.flatMap(treeOf).map((id) => SKILLS[id].effect))
  expect(SKILL_EFFECTS.filter((effect) => !effects.has(effect))).toEqual([])
})

test('each path ends in its capstone, within the picks a hero gets, and only its path opens it', () => {
  for (const cls of classes) {
    for (const path of TREES[cls].paths) {
      expect(depthOf(cls, path.capstone)).toBeLessThanOrEqual(PICK_LEVELS.length)
      expect(opensOf(cls, path.capstone)).toEqual([])
      for (const id of treeOf(cls).filter((k) => opensOf(cls, k).includes(path.capstone))) expect(pathOf(cls, id)).toBe(path)
    }
    for (const id of treeOf(cls)) expect(depthOf(cls, id)).toBeLessThan(Infinity)
  }
})

test('twins are siblings of one path, about half the forks are twins, and taking one locks the other for good', () => {
  for (const cls of classes) {
    const { twins } = TREES[cls]
    const forks = treeOf(cls).filter((id) => opensOf(cls, id).length > 1)
    expect(twins.length).toBeGreaterThanOrEqual(Math.floor(forks.length / 3))
    for (const [a, b] of twins) {
      expect(pathOf(cls, a)).toBe(pathOf(cls, b))
      expect(treeOf(cls).some((k) => opensOf(cls, k).includes(a) && opensOf(cls, k).includes(b))).toBe(true)
      expect(twinOf(cls, b)).toBe(a)
      expect(locked(cls, [powerOf(cls), a])).toContain(b)
      const known = [powerOf(cls), a]
      const hero = veteran(cls, known)
      expect(unlocked(cls, known)).not.toContain(b)
      expect(skillOffers(hero)).not.toContain(b)
    }
  }
})

test('a hero takes one capstone: the first locks the rest', () => {
  for (const cls of classes) {
    const [first, ...rest] = capstones(cls)
    expect(locked(cls, [powerOf(cls), first])).toEqual(expect.arrayContaining(rest))
    const hero = veteran(cls, [powerOf(cls), first])
    hero.lost = treeOf(cls).filter((id) => !capstones(cls).includes(id) && id !== powerOf(cls))
    expect(skillOffers(hero)).toEqual([])
  }
})

/** Plays every pick of a hero of `cls` on `seed`, taking offer `choose` picks; returns each pick's offers. */
function build(cls: ClassId, seed: number, choose: (offers: SkillId[]) => number) {
  const hero = { ...veteran(cls, [powerOf(cls)]), seed }
  const picks: { offers: SkillId[]; left: number; onward: SkillId[] }[] = []
  for (let offers = skillOffers(hero); offers.length > 0; offers = skillOffers(hero)) {
    const shut = locked(cls, hero.skills)
    picks.push({ offers, left: treeOf(cls).filter((id) => !hero.skills.includes(id) && !hero.lost.includes(id) && !shut.includes(id) && (!capstones(cls).includes(id) || unlocked(cls, hero.skills).includes(id))).length, onward: unlocked(cls, hero.skills).filter((id) => !hero.lost.includes(id) && opensOf(cls, hero.skills.at(-1)!).includes(id)) })
    const i = choose(offers)
    hero.lost.push(...offers.filter((_, j) => j !== i))
    hero.skills.push(offers[i])
  }
  return { hero, picks }
}

test('a hero starts with its class power free, and each of its picks offers 3 or 4 skills while that many are left, none known, lost or locked, never one turned down', () => {
  for (const cls of classes) {
    for (let seed = 0; seed < 80; seed++) {
      const { hero, picks } = build(cls, seed * 7919, (offers) => seed % offers.length)
      expect(hero.skills[0]).toBe(powerOf(cls))
      expect(picks).toHaveLength(PICK_LEVELS.length)
      expect(hero.skills.filter((id) => capstones(cls).includes(id)).length).toBeLessThanOrEqual(1)
      for (const [a, b] of TREES[cls].twins) expect(hero.skills.includes(a) && hero.skills.includes(b)).toBe(false)
      const seen = new Set<SkillId>()
      for (const { offers, left } of picks) {
        expect(offers.length).toBeGreaterThanOrEqual(Math.min(OFFERS.min, left))
        expect(offers.length).toBeLessThanOrEqual(OFFERS.max)
        for (const id of offers) {
          expect(seen.has(id)).toBe(false)
          seen.add(id)
        }
      }
    }
  }
})

test('on any seed, a hero climbing a path reaches its capstone by the last pick', () => {
  for (const cls of classes) {
    for (const path of TREES[cls].paths) {
      for (let seed = 0; seed < 40; seed++) {
        const climb = (offers: SkillId[]) => {
          const on = offers.filter((id) => pathOf(cls, id) === path)
          const deep = (id: SkillId) => (id === path.capstone ? 9 : depthOf(cls, id))
          return on.length > 0 ? offers.indexOf(on.reduce((a, b) => (deep(b) > deep(a) ? b : a))) : 0
        }
        expect(build(cls, seed * 6151, climb).hero.skills).toContain(path.capstone)
      }
    }
  }
})

test('offers differ from seed to seed', () => {
  for (const cls of classes) expect(new Set(Array.from({ length: 20 }, (_, seed) => build(cls, seed * 104729, () => 0).picks.map((p) => p.offers.join()).join())).size).toBeGreaterThan(5)
})

test('a hero choosing by one taste builds differently from seed to seed, and each pick offers one its latest opened while one is left', () => {
  for (const cls of classes) {
    const builds = Array.from({ length: 20 }, (_, seed) => build(cls, seed * 104729, (offers) => offers.indexOf([...offers].sort()[0])))
    expect(new Set(builds.map(({ hero }) => hero.skills.join())).size).toBeGreaterThanOrEqual(5)
    for (const { offers, onward } of builds.flatMap((b) => b.picks)) if (onward.length > 0) expect(offers.some((id) => onward.includes(id))).toBe(true)
  }
})

test('a hero with nothing left to learn is owed nothing, so the reward phase cannot stall', () => {
  for (const cls of classes) {
    const all = treeOf(cls)
    expect(unlocked(cls, all)).toEqual([])
    expect(skillOffers(veteran(cls, all))).toEqual([])
    expect(treeOf(cls).length).toBeGreaterThan(MAX_SKILLS)
  }
})
