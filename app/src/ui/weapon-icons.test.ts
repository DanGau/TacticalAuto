import { expect, test } from 'vitest'
import { WEAPONS, type WeaponId } from '../core/weapons'
import { WEAPON_ICONS } from './weapon-icons'

test('every weapon has an icon of its own', () => {
  const icons = (Object.keys(WEAPONS) as WeaponId[]).map((id) => WEAPON_ICONS[id])
  expect(icons.every(Boolean)).toBe(true)
  expect(new Set(icons).size).toBe(icons.length)
})
