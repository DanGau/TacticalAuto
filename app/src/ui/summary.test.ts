import { expect, test } from 'vitest'
import { bots } from '../bots/bots'
import { apply } from '../core/apply'
import { createRun } from '../core/run'
import { step } from '../core/step'
import { battlePage, runSummary } from './summary'

test('a whole run ends in a summary of its heroes and every battle, each battle with a page, and no accuracy', () => {
  const run = createRun(5)
  const rng = { rng: 5 }
  let battles = 0
  while (run.phase !== 'won' && run.phase !== 'lost') {
    if (run.phase === 'battle' && run.battle!.phase === 'battle') {
      if (step(run).some((e) => e.type === 'end')) battles++
    } else apply(run, bots.strategic(run, rng))
  }
  expect(run.log.length).toBe(battles)
  const end = runSummary(run)
  for (const hero of run.soldiers) expect(end).toContain(hero.name)
  expect(end).toContain(run.phase === 'won' ? 'Earth is saved' : 'Ended by')
  expect((end.match(/<li /g) ?? []).length).toBe(battles)
  const page = battlePage(run.log[0])
  expect(page).toContain('Tanked')
  expect(page).toContain('Squad')
  expect(`${end}${page}`).not.toMatch(/accuracy/i)
})
