import { expect, test } from 'vitest'
import { CLASSES, type ClassId } from '../core/classes'
import { SECONDARIES, type SecondaryId } from '../core/secondaries'
import { SKILLS, type SkillId } from '../core/skills'
import { ULTIMATE_EFFECTS } from '../core/skill-effects'
import { BONUS_ICONS, KIT_ICONS, ULTIMATE_ICONS } from './ability-icons'

test('every ability has an icon of its own: class kits, ultimates and bonus attacks', () => {
  const ultimates = (Object.keys(SKILLS) as SkillId[]).filter((id) => (ULTIMATE_EFFECTS as readonly string[]).includes(SKILLS[id].effect ?? ''))
  expect(Object.keys(ULTIMATE_ICONS).sort()).toEqual([...ultimates].sort())
  const icons = [
    ...(Object.keys(CLASSES) as ClassId[]).map((id) => KIT_ICONS[id]),
    ...ultimates.map((id) => ULTIMATE_ICONS[id]),
    ...(Object.keys(SECONDARIES) as SecondaryId[]).map((id) => BONUS_ICONS[id]),
  ]
  expect(icons.every(Boolean)).toBe(true)
  expect(new Set(icons).size).toBe(icons.length)
})
