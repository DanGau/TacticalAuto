import { parentPort, workerData } from 'node:worker_threads'
import { TUNING } from '../core/tuning'

// Tuning goes in before the rest of the game loads, since some of it sets tables built at load.
Object.assign(TUNING, workerData.tuning)
const { bots } = await import('../bots/bots')
const { runWith } = await import('./run')
const jobs: { bot: string; seed: number }[] = workerData.jobs
parentPort!.postMessage(jobs.map(({ bot, seed }) => ({ bot, won: runWith(seed, bots[bot]).won })))
