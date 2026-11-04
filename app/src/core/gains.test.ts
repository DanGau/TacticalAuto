import { expect, test } from 'vitest'
import { bots } from '../bots/bots'
import { acquired } from '../ui/aftermath'
import { apply, type Action } from './apply'
import { EVENTS, type EventId } from './events'
import { RELICS } from './relics'
import { gainRelic } from './rewards'
import { createRun, legOf, ways, go } from './run'
import { step } from './step'
import type { Run } from './run-state'

/** A run met at `event`, holding a relic, its squad of one short of full. */
function atEvent(event: EventId): Run {
  const run = createRun(1)
  apply(run, { type: 'recruit', index: 0 })
  gainRelic(run, 'plasma', true)
  go(run, ways(run)[0])
  run.phase = 'event'
  run.event = event
  run.supplies = 20
  return run
}

/** Whether every relic and hero that came or went between `before` and `run`, unchosen, is told of. */
function untold(before: { relics: readonly string[]; soldiers: number[] }, run: Run): string[] {
  const told = run.gains
  const relic = (kind: string, id: string) => told.some((g) => g.kind === kind && 'id' in g && g.id === id)
  return [
    ...run.relics.filter((id) => !before.relics.includes(id) && !relic('relic', id)).map((id) => `gained ${id}`),
    ...before.relics.filter((id) => !run.relics.includes(id as never) && !relic('relicLost', id)).map((id) => `lost ${id}`),
    ...run.soldiers.filter((s) => !before.soldiers.includes(s.id) && !told.some((g) => g.kind === 'hero' && g.soldier === s.id)).map((s) => `hero ${s.name}`),
  ]
}

const held = (run: Run) => ({ relics: [...run.relics], soldiers: run.soldiers.map((s) => s.id) })

test('every event option tells of each relic and hero it adds or takes', () => {
  const found: string[] = []
  for (const id of Object.keys(EVENTS) as EventId[]) {
    EVENTS[id].options.forEach((_, index) => {
      const run = atEvent(id)
      const before = held(run)
      if (apply(run, { type: 'choose', index }).ok) found.push(...untold(before, run).map((t) => `${id} ${index}: ${t}`))
    })
  }
  expect(found).toEqual([])
})

test('in whole bot runs, only a relic chosen from a card goes untold', () => {
  const found: string[] = []
  for (let seed = 0; seed < 8; seed++) {
    const run = createRun(seed)
    const rng = { rng: seed }
    while (run.phase !== 'won' && run.phase !== 'lost') {
      if (run.phase === 'battle' && run.battle!.phase === 'battle') {
        const before = held(run)
        step(run)
        // A hero met at the leg's end shows on the battle report.
        found.push(...untold(before, run).filter((t) => !run.report?.hired || t !== `hero ${run.report.hired}`))
        continue
      }
      const action: Action = bots.strategic(run, rng)
      const before = held(run)
      expect(apply(run, action).ok).toBe(true)
      // A card read and chosen, or the first hero, or a hero met at the leg's end, has a screen of its own.
      if (action.type !== 'relic' && action.type !== 'buy' && action.type !== 'recruit') found.push(...untold(before, run))
      run.gains.length = 0
    }
  }
  expect(found).toEqual([])
}, 90_000)

test('the screen names a relic and what it does; acknowledging clears it', () => {
  const run = atEvent('artifact')
  apply(run, { type: 'choose', index: 0 })
  const gain = run.gains[0]
  if (gain.kind !== 'relic') throw new Error('no relic told of')
  const html = acquired(run, gain)
  expect(html).toContain(RELICS[gain.id].name)
  expect(html).toContain('"ack"')
  expect(apply(run, { type: 'ack' }).ok).toBe(true)
  expect(run.gains).toEqual([])
  expect(legOf(run)).toBeTruthy()
})
