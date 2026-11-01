import { expect, test } from 'vitest'
import { tangles } from '../core/plane'
import { apply } from '../core/apply'
import { LEG_STOPS } from '../core/progress'
import { createRun, KEYS, legOf, ways } from '../core/run'
import { type Run } from '../core/run-state'
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

/** Every stop the player can tap, as the screen shows it, away from the page's edges, the header and squad strip above, and the stop's card below. */
function outOfReach(run: Run, w: number, h: number): string[] {
  const { pins, focus } = flight(run, null)
  const { placed } = layout(flightSize(w, h), run, pins, focus)
  return pins
    .filter((pin) => pin.choice)
    .filter((pin) => {
      const p = placed.get(pin.id)!
      return !p.front || p.x < TAP || p.x > w - TAP || p.y < CHROME_TOP + TAP || p.y > h - TAP
    })
    .map((pin) => `stop ${pin.id} out of reach at ${Math.round(placed.get(pin.id)!.x)},${Math.round(placed.get(pin.id)!.y)}`)
}

/** A stop's button reaches this far from its middle, and the header and squad strip this far down the page. */
const TAP = 24
const CHROME_TOP = 90
const CLEAR = 22
const ROOM = 50
const SEEDS = 30
const SCREENS = [[1280, 800], [1920, 1080], [768, 1024], [600, 1298], [600, 1067], [844, 390]]

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

test('every stop the player can take next is on screen and clear to tap, at every stop of every leg, the source too', () => {
  const found: string[] = []
  let source = 0
  for (let seed = 0; seed < 60; seed++) {
    const run = createRun(seed)
    apply(run, { type: 'recruit', index: seed % run.recruits.length })
    for (let key = 0; key <= KEYS; key++) {
      run.keys = key
      run.stop = 0
      for (let stop = 0; stop < legOf(run).columns.length; stop++) {
        for (const here of ['choosing', 'there']) {
          source += key === KEYS && here === 'choosing' ? 1 : 0
          for (const [w, h] of SCREENS) found.push(...outOfReach(run, w, h).map((t) => `seed ${seed} leg ${key} stop ${stop} ${here} ${w}px: ${t}`))
          if (here === 'choosing') legOf(run).path.push(ways(run)[seed % ways(run).length])
        }
        run.stop++
      }
    }
  }
  expect(source).toBe(60)
  expect(found).toEqual([])
})

test('the tunnel, taken at every stop of every leg, leaves the squad at its last stop, trails to every way out, and a map that reads and plays to the leg end', () => {
  const found: string[] = []
  for (let seed = 0; seed < SEEDS; seed += 5) {
    for (let key = 0; key < KEYS; key++) {
      for (let at = 0; at + 2 < LEG_STOPS; at++) {
        const run = createRun(seed)
        apply(run, { type: 'recruit', index: seed % run.recruits.length })
        run.keys = key
        for (let c = 0; c <= at; c++) {
          legOf(run).path.push(ways(run)[0])
          if (c < at) run.stop++
        }
        run.phase = 'event'
        run.event = 'tunnel'
        const label = `seed ${seed} leg ${key} tunnel at ${at}`
        const taken = apply(run, { type: 'choose', index: 0 })
        if (!taken.ok) found.push(`${label}: ${taken.reason}`)
        const { pins, focus } = flight(run, null)
        const squad = pins.filter((pin) => pin.squad)
        const stood = `${key}-${at}-${legOf(run).path[at]}`
        if (squad.length !== 1 || squad[0].id !== stood || squad[0].at !== focus) found.push(`${label}: squad not at ${stood}`)
        if (squad[0].next.join() !== ways(run).map((i) => `${key}-${at + 3}-${i}`).join()) found.push(`${label}: no trails to the ways out`)
        for (const [w, h] of [[1280, 800], [390, 844]]) found.push(...tangled(run, w, h).map((t) => `${label} ${w}px: ${t}`))
        while (run.stop < legOf(run).columns.length) {
          const open = ways(run)
          if (open.length === 0) found.push(`${label}: stuck at column ${run.stop}`)
          legOf(run).path.push(open[seed % open.length])
          for (const [w, h] of [[1280, 800], [390, 844]]) found.push(...tangled(run, w, h).map((t) => `${label} column ${run.stop} ${w}px: ${t}`))
          run.stop++
        }
      }
    }
  }
  expect(found).toEqual([])
})
