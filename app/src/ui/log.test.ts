import { expect, test } from 'vitest'
import { bots } from '../bots/bots'
import { apply } from '../core/apply'
import { createRun } from '../core/run'
import { step } from '../core/step'
import { learnNames, logLine, type Names } from './log'

test("a hero's shot logs as who, with what, how much and to whom; plain walks log nothing", () => {
  const run = createRun(3)
  const rng = { rng: 3 }
  while (run.phase !== 'battle' || run.battle!.phase !== 'battle') apply(run, bots.strategic(run, rng))
  const names: Names = new Map()
  const lines: string[] = []
  for (let i = 0; i < 200 && run.battle?.phase === 'battle'; i++) {
    learnNames(run, run.battle, names)
    const battle = run.battle
    for (const e of step(run)) {
      const line = logLine(run, battle, names, e)
      if (e.type === 'move' && e.src.kind === 'basic') expect(line).toBeNull()
      if (line && e.type === 'shot' && run.soldiers.some((s) => line.startsWith(s.name))) lines.push(line)
    }
  }
  expect(lines.length).toBeGreaterThan(0)
  expect(lines[0]).toMatch(/^\w+ · <span class="src"[^>]*>. [^<]+<\/span>.* · \d+ dmg( crit)? → \S/)
})
