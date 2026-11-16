import { expect, test } from 'vitest'
import { PERKS, type PerkId } from '../core/perks'
import { SKILLS, TREES, type SkillId } from '../core/skills'
import { ULTIMATE_EFFECTS } from '../core/skill-effects'
import { PERK_ICONS, SKILL_ICONS } from './skill-icons'

const unique = (icons: (string | undefined)[]) => {
  expect(icons.every(Boolean)).toBe(true)
  expect(new Set(icons).size).toBe(icons.length)
}

test('every skill but the abilities has an icon of its own, and no ability has one', () => {
  const powers = new Set(Object.values(TREES).map((t) => t.power))
  const plain = (Object.keys(SKILLS) as SkillId[]).filter((id) => !powers.has(id) && !(ULTIMATE_EFFECTS as readonly string[]).includes(SKILLS[id].effect ?? ''))
  expect(Object.keys(SKILL_ICONS).sort()).toEqual([...plain].sort())
  unique(plain.map((id) => SKILL_ICONS[id]))
})

test('every perk has an icon of its own', () => unique((Object.keys(PERKS) as PerkId[]).map((id) => PERK_ICONS[id])))
