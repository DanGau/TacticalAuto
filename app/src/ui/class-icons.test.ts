import { expect, test } from 'vitest'
import { CLASSES, type ClassId } from '../core/classes'
import { CLASS_ICONS } from './class-icons'

test('every class has an icon of its own', () => {
  const icons = (Object.keys(CLASSES) as ClassId[]).map((id) => CLASS_ICONS[id])
  expect(icons.every(Boolean)).toBe(true)
  expect(new Set(icons).size).toBe(icons.length)
})
