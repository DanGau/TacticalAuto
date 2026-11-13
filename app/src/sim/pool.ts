// Plays batches of runs across worker processes.
import { type ChildProcess, fork } from 'node:child_process'
import { buildSync } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { availableParallelism, freemem, tmpdir, totalmem } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DoctrineId } from '../core/doctrines'
import type { Loadout, RunResult } from './run'

/** worker.ts bundled once, on first use, into plain JavaScript, so sim processes start without tsx. */
let bundle: string | undefined
const BUNDLE = () => {
  if (bundle) return bundle
  const out = join(mkdtempSync(join(tmpdir(), 'sim-')), 'worker.mjs')
  buildSync({ entryPoints: [fileURLToPath(new URL('./worker.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' })
  return (bundle = out)
}

/** Heap each sim process may use, in MB. */
const HEAP_MB = 512
/** Memory a sim process holds beside its heap, in MB. */
const OVERHEAD_MB = 128
/** How often, in ms, free memory is checked while batches play. */
const WATCH_MS = 2000
/** Most seeds sent to a process at a time: what a crash costs, and how often memory is checked. */
const BATCH = 10
/** Times a batch is retried on a fresh process before the run fails. */
const RETRIES = 3
/** Free system memory, in MB, below which the pool shrinks, and kills a process mid-batch if it must. */
const RESERVE_MB = 1024
/** How long, in ms, memory must stay calm after a shrink before the pool grows a process back. */
const CALM_MS = 10_000

const MB = 1024 * 1024

/** Processes to start with: one fewer than the cores, and no more than free memory beyond RESERVE_MB holds at their most. */
export const threadsFor = (cores: number, freeMb: number) => Math.max(1, Math.min(cores - 1, Math.floor((freeMb - RESERVE_MB) / (HEAP_MB + OVERHEAD_MB))))
const log = (line: string) => console.error(`sim pool: ${line}`)

interface PoolOptions {
  threads?: number
  doctrines?: DoctrineId[]
  /** Play each deploy screen on with every utility: see forks.ts. */
  forks?: boolean
  /** Play each safehouse and medkit on offer on both ways: see rest.ts. */
  rests?: boolean
  /** With loadouts, the one bot plays each on the same seeds, and results come back by loadout name instead of bot. */
  loadouts?: Record<string, Loadout>
  /** Memory, in MB, the sim processes together may hold before the pool shrinks. */
  memoryMb?: number
}

/**
 * Each bot's runs, by seed, over `runs` seeds from `start`, played on up to `threads` child
 * processes. Results come back without their actions.
 * Under memory pressure the pool retires processes down to one and grows back once it eases; a process that dies has
 * its batch retried on a fresh one.
 */
export async function playAll(bots: string[], runs: number, start: number, options: PoolOptions = {}): Promise<Record<string, RunResult[]>> {
  const { threads = threadsFor(availableParallelism(), freemem() / MB), doctrines = [], forks = false, rests = false, loadouts, memoryMb = (totalmem() / MB) * 0.6 } = options
  const keys = loadouts ? Object.keys(loadouts) : bots
  const jobs = keys.flatMap((key) => Array.from({ length: runs }, (_, i) => ({ key, bot: loadouts ? bots[0] : key, seed: start + i, loadout: { ...loadouts?.[key], doctrines: [...doctrines, ...(loadouts?.[key].doctrines ?? [])] } })))
  // Fewer seeds a batch when there are too few to keep every process busy; one when each run plays on its forks, so a kill under pressure costs little.
  const size = forks || rests ? 1 : Math.max(1, Math.min(BATCH, Math.ceil(jobs.length / Math.max(1, threads))))
  const batches = Array.from({ length: Math.ceil(jobs.length / size) }, (_, id) => ({ id, jobs: jobs.slice(id * size, (id + 1) * size), tries: 0 }))
  const queue = [...batches]
  const played: { key: string; result: RunResult }[] = []
  let left = batches.length
  let target = Math.max(1, threads)
  let shrunk = 0
  const procs = new Map<ChildProcess, { rss: number; batch?: (typeof batches)[number] }>()

  return new Promise((resolve, reject) => {
    let failed = false
    // Under hard pressure a batch can't wait to end: the newest busy process is killed and its batch requeued.
    const watch = setInterval(() => {
      if (freemem() / MB >= RESERVE_MB || procs.size <= 1) return
      const [proc, state] = [...procs].reverse().find(([, s]) => s.batch) ?? []
      if (!proc || !state?.batch) return
      procs.delete(proc)
      queue.unshift(state.batch)
      target = procs.size
      shrunk = Date.now()
      log(`${Math.round(freemem() / MB)} MB free; killed a process mid-batch, down to ${target}`)
      proc.kill()
    }, WATCH_MS)
    const stop = () => {
      clearInterval(watch)
      procs.forEach((_, p) => p.kill())
    }
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
      const proc = fork(BUNDLE(), { execArgv: [`--max-old-space-size=${HEAP_MB}`, '--no-maglev'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
      procs.set(proc, { rss: 0 })
      proc.send({ forks, rests })
      proc.on('message', (m: { ready: true } | { id: number; played: typeof played; rss: number }) => {
        if (failed) return
        if ('ready' in m) return give(proc)
        const state = procs.get(proc)!
        played.push(...m.played)
        state.rss = m.rss
        state.batch = undefined
        if (--left === 0) {
          stop()
          const bySeed = (key: string) => played.filter((p) => p.key === key).map((p) => p.result).sort((a, b) => a.seed - b.seed)
          return resolve(Object.fromEntries(keys.map((key) => [key, bySeed(key)])))
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
