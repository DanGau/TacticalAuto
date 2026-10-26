import { buildSync } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import type { DoctrineId } from '../core/doctrines'
import type { TUNING } from '../core/tuning'

export type Tuning = typeof TUNING

/**
 * worker.ts bundled once into plain JavaScript, so worker threads load it without tsx: no transpiling on start, and no
 * name-keeping wrappers around every function call.
 */
const BUNDLE = (() => {
  const out = join(mkdtempSync(join(tmpdir(), 'sim-')), 'worker.mjs')
  buildSync({ entryPoints: [fileURLToPath(new URL('./worker.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' })
  return out
})()

/** Heap each worker may use, in MB. */
const WORKER_HEAP_MB = 512

/** Each bot's win rate over `runs` seeds from `start`, with `tuning` in place and the squad holding `doctrines` from the start, played on `threads` worker threads. */
export async function winRates(bots: string[], runs: number, start: number, tuning: Tuning, threads = availableParallelism() - 1, doctrines: DoctrineId[] = []): Promise<Record<string, number>> {
  const jobs = bots.flatMap((bot) => Array.from({ length: runs }, (_, i) => ({ bot, seed: start + i })))
  const slices = Array.from({ length: Math.max(1, threads) }, (_, t) => jobs.filter((_, i) => i % Math.max(1, threads) === t)).filter((slice) => slice.length > 0)
  const done = await Promise.all(
    slices.map(
      (slice) =>
        new Promise<{ bot: string; won: boolean }[]>((resolve, reject) => {
          // A capped heap fails one worker loudly instead of starving the machine until some process crashes.
          const worker = new Worker(BUNDLE, { workerData: { tuning, jobs: slice, doctrines }, resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB } })
          worker.once('message', resolve)
          worker.once('error', reject)
          worker.once('exit', (code) => reject(new Error(`sim worker exited with code ${code} before reporting`)))
        }),
    ),
  )
  const won = done.flat()
  return Object.fromEntries(bots.map((bot) => [bot, won.filter((r) => r.bot === bot && r.won).length / runs]))
}
