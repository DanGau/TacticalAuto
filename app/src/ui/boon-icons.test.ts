import { expect, test } from 'vitest'
import { UTILITY_IDS } from '../core/utilities'
import { BOON_ICONS } from './boon-icons'

test('every boon has an icon of its own', () => {
  const icons = UTILITY_IDS.map((id) => BOON_ICONS[id])
  expect(icons.every(Boolean)).toBe(true)
  expect(new Set(icons).size).toBe(icons.length)
})
