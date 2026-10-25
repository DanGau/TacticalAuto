import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'
import type { TUNING } from '../core/tuning'

export type Tuning = typeof TUNING

/** Starts a worker on worker.ts: a worker thread does not inherit tsx, so it registers tsx itself first. */
const BOOT = `import(${JSON.stringify(import.meta.resolve('tsx/esm/api'))}).then((tsx) => { tsx.register(); return import(${JSON.stringify(new URL('./worker.ts', import.meta.url).href)}) })`

/** Each bot's win rate over `runs` seeds from `start`, with `tuning` in place, played on `threads` worker threads. */
export async function winRates(bots: string[], runs: number, start: number, tuning: Tuning, threads = availableParallelism() - 1): Promise<Record<string, number>> {
  const jobs = bots.flatMap((bot) => Array.from({ length: runs }, (_, i) => ({ bot, seed: start + i })))
  const slices = Array.from({ length: Math.max(1, threads) }, (_, t) => jobs.filter((_, i) => i % Math.max(1, threads) === t)).filter((slice) => slice.length > 0)
  const done = await Promise.all(
    slices.map(
      (slice) =>
        new Promise<{ bot: string; won: boolean }[]>((resolve, reject) => {
          const worker = new Worker(BOOT, { eval: true, workerData: { tuning, jobs: slice } })
          worker.once('message', resolve)
          worker.once('error', reject)
        }),
    ),
  )
  const won = done.flat()
  return Object.fromEntries(bots.map((bot) => [bot, won.filter((r) => r.bot === bot && r.won).length / runs]))
}
