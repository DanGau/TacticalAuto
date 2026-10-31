import { TUNING } from '../core/tuning'

/** A sim child process: given a tuning and doctrines, plays each batch of seeds it is sent and reports the runs, without their actions. */
type Setup = { tuning: typeof TUNING; doctrines: string[] }
type Batch = { id: number; jobs: { bot: string; seed: number }[] }

const send = (message: unknown) => process.send!(message)
const setup = await new Promise<Setup>((resolve) => process.once('message', resolve))
// Tuning goes in before the rest of the game loads, since some of it sets tables built at load.
Object.assign(TUNING, setup.tuning)
const { bots } = await import('../bots/bots')
const { runWith } = await import('./run')
const doctrines = setup.doctrines as Parameters<typeof runWith>[2]
process.on('message', ({ id, jobs }: Batch) => {
  const played = jobs.map(({ bot, seed }) => ({ bot, result: { ...runWith(seed, bots[bot], doctrines), actions: [] } }))
  send({ id, played, rss: process.memoryUsage().rss })
})
process.on('disconnect', () => process.exit(0))
send({ ready: true })
