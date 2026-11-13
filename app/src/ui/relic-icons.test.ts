import { expect, test } from 'vitest'
import { RELICS } from '../core/relics'
import { RELIC_ICONS } from './relic-icons'

test('every relic has an icon of its own', () => {
  const icons = Object.keys(RELICS).map((id) => RELIC_ICONS[id as keyof typeof RELICS])
  expect(icons.every(Boolean)).toBe(true)
  expect(new Set(icons).size).toBe(icons.length)
})
