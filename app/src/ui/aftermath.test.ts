import { expect, test } from 'vitest'
import type { Report } from '../core/run'
import { battleStats } from './aftermath'

test("the debrief's stats give a row per soldier and mark the squad's best", () => {
  const soldier = (name: string, dealt: number, shots: number, hits: number): Report['soldiers'][number] => ({ id: 0, name, cls: null, xpBefore: 0, xpAfter: 0, taken: false, earned: [], feats: [], hp: 5, maxHp: 5, tally: { dealt, kills: 1, taken: 2, shots, hits, feats: [] } })
  const html = battleStats({ soldiers: [soldier('Ada', 9, 4, 3), soldier('Bo', 4, 0, 0)] } as unknown as Report)
  expect(html.match(/<tr>/g)).toHaveLength(3)
  expect(html).toContain('<td class="best">9</td>')
  expect(html).toContain('<td class="best">75%</td>')
  expect(html).toContain('<td class="">0%</td>')
})
