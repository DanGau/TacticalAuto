// A sim worker process: plays the seeds it is sent.
import { bots } from '../bots/bots'
import { runWith } from './run'

/** A sim child process: given doctrines, plays each batch of seeds it is sent and reports the runs, without their actions. */
type Setup = { doctrines: string[] }
type Batch = { id: number; jobs: { bot: string; seed: number }[] }

const send = (message: unknown) => process.send!(message)
const setup = await new Promise<Setup>((resolve) => process.once('message', resolve))
const doctrines = setup.doctrines as Parameters<typeof runWith>[2]
process.on('message', ({ id, jobs }: Batch) => {
  const played = jobs.map(({ bot, seed }) => ({ bot, result: { ...runWith(seed, bots[bot], doctrines), actions: [] } }))
  send({ id, played, rss: process.memoryUsage().rss })
})
process.on('disconnect', () => process.exit(0))
send({ ready: true })
