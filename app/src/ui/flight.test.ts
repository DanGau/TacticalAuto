import { expect, test } from 'vitest'
import { tangles } from '../core/plane'
import { apply } from '../core/apply'
import { createRun, KEYS, legOf, ways, type Run } from '../core/run'
import { layout } from './globe'
import { flight, flightSize } from './overworld'

/** What makes the flight map, as the screen shows it, hard to read; a stop's trail may pass no nearer to another than CLEAR. */
function tangled(run: Run, w: number, h: number): string[] {
  const { pins, focus, path } = flight(run, null)
  const size = flightSize(w, h)
  const { placed, target } = layout(size, run, pins, focus)
  const shown = pins.filter((pin) => placed.get(pin.id)!.front)
  const index = new Map(shown.map((pin, i) => [pin.id, i]))
  const lines = shown.flatMap((pin) => pin.next.flatMap((id): [number, number][] => (index.has(id) ? [[index.get(pin.id)!, index.get(id)!]] : [])))
  // The way walked this leg runs through the stops taken.
  const walked = path.filter((id) => index.has(id))
  lines.push(...walked.slice(1).map((id, i): [number, number] => [index.get(walked[i])!, index.get(id)!]))
  // No stop on screen floats off the globe into space: each stands within its face.
  const centre = { x: size.w / 2, y: size.top + (size.h - size.top - size.bottom) / 2 }
  const off = shown
    .map((pin) => ({ pin, p: placed.get(pin.id)! }))
    .filter(({ p }) => p.x >= 0 && p.x <= size.w && p.y >= 0 && p.y <= size.h && Math.hypot(p.x - centre.x, p.y - centre.y) > target.r)
    .map(({ pin }) => `stop ${pin.id} off the globe`)
  return [...off, ...tangles(shown.map((pin) => placed.get(pin.id)!), lines, CLEAR, ROOM)]
}

const CLEAR = 22
const ROOM = 50
const SEEDS = 30

test('on the flight map, at every stop of every leg, trails never cross nor run through a stop, and stops stand apart', () => {
  const found: string[] = []
  const check = (run: Run, label: string) => {
    for (const [w, h] of [[1280, 800], [390, 844]]) found.push(...tangled(run, w, h).map((t) => `${label} ${w}px: ${t}`))
  }
  for (let seed = 0; seed < SEEDS; seed++) {
    const run = createRun(seed)
    apply(run, { type: 'recruit', index: seed % run.recruits.length })
    for (let key = 0; key < KEYS; key++) {
      for (let stop = 0; stop < legOf(run).columns.length; stop++) {
        check(run, `seed ${seed} leg ${key} stop ${stop} choosing`)
        const open = ways(run)
        legOf(run).path.push(open[seed % open.length])
        check(run, `seed ${seed} leg ${key} stop ${stop} there`)
        run.stop++
      }
      run.keys++
      run.stop = 0
    }
  }
  expect(found).toEqual([])
})
