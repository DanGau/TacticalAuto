import { expect, test } from 'vitest'
import { CARD_IDS } from '../core/cards'
import { CARD_ICONS } from './card-icons'

test('every card has an icon of its own', () => {
  const icons = CARD_IDS.map((id) => CARD_ICONS[id])
  expect(icons.every(Boolean)).toBe(true)
  expect(new Set(icons).size).toBe(icons.length)
})
