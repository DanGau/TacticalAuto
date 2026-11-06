import { expect, test } from 'vitest'
import { placeCard } from './tip'

const rect = (left: number, top: number, w: number, h: number) => ({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRect
const screen = { w: 390, h: 844 }

test('a card goes below its mark, inside the screen', () => {
  expect(placeCard(rect(300, 100, 80, 16), 300, 150, null, screen)).toEqual([82, 122])
})

test('a card that would cover the kept card or leave the screen goes above', () => {
  expect(placeCard(rect(50, 760, 80, 16), 300, 150, rect(0, 0, 390, 300), screen)).toEqual([50, 604])
})
