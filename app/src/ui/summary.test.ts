import { expect, test } from 'vitest'
import { bots } from '../bots/bots'
import { apply } from '../core/apply'
import { createRun } from '../core/run'
import { step } from '../core/step'
import { scale } from './charts'
import { battleColumns, battlePage, colours, heroMarks, runSummary } from './summary'

function playedRun() {
  const run = createRun(5)
  const rng = { rng: 5 }
  let battles = 0
  while (run.phase !== 'won' && run.phase !== 'lost') {
    if (run.phase === 'battle' && run.battle!.phase === 'battle') {
      if (step(run).some((e) => e.type === 'end')) battles++
    } else apply(run, bots.strategic(run, rng))
  }
  return { run, battles }
}

test('a whole run ends in a summary of its heroes and a column per battle, each battle with a page, and no accuracy', () => {
  const { run, battles } = playedRun()
  expect(run.log.length).toBe(battles)
  const end = runSummary(run)
  for (const hero of run.soldiers) expect(end).toContain(hero.name)
  expect(end).toContain(run.phase === 'won' ? 'Earth is saved' : 'Ended by')
  expect((end.match(/class="col /g) ?? []).length).toBe(battles)
  const page = battlePage(run, run.log[0])
  expect(page).toContain('Tanked')
  expect(`${end}${page}`).not.toMatch(/accuracy/i)
}, 120_000)

test('scale is a percent of the largest or of the sum, and 0 for nothing', () => {
  expect(scale([2, 4])).toEqual([50, 100])
  expect(scale([1, 3], 'sum')).toEqual([25, 75])
  expect(scale([0, 0], 'sum')).toEqual([0, 0])
})

test('a hero keeps one colour, and each mark and column tells its exact numbers', () => {
  const { run } = playedRun()
  const colour = colours(run)
  const fought = run.log[0]
  const [damage, tanked] = heroMarks(fought.soldiers, colour)
  fought.soldiers.forEach((s, i) => {
    expect(damage.marks[i].value).toBe(s.tally.dealt)
    expect(damage.marks[i].colour).toBe(colour.get(s.name))
    expect(tanked.marks[i].tip.join(' ')).toContain(`${s.tally.taken} to health, ${s.tally.blocked} to armor`)
  })
  const cols = battleColumns(run)
  run.log.forEach((f, i) => {
    expect(cols[i].up.map((m) => m.value)).toEqual(f.soldiers.map((s) => s.tally.dealt))
    expect(cols[i].down).toBe(f.soldiers.reduce((sum, s) => sum + s.tally.taken + s.tally.blocked, 0))
    expect(cols[i].tip[0]).toContain(f.won ? 'won' : 'lost')
  })
})
