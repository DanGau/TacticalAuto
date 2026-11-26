import { expect, test } from 'vitest'
import { CARD_IDS } from '../core/cards'
import { cardIcon, CARD_ICONS } from './card-icons'

test('every card has an icon, and those of their own are each different', () => {
  expect(CARD_IDS.every((id) => cardIcon(id).includes('<path') || cardIcon(id).includes('<circle') || cardIcon(id).includes('<rect'))).toBe(true)
  const own = Object.values(CARD_ICONS)
  expect(new Set(own).size).toBe(own.length)
})
