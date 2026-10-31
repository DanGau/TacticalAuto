import { type ChildProcess, fork } from 'node:child_process'
import { buildSync } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { availableParallelism, freemem, tmpdir, totalmem } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DoctrineId } from '../core/doctrines'
import type { TUNING } from '../core/tuning'
import type { RunResult } from './run'

export type Tuning = typeof TUNING

/** worker.ts bundled once into plain JavaScript, so sim processes start without tsx. */
const BUNDLE = (() => {
  const out = join(mkdtempSync(join(tmpdir(), 'sim-')), 'worker.mjs')
  buildSync({ entryPoints: [fileURLToPath(new URL('./worker.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' })
  return out
})()

/** Heap each sim process may use, in MB. */
const HEAP_MB = 512
/** Most seeds sent to a process at a time: what a crash costs, and how often memory is checked. */
const BATCH = 10
/** Times a batch is retried on a fresh process before the run fails. */
const RETRIES = 3
/** Free system memory, in MB, below which the pool shrinks. */
const RESERVE_MB = 1024
/** How long, in ms, memory must stay calm after a shrink before the pool grows a process back. */
const CALM_MS = 10_000

const MB = 1024 * 1024
const log = (line: string) => console.error(`sim pool: ${line}`)

interface PoolOptions {
  threads?: number
  doctrines?: DoctrineId[]
  /** Memory, in MB, the sim processes together may hold before the pool shrinks. */
  memoryMb?: number
}

/** Each bot's win rate over `runs` seeds from `start`, with `tuning` in place. */
export async function winRates(bots: string[], runs: number, start: number, tuning: Tuning, options: PoolOptions = {}): Promise<Record<string, number>> {
  const played = await playAll(bots, runs, start, tuning, options)
  return Object.fromEntries(bots.map((bot) => [bot, played[bot].filter((r) => r.won).length / runs]))
}

/**
 * Each bot's runs, by seed, over `runs` seeds from `start`, with `tuning` in place, played on up to `threads` child
 * processes. Results come back without their actions.
 * Under memory pressure the pool retires processes down to one and grows back once it eases; a process that dies has
 * its batch retried on a fresh one.
 */
export async function playAll(bots: string[], runs: number, start: number, tuning: Tuning, options: PoolOptions = {}): Promise<Record<string, RunResult[]>> {
  const { threads = availableParallelism() - 1, doctrines = [], memoryMb = (totalmem() / MB) * 0.6 } = options
  const jobs = bots.flatMap((bot) => Array.from({ length: runs }, (_, i) => ({ bot, seed: start + i })))
  // Fewer seeds a batch when there are too few to keep every process busy.
  const size = Math.max(1, Math.min(BATCH, Math.ceil(jobs.length / Math.max(1, threads))))
  const batches = Array.from({ length: Math.ceil(jobs.length / size) }, (_, id) => ({ id, jobs: jobs.slice(id * size, (id + 1) * size), tries: 0 }))
  const queue = [...batches]
  const played: { bot: string; result: RunResult }[] = []
  let left = batches.length
  let target = Math.max(1, threads)
  let shrunk = 0
  const procs = new Map<ChildProcess, { rss: number; batch?: (typeof batches)[number] }>()

  return new Promise((resolve, reject) => {
    let failed = false
    const stop = () => procs.forEach((_, p) => p.kill())
    const fail = (error: Error) => {
      failed = true
      stop()
      reject(error)
    }
    const used = () => [...procs.values()].reduce((sum, p) => sum + p.rss, 0) / MB
    const pressured = () => used() > memoryMb || freemem() / MB < RESERVE_MB

    const give = (proc: ChildProcess) => {
      const state = procs.get(proc)!
      state.batch = queue.shift()
      if (state.batch) proc.send({ id: state.batch.id, jobs: state.batch.jobs })
      else retire(proc)
    }
    const retire = (proc: ChildProcess) => {
      procs.delete(proc)
      proc.disconnect()
    }
    const spawn = () => {
      // Maglev can crash a CPU-starved process (nodejs/node#64841); without it the sim runs as fast.
      const proc = fork(BUNDLE, { execArgv: [`--max-old-space-size=${HEAP_MB}`, '--no-maglev'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
      procs.set(proc, { rss: 0 })
      proc.send({ tuning, doctrines })
      proc.on('message', (m: { ready: true } | { id: number; played: typeof played; rss: number }) => {
        if (failed) return
        if ('ready' in m) return give(proc)
        const state = procs.get(proc)!
        played.push(...m.played)
        state.rss = m.rss
        state.batch = undefined
        if (--left === 0) {
          stop()
          const bySeed = (bot: string) => played.filter((p) => p.bot === bot).map((p) => p.result).sort((a, b) => a.seed - b.seed)
          return resolve(Object.fromEntries(bots.map((bot) => [bot, bySeed(bot)])))
        }
        if (pressured() && procs.size > 1) {
          target = procs.size - 1
          shrunk = Date.now()
          log(`memory pressure (${Math.round(used())} MB in use, ${Math.round(freemem() / MB)} MB free); down to ${target} processes`)
          return retire(proc)
        }
        if (target < threads && Date.now() - shrunk > CALM_MS && !pressured()) {
          target++
          shrunk = Date.now()
          log(`memory eased; up to ${target} processes`)
        }
        give(proc)
        fill()
      })
      proc.on('exit', (code, signal) => {
        const state = procs.get(proc)
        procs.delete(proc)
        if (failed || !state?.batch) return
        const batch = state.batch
        if (++batch.tries > RETRIES) return fail(new Error(`sim batch ${batch.id} killed its process ${batch.tries} times (last: ${signal ?? `code ${code}`})`))
        log(`process ${proc.pid} died (${signal ?? `code ${code}`}, ${Math.round(state.rss / MB)} MB); retrying its batch`)
        queue.unshift(batch)
        fill()
      })
      proc.on('error', (error) => log(`process ${proc.pid}: ${error.message}`))
    }
    const fill = () => {
      const busy = () => [...procs.values()].filter((p) => p.batch).length
      while (procs.size < Math.min(target, queue.length + busy())) spawn()
    }
    fill()
  })
}
